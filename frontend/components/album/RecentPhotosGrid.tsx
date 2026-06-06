/**
 * RecentPhotosGrid — 앱 안에서 카메라롤 사진을 그리드로 보여주고 다중선택.
 *
 * - 기간 선택(최근 1/3/6/12개월/전체) + "더 보기" 페이지네이션 (전체 로드 부담 회피)
 * - "얼굴 사진만" 토글: 온디바이스 얼굴감지로 얼굴 있는 사진만 필터 + 자동선택
 *
 * ★ 네이티브 모듈(expo-media-library, @react-native-ml-kit/face-detection)을
 *   동적 import + fallback (CLAUDE.md 규칙):
 *   - media-library 없으면 → OS 다중선택 피커로 폴백 (구버전 APK 안전)
 *   - 얼굴감지 모듈 없으면 → "얼굴만" 토글 숨김 (그리드는 정상 동작)
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { pickMultipleFromLibrary } from '../../utils/imagePicker';

interface Asset {
  id: string;
  uri: string;
}

interface AssetsPage {
  assets: { id: string; uri: string }[];
  endCursor?: string;
  hasNextPage?: boolean;
}
interface MediaLibraryModule {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  getAssetsAsync: (opts: Record<string, unknown>) => Promise<AssetsPage>;
  getAssetInfoAsync: (id: string) => Promise<{ localUri?: string }>;
  SortBy: { creationTime: unknown };
  MediaType: { photo: unknown };
}
interface FaceDetectorModule {
  detect: (uri: string, options?: Record<string, unknown>) => Promise<unknown[]>;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPicked: (uris: string[]) => void;
}

const RANGES: { key: string; label: string; months: number | null }[] = [
  { key: '1m', label: '최근 1개월', months: 1 },
  { key: '3m', label: '3개월', months: 3 },
  { key: '6m', label: '6개월', months: 6 },
  { key: '1y', label: '1년', months: 12 },
  { key: 'all', label: '전체', months: null },
];

const PAGE_SIZE = 120;
const FACE_CONCURRENCY = 6;
const FACE_ANALYZE_CAP = 300; // 한 번에 얼굴감지할 최대 장수 (속도/배터리 보호)
// 속도 튜닝: 얼굴 유무만 판정 → fast 모드 + 작은 리사이즈 + 큰 얼굴 기준(아기 얼굴은 크게 찍힘)
const FACE_RESIZE_W = 560;
const FACE_MIN_SIZE = 0.12;
const COLS = 3;
const GAP = 2;
const SIZE = Dimensions.get('window').width / COLS;
const DAY_MS = 24 * 60 * 60 * 1000;

export function RecentPhotosGrid({ visible, onClose, onPicked }: Props) {
  const [ml, setMl] = useState<MediaLibraryModule | null>(null);
  const [fd, setFd] = useState<FaceDetectorModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);
  const [rangeKey, setRangeKey] = useState('3m');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasNext, setHasNext] = useState(false);

  // 얼굴감지
  const [faceOnly, setFaceOnly] = useState(false);
  const [faceMap, setFaceMap] = useState<Record<string, boolean>>({});
  const faceMapRef = useRef<Record<string, boolean>>({});
  const analyzingRef = useRef(false);
  const cancelAnalysisRef = useRef(false);
  const assetsRef = useRef<Asset[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);

  const fallbackPick = useCallback(async () => {
    const picked = await pickMultipleFromLibrary({ quality: 0.9, selectionLimit: 20 });
    if (picked.length > 0) onPicked(picked.map((p) => p.uri));
    else onClose();
  }, [onPicked, onClose]);

  // 모듈 로드 + 권한 (visible 시 1회)
  useEffect(() => {
    if (!visible) return;
    setSelected(new Set());
    setUnavailable(false);
    setMl(null);
    setFaceOnly(false);
    setFaceMap({});
    faceMapRef.current = {};
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const mod = (await import('expo-media-library')) as unknown as MediaLibraryModule;
        const perm = await mod.requestPermissionsAsync();
        if (!perm.granted) {
          if (!cancelled) { setUnavailable(true); setLoading(false); }
          return;
        }
        if (!cancelled) setMl(mod);
      } catch {
        if (!cancelled) { setUnavailable(true); setLoading(false); }
      }
      // 얼굴감지 모듈 (없어도 무방 — 토글만 숨김)
      try {
        const fdMod = await import('@react-native-ml-kit/face-detection');
        const detector = ((fdMod as { default?: unknown }).default ?? fdMod) as unknown as FaceDetectorModule;
        if (!cancelled && detector && typeof detector.detect === 'function') setFd(detector);
      } catch { /* 얼굴감지 미지원 — 토글 숨김 */ }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  // 모듈/권한 불가 → OS 피커 폴백
  useEffect(() => {
    if (visible && unavailable && !loading) fallbackPick();
  }, [visible, unavailable, loading, fallbackPick]);

  // 사진 조회만 (setState X) — 호출자가 처리. 얼굴모드면 기간별 최대 CAP 장 한번에.
  const fetchAssets = useCallback(async (
    rKey: string, after?: string,
  ): Promise<{ list: Asset[]; endCursor?: string; hasNext: boolean }> => {
    if (!ml) return { list: [], hasNext: false };
    const range = RANGES.find((r) => r.key === rKey);
    const opts: Record<string, unknown> = {
      first: faceOnly ? FACE_ANALYZE_CAP : PAGE_SIZE,
      sortBy: [ml.SortBy.creationTime],
      mediaType: ml.MediaType.photo,
    };
    if (range?.months) opts.createdAfter = Date.now() - range.months * 30 * DAY_MS;
    if (after) opts.after = after;
    const page = await ml.getAssetsAsync(opts);
    return {
      list: page.assets.map((a) => ({ id: a.id, uri: a.uri })),
      endCursor: page.endCursor,
      hasNext: !!page.hasNextPage,
    };
  }, [ml, faceOnly]);

  // 얼굴감지 — 주어진 목록을 분석 (가드로 동시실행 차단, stale ref 안 씀)
  const runAnalysisOn = useCallback(async (list: Asset[]) => {
    if (!fd || !ml || analyzingRef.current) return;
    const target = list.slice(0, FACE_ANALYZE_CAP);
    const todo = target.filter((a) => faceMapRef.current[a.id] === undefined);
    if (todo.length === 0) return;
    analyzingRef.current = true;
    cancelAnalysisRef.current = false;
    setAnalyzing(true);
    setAnalyzeProgress({ done: 0, total: todo.length });
    let done = 0;
    const updates: Record<string, boolean> = {};
    const newlySelected: string[] = [];
    for (let i = 0; i < todo.length; i += FACE_CONCURRENCY) {
      if (cancelAnalysisRef.current) break; // 사용자가 분석 취소
      const chunk = todo.slice(i, i + FACE_CONCURRENCY);
      await Promise.all(chunk.map(async (a) => {
        try {
          // ML Kit 이 갤러리 uri(content://)를 직접 못 읽는 경우가 있어,
          // 먼저 임시 파일(file://)로 변환 후 감지.
          // 속도 우선: fast 모드 + 작은 리사이즈 + 큰 얼굴 기준(아기 얼굴은 크게 찍힘).
          const manip = await ImageManipulator.manipulateAsync(
            a.uri,
            [{ resize: { width: FACE_RESIZE_W } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
          );
          const faces = await fd.detect(manip.uri, { performanceMode: 'fast', minFaceSize: FACE_MIN_SIZE });
          const has = Array.isArray(faces) && faces.length > 0;
          updates[a.id] = has;
          if (has) newlySelected.push(a.id);
        } catch {
          updates[a.id] = false;
        }
        done += 1;
        setAnalyzeProgress({ done, total: todo.length });
      }));
    }
    faceMapRef.current = { ...faceMapRef.current, ...updates };
    setFaceMap({ ...faceMapRef.current });
    setSelected((prev) => {
      const n = new Set(prev);
      newlySelected.forEach((id) => n.add(id));
      return n;
    });
    const wasCancelled = cancelAnalysisRef.current;
    analyzingRef.current = false;
    cancelAnalysisRef.current = false;
    setAnalyzing(false);
    setAnalyzeProgress(null);
    // 취소 시: 얼굴모드 자동 해제 → 전체 사진 그리드로 복귀 (부분분석 상태 혼란 방지)
    if (wasCancelled) setFaceOnly(false);
  }, [fd, ml]);

  // 초기 / 기간 / 얼굴모드 변경 → 재로드 후, 얼굴모드면 "로드된 목록"으로 즉시 분석
  // (로드 결과를 직접 넘겨 레이스/stale 제거)
  useEffect(() => {
    if (!ml) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetchAssets(rangeKey);
        if (cancelled) return;
        setAssets(r.list);
        assetsRef.current = r.list;
        setCursor(r.endCursor);
        setHasNext(r.hasNext);
        setLoading(false);
        if (faceOnly) runAnalysisOn(r.list);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ml, rangeKey, faceOnly, fetchAssets, runAnalysisOn]);

  const loadMore = useCallback(async () => {
    if (faceOnly) return; // 얼굴모드: 분석 폭주 방지 위해 자동 추가로딩 정지 (기간으로 범위 조절)
    if (loadingMore || !hasNext || !cursor) return;
    setLoadingMore(true);
    try {
      const r = await fetchAssets(rangeKey, cursor);
      setAssets((prev) => { const merged = [...prev, ...r.list]; assetsRef.current = merged; return merged; });
      setCursor(r.endCursor);
      setHasNext(r.hasNext);
    } catch { /* ignore */ }
    setLoadingMore(false);
  }, [faceOnly, loadingMore, hasNext, cursor, rangeKey, fetchAssets]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const confirm = useCallback(async () => {
    if (!ml) return;
    setResolving(true);
    const uris: string[] = [];
    for (const a of assets) {
      if (!selected.has(a.id)) continue;
      try {
        const info = await ml.getAssetInfoAsync(a.id);
        uris.push(info.localUri || a.uri);
      } catch {
        uris.push(a.uri);
      }
    }
    setResolving(false);
    if (uris.length > 0) onPicked(uris);
  }, [ml, assets, selected, onPicked]);

  const displayed = faceOnly ? assets.filter((a) => faceMap[a.id]) : assets;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* 안전영역: New Arch RN Modal 고정 상단 패딩 — 취소 버튼이 iOS 시계 영역에 깔리던 문제 해결 */}
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 24) }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancel}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.title}>사진 선택</Text>
          <TouchableOpacity
            onPress={confirm}
            disabled={selected.size === 0 || resolving}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.add, (selected.size === 0 || resolving) && { opacity: 0.4 }]}>
              {resolving ? '...' : selected.size > 0 ? `추가 (${selected.size})` : '추가'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 기간 선택 칩 */}
        {!unavailable && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rangeBar}
            contentContainerStyle={styles.rangeBarContent}
          >
            {RANGES.map((r) => {
              const active = r.key === rangeKey;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.rangeChip, active && styles.rangeChipActive]}
                  onPress={() => {
                    if (r.key === rangeKey || analyzing) return;
                    // 기간 바꾸면 분석 캐시/선택 초기화 → 새 기간 사진으로 깨끗이 재분석
                    faceMapRef.current = {};
                    setFaceMap({});
                    setSelected(new Set());
                    setRangeKey(r.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* 얼굴 사진만 토글 (얼굴감지 모듈 있을 때만) */}
        {!unavailable && fd && (
          <View style={styles.faceRow}>
            <Text style={[styles.faceLabel, faceOnly && { color: '#FF8C5A', fontWeight: '700' }]}>
              🙂 얼굴 있는 사진만 (자동 선택)
            </Text>
            {analyzing ? (
              <View style={styles.analyzeRow}>
                <ActivityIndicator color="#FF8C5A" size="small" />
                <Text style={styles.analyzeText}>
                  {analyzeProgress ? `분석 ${analyzeProgress.done}/${analyzeProgress.total}` : '분석 중'}
                </Text>
                <TouchableOpacity
                  onPress={() => { cancelAnalysisRef.current = true; }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.cancelAnalyzeBtn}
                >
                  <Text style={styles.cancelAnalyzeText}>취소</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Switch
                value={faceOnly}
                onValueChange={setFaceOnly}
                trackColor={{ false: '#E5E5EA', true: '#FFD2B3' }}
                thumbColor={faceOnly ? '#FF8C5A' : '#FFFFFF'}
              />
            )}
          </View>
        )}

        {loading || unavailable ? (
          <View style={styles.center}>
            <ActivityIndicator color="#FF8C5A" />
            {unavailable && <Text style={styles.dim}>갤러리를 여는 중...</Text>}
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.dim}>{faceOnly ? '얼굴 있는 사진이 없어요' : '이 기간에 사진이 없어요'}</Text>
          </View>
        ) : (
          <FlatList
            data={displayed}
            keyExtractor={(a) => a.id}
            numColumns={COLS}
            initialNumToRender={30}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoad}><ActivityIndicator color="#FF8C5A" size="small" /></View>
              ) : null
            }
            renderItem={({ item }) => {
              const sel = selected.has(item.id);
              return (
                <TouchableOpacity activeOpacity={0.8} onPress={() => toggle(item.id)}>
                  <Image
                    source={{ uri: item.uri }}
                    style={{ width: SIZE - GAP, height: SIZE - GAP, margin: GAP / 2, backgroundColor: '#EEE' }}
                    contentFit="cover"
                  />
                  {sel && (
                    <View style={styles.selBadge}>
                      <Text style={styles.selBadgeText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  cancel: { fontSize: 15, color: '#636366' },
  title: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  add: { fontSize: 15, fontWeight: '700', color: '#FF8C5A' },
  rangeBar: { borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0', flexGrow: 0, flexShrink: 0 },
  rangeBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignItems: 'center' },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  rangeChipActive: { backgroundColor: '#FFF0E6', borderColor: '#FF8C5A' },
  rangeChipText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#636366' },
  rangeChipTextActive: { color: '#FF8C5A', fontWeight: '700' },
  faceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  faceLabel: { fontSize: 14, color: '#636366' },
  analyzeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzeText: { fontSize: 12.5, color: '#FF8C5A', fontWeight: '600' },
  cancelAnalyzeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cancelAnalyzeText: { fontSize: 12.5, color: '#636366', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  dim: { fontSize: 14, color: '#636366' },
  footerLoad: { paddingVertical: 16, alignItems: 'center' },
  selBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF8C5A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  selBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
