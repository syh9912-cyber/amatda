/**
 * 출산가방 체크리스트 — 엄마·아빠가 같이 끝내는 투두리스트.
 *
 * 핵심 차별점:
 *  1) 분만 형태(자연/제왕) × 산후 계획(조리원/집) 직교 분기
 *  2) 항목별 담당 (엄마/아빠/같이/미정)
 *  3) 항목별 상태 (구매필요/준비완료/가방에 넣음/해당없음)
 *  4) 진행률 + 요약칩 (구매필요·아빠담당 카운트)
 *  5) 자연스러운 추천 배너 (광고 슬롯 — "광고" 티 안 나게 디자인)
 *
 * 저장: AsyncStorage `amatda_birthbag_v2_{childId}` (v2 = 새 스키마)
 *  옛 v1(`amatda_birthbag_{childId}`) 데이터는 자동 마이그레이션.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Image,
  TextInput, KeyboardAvoidingView, Platform, Share, Alert, ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { birthBagShareApi } from '../../services/api';
import type { ImageSourcePropType } from 'react-native';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { getHospital } from '../../services/deliveryHospital';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideButton } from '../../components/common/GuideButton';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { BIRTHBAG_GUIDE } from '../../features/guide/birthBagGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';

/* PNG 아이콘 (기본 이모지 대신 — 우리 앱 일러스트 톤 유지) */
const IC_FOOT = require('../../assets/preg-foot.png') as ImageSourcePropType;
const IC_STETH = require('../../assets/preg-stethoscope.png') as ImageSourcePropType;
const IC_BAG = require('../../assets/preg-bag.png') as ImageSourcePropType;
const IC_HOME = require('../../assets/mascot-happy.png') as ImageSourcePropType;
const IC_TIP = require('../../assets/mascot-thinking.png') as ImageSourcePropType;
const IC_RECO = require('../../assets/preg-ribbon.png') as ImageSourcePropType;

/* ============================================================== */
/*  Types & Data                                                  */
/* ============================================================== */

type BirthType = 'natural' | 'csection';
type PostpartumPlan = 'sanhujowon' | 'home';
type Category = 'mom' | 'baby' | 'docs';
type Owner = 'mom' | 'dad' | 'both' | null;
type Status = 'need' | 'ready' | 'packed' | 'na' | null;

interface BagItem {
  id: string;
  label: string;
  category: Category;
  /** 분만 형태 필터 (없으면 모두 공통) */
  forBirthTypes?: BirthType[];
  /** 산후 계획 필터 (없으면 모두 공통) */
  forPostpartumPlans?: PostpartumPlan[];
  hint?: string;
}

const getBirthTypes = (t: TFunction): { key: BirthType; label: string; sub: string; icon: ImageSourcePropType }[] => [
  { key: 'natural',  label: t('birthBag.birthTypes.natural.label'),  sub: t('birthBag.birthTypes.natural.sub'),  icon: IC_FOOT },
  { key: 'csection', label: t('birthBag.birthTypes.csection.label'), sub: t('birthBag.birthTypes.csection.sub'), icon: IC_STETH },
];

const getPostpartumPlans = (t: TFunction): { key: PostpartumPlan; label: string; sub: string; icon: ImageSourcePropType }[] => [
  { key: 'sanhujowon', label: t('birthBag.postpartumPlans.sanhujowon.label'), sub: t('birthBag.postpartumPlans.sanhujowon.sub'), icon: IC_BAG },
  { key: 'home',       label: t('birthBag.postpartumPlans.home.label'),       sub: t('birthBag.postpartumPlans.home.sub'),       icon: IC_HOME },
];

const getCategoryLabel = (t: TFunction): Record<Category, string> => ({
  mom:  t('birthBag.categoryLabel.mom'),
  baby: t('birthBag.categoryLabel.baby'),
  docs: t('birthBag.categoryLabel.docs'),
});

const getAllItems = (t: TFunction): BagItem[] => [
  // ── 엄마 (산모) ──
  { id: 'm1',  label: t('birthBag.items.m1.label'), category: 'mom' },
  { id: 'm2',  label: t('birthBag.items.m2.label'), category: 'mom' },
  { id: 'm3',  label: t('birthBag.items.m3.label'), category: 'mom' },
  { id: 'm4',  label: t('birthBag.items.m4.label'), category: 'mom' },
  { id: 'm5',  label: t('birthBag.items.m5.label'), category: 'mom' },
  { id: 'm6',  label: t('birthBag.items.m6.label'), category: 'mom' },
  { id: 'm7',  label: t('birthBag.items.m7.label'), category: 'mom' },
  { id: 'm8',  label: t('birthBag.items.m8.label'), category: 'mom', forBirthTypes: ['csection'], hint: t('birthBag.items.m8.hint') },
  { id: 'm9',  label: t('birthBag.items.m9.label'), category: 'mom', forBirthTypes: ['natural'], hint: t('birthBag.items.m9.hint') },
  { id: 'm19', label: t('birthBag.items.m19.label'), category: 'mom', hint: t('birthBag.items.m19.hint') },
  { id: 'm10', label: t('birthBag.items.m10.label'), category: 'mom' },
  { id: 'm11', label: t('birthBag.items.m11.label'), category: 'mom' },
  { id: 'm12', label: t('birthBag.items.m12.label'), category: 'mom' },
  { id: 'm13', label: t('birthBag.items.m13.label'), category: 'mom' },
  { id: 'm14', label: t('birthBag.items.m14.label'), category: 'mom' },
  // 산후 계획별
  { id: 'm15', label: t('birthBag.items.m15.label'), category: 'mom', forPostpartumPlans: ['sanhujowon'], hint: t('birthBag.items.m15.hint') },
  { id: 'm16', label: t('birthBag.items.m16.label'), category: 'mom', forPostpartumPlans: ['sanhujowon'] },
  { id: 'm17', label: t('birthBag.items.m17.label'), category: 'mom', forPostpartumPlans: ['home'], hint: t('birthBag.items.m17.hint') },
  { id: 'm18', label: t('birthBag.items.m18.label'), category: 'mom', forPostpartumPlans: ['home'] },

  // ── 아기 ──
  { id: 'b1',  label: t('birthBag.items.b1.label'), category: 'baby' },
  { id: 'b2',  label: t('birthBag.items.b2.label'), category: 'baby' },
  { id: 'b3',  label: t('birthBag.items.b3.label'), category: 'baby' },
  { id: 'b4',  label: t('birthBag.items.b4.label'), category: 'baby' },
  { id: 'b5',  label: t('birthBag.items.b5.label'), category: 'baby' },
  { id: 'b6',  label: t('birthBag.items.b6.label'), category: 'baby' },
  { id: 'b7',  label: t('birthBag.items.b7.label'), category: 'baby', hint: t('birthBag.items.b7.hint') },
  { id: 'b8',  label: t('birthBag.items.b8.label'), category: 'baby' },
  { id: 'b9',  label: t('birthBag.items.b9.label'), category: 'baby' },
  { id: 'b10', label: t('birthBag.items.b10.label'), category: 'baby' },

  // ── 서류 ──
  { id: 'd1', label: t('birthBag.items.d1.label'), category: 'docs' },
  { id: 'd2', label: t('birthBag.items.d2.label'), category: 'docs' },
  { id: 'd3', label: t('birthBag.items.d3.label'), category: 'docs' },
  { id: 'd4', label: t('birthBag.items.d4.label'), category: 'docs' },
  { id: 'd5', label: t('birthBag.items.d5.label'), category: 'docs' },
  // 분만 병원 번호 등록 — 등록 완료 시 자동 체크 (useEffect 가 동기화)
  { id: 'd6', label: t('birthBag.items.d6.label'), category: 'docs', hint: t('birthBag.items.d6.hint') },
];

interface SavedV3 {
  v: 3;
  birthType: BirthType;
  postpartumPlan: PostpartumPlan;
  checked: Record<string, boolean>;
  owner: Record<string, Owner>;
  status: Record<string, Status>;
  customItems: BagItem[];
  hiddenIds: string[];
}

interface SavedV2 {
  v: 2;
  birthType: BirthType;
  postpartumPlan: PostpartumPlan;
  checked: Record<string, boolean>;
  owner: Record<string, Owner>;
  status: Record<string, Status>;
}

interface SavedV1 {
  type?: 'natural' | 'csection' | 'postpartum';
  checked?: Record<string, boolean>;
  owner?: Record<string, 'mom' | 'dad' | null>;
}

const STORAGE_KEY_V3 = (childId: string) => `amatda_birthbag_v3_${childId}`;
const STORAGE_KEY_V2 = (childId: string) => `amatda_birthbag_v2_${childId}`;
const STORAGE_KEY_V1 = (childId: string) => `amatda_birthbag_${childId}`;

const getOwnerMeta = (t: TFunction): Record<Exclude<Owner, null>, { label: string; bg: string; fg: string }> => ({
  mom:  { label: t('birthBag.owner.mom'),  bg: '#FCE4EC', fg: '#C2185B' },
  dad:  { label: t('birthBag.owner.dad'),  bg: '#E3F2FD', fg: '#1565C0' },
  both: { label: t('birthBag.owner.both'), bg: '#EDE7F6', fg: '#6A1B9A' },
});

/**
 * 항목별 추천 상품 한 줄 — '구매 필요' 상태일 때 카드 하단에 작은 슬롯으로 노출.
 * 톤: 위트 + 세련 + 압박감 X. 실제 쇼핑몰 연동은 추후 (현재는 디자인 자리잡기용).
 */
const getProductHints = (t: TFunction): Record<string, string> => ({
  // ── 엄마 ──
  m1: t('birthBag.productHints.m1'),
  m2: t('birthBag.productHints.m2'),
  m3: t('birthBag.productHints.m3'),
  m4: t('birthBag.productHints.m4'),
  m5: t('birthBag.productHints.m5'),
  m6: t('birthBag.productHints.m6'),
  m7: t('birthBag.productHints.m7'),
  m8: t('birthBag.productHints.m8'),
  m9: t('birthBag.productHints.m9'),
  m19: t('birthBag.productHints.m19'),
  m10: t('birthBag.productHints.m10'),
  m11: t('birthBag.productHints.m11'),
  m12: t('birthBag.productHints.m12'),
  m13: t('birthBag.productHints.m13'),
  m14: t('birthBag.productHints.m14'),
  m15: t('birthBag.productHints.m15'),
  m16: t('birthBag.productHints.m16'),
  m17: t('birthBag.productHints.m17'),
  m18: t('birthBag.productHints.m18'),
  // ── 아기 ──
  b1: t('birthBag.productHints.b1'),
  b2: t('birthBag.productHints.b2'),
  b3: t('birthBag.productHints.b3'),
  b4: t('birthBag.productHints.b4'),
  b5: t('birthBag.productHints.b5'),
  b6: t('birthBag.productHints.b6'),
  b7: t('birthBag.productHints.b7'),
  b8: t('birthBag.productHints.b8'),
  b9: t('birthBag.productHints.b9'),
  b10: t('birthBag.productHints.b10'),
});

const getStatusMeta = (t: TFunction): Record<Exclude<Status, null>, { label: string; bg: string; fg: string }> => ({
  need:   { label: t('birthBag.status.need'),   bg: '#FFF3E0', fg: '#E65100' },
  ready:  { label: t('birthBag.status.ready'),  bg: '#E8F5E9', fg: '#2E7D32' },
  packed: { label: t('birthBag.status.packed'), bg: '#E3F2FD', fg: '#1565C0' },
  na:     { label: t('birthBag.status.na'),     bg: '#ECEFF1', fg: '#546E7A' },
});

/* ============================================================== */
/*  Screen                                                         */
/* ============================================================== */

export default function BirthBagScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const child = useChildStore((s) => s.selectedChild);

  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => { shouldAutoShowGuide('birth-bag').then((sh) => { if (sh) setGuideVisible(true); }); }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('birth-bag'); };

  const [birthType, setBirthType] = useState<BirthType>('natural');
  const [postpartumPlan, setPostpartumPlan] = useState<PostpartumPlan>('sanhujowon');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [owner, setOwner] = useState<Record<string, Owner>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [customItems, setCustomItems] = useState<BagItem[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Record<Category, boolean>>({ mom: false, baby: false, docs: false });
  const [loaded, setLoaded] = useState(false);

  // 보기 필터 (전체 / 구매필요 / 아빠담당 / 미지정 / 완료숨기기)
  type ViewFilter = 'all' | 'need' | 'dad' | 'unassigned' | 'hideDone';
  const [filter, setFilter] = useState<ViewFilter>('all');

  // 모달 상태
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
  const [pickerKind, setPickerKind] = useState<'owner' | 'status' | null>(null);
  const [addModalCategory, setAddModalCategory] = useState<Category | null>(null);
  const [hiddenViewOpen, setHiddenViewOpen] = useState(false);
  const [moreMenuId, setMoreMenuId] = useState<string | null>(null);

  // 공유
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharing, setSharing] = useState(false);

  // d6 (분만 병원 번호 등록) 자동 체크 — clinic/delivery 둘 중 하나라도 등록되면 체크
  useEffect(() => {
    if (!child?.id) return;
    let cancelled = false;
    (async () => {
      const delivery = await getHospital(child.id, 'delivery');
      const clinic = await getHospital(child.id, 'clinic');
      const has =
        !!(delivery?.mainPhone || delivery?.deliveryWardPhone) ||
        !!(clinic?.mainPhone || clinic?.deliveryWardPhone);
      if (cancelled) return;
      setChecked((prev) => (prev.d6 === has ? prev : { ...prev, d6: has }));
    })();
    return () => { cancelled = true; };
  }, [child?.id, loaded]);

  // Load (v3 → v2 → v1 마이그레이션)
  useEffect(() => {
    if (!child?.id) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const rawV3 = await AsyncStorage.getItem(STORAGE_KEY_V3(child.id));
        if (rawV3) {
          const data = JSON.parse(rawV3) as SavedV3;
          if (!cancelled && data.v === 3) {
            setBirthType(data.birthType);
            setPostpartumPlan(data.postpartumPlan);
            setChecked(data.checked ?? {});
            setOwner(data.owner ?? {});
            setStatus(data.status ?? {});
            setCustomItems(data.customItems ?? []);
            setHiddenIds(data.hiddenIds ?? []);
          }
        } else {
          const rawV2 = await AsyncStorage.getItem(STORAGE_KEY_V2(child.id));
          if (rawV2) {
            const data = JSON.parse(rawV2) as SavedV2;
            if (!cancelled && data.v === 2) {
              setBirthType(data.birthType);
              setPostpartumPlan(data.postpartumPlan);
              setChecked(data.checked ?? {});
              setOwner(data.owner ?? {});
              setStatus(data.status ?? {});
            }
          } else {
            const rawV1 = await AsyncStorage.getItem(STORAGE_KEY_V1(child.id));
            if (rawV1) {
              const v1 = JSON.parse(rawV1) as SavedV1;
              if (!cancelled) {
                setBirthType(v1.type === 'csection' ? 'csection' : 'natural');
                setPostpartumPlan(v1.type === 'postpartum' ? 'sanhujowon' : 'home');
                setChecked(v1.checked ?? {});
                setOwner((v1.owner as Record<string, Owner>) ?? {});
              }
            }
          }
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [child?.id]);

  // Save v3
  useEffect(() => {
    if (!child?.id || !loaded) return;
    const data: SavedV3 = { v: 3, birthType, postpartumPlan, checked, owner, status, customItems, hiddenIds };
    AsyncStorage.setItem(STORAGE_KEY_V3(child.id), JSON.stringify(data)).catch(() => {});
  }, [birthType, postpartumPlan, checked, owner, status, customItems, hiddenIds, child?.id, loaded]);

  const allItems = useMemo(() => getAllItems(t), [t]);
  const productHints = useMemo(() => getProductHints(t), [t]);
  const ownerMeta = useMemo(() => getOwnerMeta(t), [t]);
  const statusMeta = useMemo(() => getStatusMeta(t), [t]);
  const categoryLabel = useMemo(() => getCategoryLabel(t), [t]);
  const birthTypes = useMemo(() => getBirthTypes(t), [t]);
  const postpartumPlans = useMemo(() => getPostpartumPlans(t), [t]);

  // 기본 + 커스텀 합치기 → 분만/산후 필터 + 숨김 제외
  const visibleItems = useMemo(() => {
    const merged = [...allItems, ...customItems];
    return merged.filter((it) => {
      if (hiddenIds.includes(it.id)) return false;
      if (it.forBirthTypes && !it.forBirthTypes.includes(birthType)) return false;
      if (it.forPostpartumPlans && !it.forPostpartumPlans.includes(postpartumPlan)) return false;
      return true;
    });
  }, [allItems, customItems, hiddenIds, birthType, postpartumPlan]);

  // 분만/산후 특화 여부 — 현재 선택된 분만형/산후계획 전용 항목인지
  const isSpecialized = useCallback((it: BagItem): boolean => {
    if (it.forBirthTypes && it.forBirthTypes.includes(birthType)) return true;
    if (it.forPostpartumPlans && it.forPostpartumPlans.includes(postpartumPlan)) return true;
    return false;
  }, [birthType, postpartumPlan]);

  const itemsByCategory = useMemo(() => {
    const map: Record<Category, BagItem[]> = { mom: [], baby: [], docs: [] };
    for (const it of visibleItems) {
      if (filter === 'need' && status[it.id] !== 'need') continue;
      if (filter === 'dad' && owner[it.id] !== 'dad') continue;
      if (filter === 'hideDone' && checked[it.id]) continue;
      if (filter === 'unassigned' && (owner[it.id] != null && status[it.id] != null)) continue;
      map[it.category].push(it);
    }
    // 분만/산후 특화 항목을 카테고리 내 최상단으로 정렬 (안정 정렬: 같은 그룹 안 순서 보존)
    for (const cat of Object.keys(map) as Category[]) {
      map[cat].sort((a, b) => {
        const aSpec = isSpecialized(a) ? 0 : 1;
        const bSpec = isSpecialized(b) ? 0 : 1;
        return aSpec - bSpec;
      });
    }
    return map;
  }, [visibleItems, filter, status, owner, checked, isSpecialized]);

  // Stats — '해당없음' 제외
  const totalCount = visibleItems.filter((it) => status[it.id] !== 'na').length;
  const checkedCount = visibleItems.filter((it) => checked[it.id] && status[it.id] !== 'na').length;
  const needCount = visibleItems.filter((it) => status[it.id] === 'need').length;
  const dadCount = visibleItems.filter((it) => owner[it.id] === 'dad').length;
  const checkedCountDad = visibleItems.filter((it) => owner[it.id] === 'dad' && checked[it.id]).length;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const isCustom = useCallback((id: string) => customItems.some((c) => c.id === id), [customItems]);

  const toggleChecked = useCallback((id: string) => {
    setChecked((prev) => {
      const next = !prev[id];
      // 체크 토글 시 상태도 자동 동기화
      // ✓ → 'packed' (가방에 넣음)
      // ✗ → status가 'packed'였으면 'ready'로 (준비 완료지만 안 넣음)로 다운그레이드
      setStatus((s) => {
        if (next) return { ...s, [id]: 'packed' };
        if (s[id] === 'packed') return { ...s, [id]: 'ready' };
        return s;
      });
      return { ...prev, [id]: next };
    });
  }, []);

  const setItemOwner = useCallback((id: string, value: Owner) => {
    setOwner((prev) => ({ ...prev, [id]: value }));
  }, []);

  const setItemStatus = useCallback((id: string, value: Status) => {
    setStatus((prev) => ({ ...prev, [id]: value }));
    // 상태 변경 시 체크도 자동 동기화
    // 'packed' → ✓ 자동 체크 / 그 외(need/ready/na/null) → ✗ 자동 해제
    setChecked((prev) => ({ ...prev, [id]: value === 'packed' }));
  }, []);

  const openPicker = useCallback((id: string, kind: 'owner' | 'status') => {
    setPickerItemId(id);
    setPickerKind(kind);
  }, []);

  const closePicker = useCallback(() => {
    setPickerItemId(null);
    setPickerKind(null);
  }, []);

  const toggleCollapsed = useCallback((cat: Category) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const addCustomItem = useCallback((label: string, hint: string, category: Category) => {
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const item: BagItem = { id, label: label.trim(), category, ...(hint.trim() ? { hint: hint.trim() } : {}) };
    setCustomItems((prev) => [...prev, item]);
  }, []);

  const hideItem = useCallback((id: string) => {
    setHiddenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setMoreMenuId(null);
  }, []);

  const restoreItem = useCallback((id: string) => {
    setHiddenIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const deleteCustomItem = useCallback((id: string) => {
    setCustomItems((prev) => prev.filter((c) => c.id !== id));
    setChecked((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setOwner((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setStatus((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setHiddenIds((prev) => prev.filter((x) => x !== id));
    setMoreMenuId(null);
  }, []);

  const hiddenItemsResolved = useMemo(() => {
    const merged = [...allItems, ...customItems];
    return hiddenIds
      .map((id) => merged.find((m) => m.id === id))
      .filter((x): x is BagItem => !!x);
  }, [allItems, hiddenIds, customItems]);

  /**
   * 공유 링크 생성 → 사용자가 선택한 채널(카카오톡/문자/링크 복사)로 전달.
   * action: 'native' | 'copy' — native는 OS 공유 시트 (카카오톡 포함)
   */
  const generateShareLink = useCallback(async (): Promise<string | null> => {
    try {
      // hidden 제외, 분만/산후 필터 통과 항목만 보냄
      const visible = [...allItems, ...customItems].filter((it) => {
        if (hiddenIds.includes(it.id)) return false;
        if (it.forBirthTypes && !it.forBirthTypes.includes(birthType)) return false;
        if (it.forPostpartumPlans && !it.forPostpartumPlans.includes(postpartumPlan)) return false;
        return true;
      });
      const itemsPayload = visible.map((it) => ({
        id: it.id,
        label: it.label,
        hint: it.hint,
        category: it.category,
        owner: owner[it.id] ?? null,
        status: status[it.id] ?? null,
        checked: !!checked[it.id],
      }));
      const res = await birthBagShareApi.create({
        ownerLabel: t('birthBag.ownerLabelMom'),
        birthType,
        postpartumPlan,
        items: itemsPayload,
      });
      const data = res.data?.data as { url?: string } | undefined;
      return data?.url ?? null;
    } catch {
      return null;
    }
  }, [allItems, customItems, hiddenIds, birthType, postpartumPlan, owner, status, checked, t]);

  const handleShareNative = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const url = await generateShareLink();
      if (!url) {
        Alert.alert(t('birthBag.shareFailTitle'), t('birthBag.shareFailDesc'));
        return;
      }
      const summary = t('birthBag.shareSummary', { progressPct, remaining: totalCount - checkedCount, url });
      await Share.share({ message: summary });
      setShareModalVisible(false);
    } catch { /* 사용자가 취소한 경우 */ }
    finally { setSharing(false); }
  }, [sharing, generateShareLink, progressPct, totalCount, checkedCount, t]);

  const handleShareCopy = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const url = await generateShareLink();
      if (!url) {
        Alert.alert(t('birthBag.shareFailTitle'), t('birthBag.shareFailDesc'));
        return;
      }
      await Clipboard.setStringAsync(url);
      Alert.alert(t('birthBag.copyDoneTitle'), t('birthBag.copyDoneDesc'));
      setShareModalVisible(false);
    } finally { setSharing(false); }
  }, [sharing, generateShareLink, t]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <ScreenHeader
        title={t('birthBag.headerTitle')}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <GuideButton onPress={() => setGuideVisible(true)} color="#7CA46E" />
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => setShareModalVisible(true)}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Text style={styles.shareBtnText}>{t('birthBag.shareBtn')}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('birthBag.heroTitle')}</Text>
          <Text style={styles.heroSub}>
            {t('birthBag.heroSub')}
          </Text>
        </View>

        {/* Birth type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('birthBag.birthTypeLabel')}</Text>
          <View style={styles.typeRow}>
            {birthTypes.map((item) => {
              const active = birthType === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.typeCard, active && styles.typeCardActive]}
                  onPress={() => setBirthType(item.key)}
                  activeOpacity={0.85}
                >
                  <Image source={item.icon} style={styles.typeIcon} resizeMode="contain" />
                  <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{item.label}</Text>
                  <Text style={[styles.typeSub, active && styles.typeSubActive]}>{item.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Postpartum plan */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('birthBag.postpartumPlanLabel')}</Text>
          <View style={styles.typeRow}>
            {postpartumPlans.map((p) => {
              const active = postpartumPlan === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.typeCard, active && styles.typeCardActive]}
                  onPress={() => setPostpartumPlan(p.key)}
                  activeOpacity={0.85}
                >
                  <Image source={p.icon} style={styles.typeIcon} resizeMode="contain" />
                  <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{p.label}</Text>
                  <Text style={[styles.typeSub, active && styles.typeSubActive]}>{p.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Progress + summary chips */}
        <View style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressLabel}>{t('birthBag.progressLabel')}</Text>
            <Text style={styles.progressValue}>
              {checkedCount}/{totalCount}
              <Text style={styles.progressPct}>{`  (${progressPct}%)`}</Text>
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.summaryChipsRow}>
            <SummaryChip label={t('birthBag.summaryChip.total')} value={totalCount} bg="#F2E6DC" fg="#5D4037" />
            <SummaryChip label={t('birthBag.summaryChip.done')} value={checkedCount} bg="#E8F5E9" fg="#2E7D32" />
            <SummaryChip label={t('birthBag.summaryChip.need')} value={needCount} bg="#FFF3E0" fg="#E65100" />
            <SummaryChip label={t('birthBag.summaryChip.dad')} value={dadCount} bg="#E3F2FD" fg="#1565C0" />
          </View>
          {progressPct === 100 && (
            <View style={styles.progressDoneRow}>
              <Image source={IC_RECO} style={styles.progressDoneIconImg} resizeMode="contain" />
              <Text style={styles.progressDone}>{` ${t('birthBag.progressDone')}`}</Text>
            </View>
          )}
        </View>

        {/* 아빠 모드 — 아빠 담당 항목만 빠르게 보고 남편에게 공유 */}
        <TouchableOpacity
          style={[styles.dadModeToggle, filter === 'dad' && styles.dadModeToggleActive]}
          onPress={() => setFilter(filter === 'dad' ? 'all' : 'dad')}
          activeOpacity={0.85}
        >
          <Text style={[styles.dadModeIcon, filter === 'dad' && styles.dadModeIconActive]}>{'👨'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dadModeTitle, filter === 'dad' && styles.dadModeTitleActive]}>
              {filter === 'dad' ? t('birthBag.dadMode.activeTitle') : t('birthBag.dadMode.title')}
            </Text>
            <Text style={[styles.dadModeSub, filter === 'dad' && styles.dadModeSubActive]}>
              {filter === 'dad'
                ? t('birthBag.dadMode.activeSub', { count: dadCount - checkedCountDad })
                : t('birthBag.dadMode.sub', { count: dadCount })}
            </Text>
          </View>
          {filter === 'dad' && dadCount > 0 ? (
            <TouchableOpacity
              style={styles.dadShareBtn}
              onPress={(e) => { e.stopPropagation(); setShareModalVisible(true); }}
              activeOpacity={0.85}
              hitSlop={6}
            >
              <Text style={styles.dadShareBtnText}>{t('birthBag.dadMode.shareBtn')}</Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>

        {/* 보기 필터 칩 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(['all', 'need', 'dad', 'unassigned', 'hideDone'] as ViewFilter[]).map((f) => {
            const active = filter === f;
            const isDadChip = f === 'dad';
            const label = f === 'all' ? t('birthBag.filter.all')
              : f === 'need' ? t('birthBag.filter.need')
              : f === 'dad' ? t('birthBag.filter.dad', { count: dadCount > 0 ? dadCount : '' }).trim()
              : f === 'unassigned' ? t('birthBag.filter.unassigned')
              : t('birthBag.filter.hideDone');
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  active && (isDadChip ? styles.filterChipActiveDad : styles.filterChipActive),
                  !active && isDadChip && dadCount > 0 && styles.filterChipDadEmph,
                ]}
                onPress={() => setFilter(f)}
                activeOpacity={0.85}
              >
                <Text style={[
                  styles.filterChipText,
                  active && (isDadChip ? styles.filterChipTextActiveDad : styles.filterChipTextActive),
                  !active && isDadChip && dadCount > 0 && styles.filterChipTextDadEmph,
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 추천 배너 1 (진행률 아래) */}
        <RecommendBanner
          title={t('birthBag.recommend.hygiene.title')}
          desc={t('birthBag.recommend.hygiene.desc')}
        />

        {/* Sections */}
        {(['mom', 'baby', 'docs'] as Category[]).map((cat, idx) => {
          const list = itemsByCategory[cat];
          const isCollapsed = collapsed[cat];
          return (
            <View key={cat}>
              <View style={styles.itemSection}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleCollapsed(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemSectionTitle}>{categoryLabel[cat]}</Text>
                  <View style={styles.sectionHeaderRight}>
                    <Text style={styles.sectionCount}>{t('birthBag.itemCount', { count: list.length })}</Text>
                    <Text style={styles.sectionCaret}>{isCollapsed ? '∨' : '∧'}</Text>
                  </View>
                </TouchableOpacity>

                {!isCollapsed && list.map((it) => {
                  const isChecked = !!checked[it.id];
                  const itemStatus = status[it.id] ?? null;
                  const itemOwner = owner[it.id] ?? null;
                  const isNa = itemStatus === 'na';
                  const custom = isCustom(it.id);
                  return (
                    <View key={it.id} style={[
                      styles.itemRow,
                      (isChecked || isNa) && styles.itemRowDim,
                      itemOwner === 'dad' && styles.itemRowDad,
                    ]}>
                      <TouchableOpacity
                        style={[styles.checkbox, isChecked && styles.checkboxChecked]}
                        onPress={() => toggleChecked(it.id)}
                        hitSlop={8}
                      >
                        {isChecked ? <Text style={styles.checkMark}>{'✓'}</Text> : null}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <View style={styles.itemHeaderRow}>
                          <Text
                            style={[styles.itemLabel, isChecked && styles.itemLabelChecked, isNa && styles.itemLabelNa, { flex: 1 }]}
                            numberOfLines={2}
                          >
                            {it.label}
                          </Text>
                          {isSpecialized(it) ? (
                            <View style={styles.essentialBadge}>
                              <Text style={styles.essentialBadgeText}>{t('birthBag.essentialBadge')}</Text>
                            </View>
                          ) : null}
                          {custom ? <View style={styles.customBadge}><Text style={styles.customBadgeText}>{t('birthBag.customBadge')}</Text></View> : null}
                          <TouchableOpacity
                            style={styles.moreBtn}
                            onPress={() => setMoreMenuId(it.id)}
                            hitSlop={8}
                          >
                            <Text style={styles.moreBtnText}>{'⋯'}</Text>
                          </TouchableOpacity>
                        </View>
                        {it.hint ? <Text style={styles.itemHint}>{it.hint}</Text> : null}
                        {/* 완료된 항목은 태그 영역 컴팩트하게 — 태그만 보이고 미설정은 숨김 */}
                        {(isChecked || isNa) ? (
                          (itemStatus || itemOwner) ? (
                            <View style={styles.tagRow}>
                              {itemStatus ? (
                                <View style={[tagStyles.btn, { backgroundColor: statusMeta[itemStatus].bg, paddingVertical: 2 }]}>
                                  <Text style={[tagStyles.text, { color: statusMeta[itemStatus].fg, fontSize: 10 }]}>
                                    {statusMeta[itemStatus].label}
                                  </Text>
                                </View>
                              ) : null}
                              {itemOwner ? (
                                <View style={[tagStyles.btn, { backgroundColor: ownerMeta[itemOwner].bg, paddingVertical: 2 }]}>
                                  <Text style={[tagStyles.text, { color: ownerMeta[itemOwner].fg, fontSize: 10 }]}>
                                    {ownerMeta[itemOwner].label}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null
                        ) : (
                          <View style={styles.tagRow}>
                            <TagButton
                              onPress={() => openPicker(it.id, 'status')}
                              label={itemStatus ? statusMeta[itemStatus].label : t('birthBag.addStatusTag')}
                              bg={itemStatus ? statusMeta[itemStatus].bg : '#FFF0E6'}
                              fg={itemStatus ? statusMeta[itemStatus].fg : '#FF8C5A'}
                            />
                            <TagButton
                              onPress={() => openPicker(it.id, 'owner')}
                              label={itemOwner ? t('birthBag.ownerTag', { owner: ownerMeta[itemOwner].label }) : t('birthBag.addOwnerTag')}
                              bg={itemOwner ? ownerMeta[itemOwner].bg : '#FFF0E6'}
                              fg={itemOwner ? ownerMeta[itemOwner].fg : '#FF8C5A'}
                            />
                          </View>
                        )}
                        {/* 네이티브 커머스 슬롯 — 구매 필요 상태일 때만 / 미체크 상태에서만 */}
                        {!isChecked && itemStatus === 'need' && productHints[it.id] ? (
                          <View style={styles.commerceSlot}>
                            <Text style={styles.commerceSlotIcon}>🛒</Text>
                            <Text style={styles.commerceSlotText} numberOfLines={1}>
                              {productHints[it.id]}
                            </Text>
                            <Text style={styles.commerceSlotArrow}>{'›'}</Text>
                            <Text style={styles.commerceSlotAd}>{t('birthBag.adLabel')}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}

                {!isCollapsed && (
                  <TouchableOpacity
                    style={styles.addItemBtn}
                    onPress={() => setAddModalCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.addItemBtnText}>{t('birthBag.addItemBtn')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {idx === 0 && (
                <RecommendBanner
                  title={t('birthBag.recommend.essential.title')}
                  desc={t('birthBag.recommend.essential.desc')}
                />
              )}
            </View>
          );
        })}

        {/* 숨긴 항목 보기 */}
        {hiddenIds.length > 0 && (
          <TouchableOpacity
            style={styles.hiddenLink}
            onPress={() => setHiddenViewOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.hiddenLinkText}>{t('birthBag.hiddenLink', { count: hiddenIds.length })}</Text>
          </TouchableOpacity>
        )}

        {/* 추천 배너 3 (팁 위) */}
        <RecommendBanner
          title={t('birthBag.recommend.baby.title')}
          desc={t('birthBag.recommend.baby.desc')}
        />

        {/* Tip */}
        <View style={styles.tipCard}>
          <Image source={IC_TIP} style={styles.tipIconImg} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>{t('birthBag.tip.title')}</Text>
            <Text style={styles.tipText}>
              {t('birthBag.tip.text')}
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 담당/상태 picker bottom-sheet */}
      <PickerSheet
        visible={pickerItemId !== null && pickerKind !== null}
        kind={pickerKind}
        currentOwner={pickerItemId ? owner[pickerItemId] ?? null : null}
        currentStatus={pickerItemId ? status[pickerItemId] ?? null : null}
        onPickOwner={(v) => { if (pickerItemId) setItemOwner(pickerItemId, v); closePicker(); }}
        onPickStatus={(v) => { if (pickerItemId) setItemStatus(pickerItemId, v); closePicker(); }}
        onClose={closePicker}
      />

      {/* + 항목 추가 모달 */}
      <AddItemModal
        visible={addModalCategory !== null}
        category={addModalCategory}
        onClose={() => setAddModalCategory(null)}
        onAdd={(label, hint) => {
          if (addModalCategory) addCustomItem(label, hint, addModalCategory);
          setAddModalCategory(null);
        }}
      />

      {/* ⋯ 더보기 메뉴 */}
      <MoreMenuModal
        visible={moreMenuId !== null}
        isCustom={moreMenuId ? isCustom(moreMenuId) : false}
        onHide={() => moreMenuId && hideItem(moreMenuId)}
        onDelete={() => moreMenuId && deleteCustomItem(moreMenuId)}
        onClose={() => setMoreMenuId(null)}
      />

      {/* 숨긴 항목 모달 */}
      <HiddenItemsModal
        visible={hiddenViewOpen}
        items={hiddenItemsResolved}
        onRestore={(id) => restoreItem(id)}
        onClose={() => setHiddenViewOpen(false)}
      />

      {/* 공유 모달 */}
      <Modal visible={shareModalVisible} transparent animationType="fade" onRequestClose={() => setShareModalVisible(false)}>
        <Pressable style={shareStyles.backdrop} onPress={() => setShareModalVisible(false)}>
          <Pressable style={shareStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={shareStyles.title}>{t('birthBag.shareModal.title')}</Text>
            <Text style={shareStyles.subtitle}>
              {t('birthBag.shareModal.subtitle')}
            </Text>
            {sharing ? (
              <View style={shareStyles.loadingWrap}>
                <ActivityIndicator color={COLOR.primary} />
                <Text style={shareStyles.loadingText}>{t('birthBag.shareModal.loading')}</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={shareStyles.optionPrimary}
                  onPress={handleShareNative}
                  activeOpacity={0.85}
                >
                  <Text style={shareStyles.optionPrimaryText}>{t('birthBag.shareModal.optionNative')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={shareStyles.optionSecondary}
                  onPress={handleShareCopy}
                  activeOpacity={0.85}
                >
                  <Text style={shareStyles.optionSecondaryText}>{t('birthBag.shareModal.optionCopy')}</Text>
                </TouchableOpacity>
              </>
            )}
            <Text style={shareStyles.privacyNote}>
              {t('birthBag.shareModal.privacyNote')}
            </Text>
            <TouchableOpacity
              style={shareStyles.cancelBtn}
              onPress={() => setShareModalVisible(false)}
              activeOpacity={0.7}
              disabled={sharing}
            >
              <Text style={shareStyles.cancelText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <GuideCarousel visible={guideVisible} pages={BIRTHBAG_GUIDE} onClose={closeGuide} onComplete={closeGuide} accent="#7CA46E" />
    </View>
  );
}

/* ============================================================== */
/*  Sub-components                                                 */
/* ============================================================== */

function SummaryChip({ label, value, bg, fg }: { label: string; value: number; bg: string; fg: string }) {
  return (
    <View style={[chipStyles.chip, { backgroundColor: bg }]}>
      <Text style={[chipStyles.chipLabel, { color: fg, opacity: 0.8 }]}>{label}</Text>
      <Text style={[chipStyles.chipValue, { color: fg }]}>{value}</Text>
    </View>
  );
}

function TagButton({
  label, bg, fg, onPress,
}: { label: string; bg: string; fg: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[tagStyles.btn, { backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={6}
    >
      <Text style={[tagStyles.text, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RecommendBanner({ title, desc }: { title: string; desc: string }) {
  return (
    <View style={recoStyles.banner}>
      <View style={recoStyles.iconWrap}>
        <Image source={IC_RECO} style={recoStyles.iconImg} resizeMode="contain" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={recoStyles.title}>{title}</Text>
        <Text style={recoStyles.desc}>{desc}</Text>
      </View>
      <Text style={recoStyles.arrow}>{'›'}</Text>
    </View>
  );
}

function PickerSheet({
  visible, kind, currentOwner, currentStatus, onPickOwner, onPickStatus, onClose,
}: {
  visible: boolean;
  kind: 'owner' | 'status' | null;
  currentOwner: Owner;
  currentStatus: Status;
  onPickOwner: (v: Owner) => void;
  onPickStatus: (v: Status) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ownerMeta = useMemo(() => getOwnerMeta(t), [t]);
  const statusMeta = useMemo(() => getStatusMeta(t), [t]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pickerStyles.backdrop} onPress={onClose}>
        <Pressable style={pickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={pickerStyles.title}>
            {kind === 'owner' ? t('birthBag.picker.ownerTitle') : t('birthBag.picker.statusTitle')}
          </Text>
          {kind === 'owner' ? (
            <>
              <PickerOption
                label={ownerMeta.mom.label}
                active={currentOwner === 'mom'}
                bg={ownerMeta.mom.bg}
                fg={ownerMeta.mom.fg}
                onPress={() => onPickOwner('mom')}
              />
              <PickerOption
                label={ownerMeta.dad.label}
                active={currentOwner === 'dad'}
                bg={ownerMeta.dad.bg}
                fg={ownerMeta.dad.fg}
                onPress={() => onPickOwner('dad')}
              />
              <PickerOption
                label={ownerMeta.both.label}
                active={currentOwner === 'both'}
                bg={ownerMeta.both.bg}
                fg={ownerMeta.both.fg}
                onPress={() => onPickOwner('both')}
              />
              <PickerOption
                label={t('birthBag.picker.ownerUnset')}
                active={currentOwner === null}
                bg="#F2EFEC"
                fg="#9A9A9F"
                onPress={() => onPickOwner(null)}
              />
            </>
          ) : (
            <>
              <PickerOption
                label={statusMeta.need.label}
                active={currentStatus === 'need'}
                bg={statusMeta.need.bg}
                fg={statusMeta.need.fg}
                onPress={() => onPickStatus('need')}
              />
              <PickerOption
                label={statusMeta.ready.label}
                active={currentStatus === 'ready'}
                bg={statusMeta.ready.bg}
                fg={statusMeta.ready.fg}
                onPress={() => onPickStatus('ready')}
              />
              <PickerOption
                label={statusMeta.packed.label}
                active={currentStatus === 'packed'}
                bg={statusMeta.packed.bg}
                fg={statusMeta.packed.fg}
                onPress={() => onPickStatus('packed')}
              />
              <PickerOption
                label={statusMeta.na.label}
                active={currentStatus === 'na'}
                bg={statusMeta.na.bg}
                fg={statusMeta.na.fg}
                onPress={() => onPickStatus('na')}
              />
              <PickerOption
                label={t('birthBag.picker.statusClear')}
                active={currentStatus === null}
                bg="#F2EFEC"
                fg="#9A9A9F"
                onPress={() => onPickStatus(null)}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickerOption({
  label, active, bg, fg, onPress,
}: { label: string; active: boolean; bg: string; fg: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[pickerStyles.option, { backgroundColor: bg }, active && pickerStyles.optionActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[pickerStyles.optionText, { color: fg }]}>{label}</Text>
      {active ? <Text style={[pickerStyles.optionCheck, { color: fg }]}>{'✓'}</Text> : null}
    </TouchableOpacity>
  );
}

function AddItemModal({
  visible, category, onAdd, onClose,
}: {
  visible: boolean;
  category: Category | null;
  onAdd: (label: string, hint: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const categoryLabel = useMemo(() => getCategoryLabel(t), [t]);
  const [label, setLabel] = useState('');
  const [hint, setHint] = useState('');
  useEffect(() => { if (!visible) { setLabel(''); setHint(''); } }, [visible]);
  const submit = () => {
    if (!label.trim()) return;
    onAdd(label, hint);
  };
  const catLabel = category ? categoryLabel[category] : '';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={pickerStyles.backdrop} onPress={onClose}>
          <Pressable style={pickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={pickerStyles.title}>{t('birthBag.addModal.title', { category: catLabel })}</Text>
            <Text style={addStyles.label}>{t('birthBag.addModal.nameLabel')}</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={t('birthBag.addModal.namePlaceholder')}
              placeholderTextColor="#B8B0A6"
              style={addStyles.input}
              maxLength={40}
              autoFocus
            />
            <Text style={addStyles.label}>{t('birthBag.addModal.hintLabel')}</Text>
            <TextInput
              value={hint}
              onChangeText={setHint}
              placeholder={t('birthBag.addModal.hintPlaceholder')}
              placeholderTextColor="#B8B0A6"
              style={addStyles.input}
              maxLength={60}
            />
            <View style={addStyles.btnRow}>
              <TouchableOpacity style={addStyles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={addStyles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[addStyles.submitBtn, !label.trim() && addStyles.submitBtnDisabled]}
                onPress={submit}
                activeOpacity={0.85}
                disabled={!label.trim()}
              >
                <Text style={addStyles.submitText}>{t('birthBag.addModal.submit')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MoreMenuModal({
  visible, isCustom, onHide, onDelete, onClose,
}: {
  visible: boolean;
  isCustom: boolean;
  onHide: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pickerStyles.backdrop} onPress={onClose}>
        <Pressable style={pickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={pickerStyles.title}>{t('birthBag.moreMenu.title')}</Text>
          <TouchableOpacity
            style={[pickerStyles.option, { backgroundColor: '#FFF8E1' }]}
            onPress={onHide}
            activeOpacity={0.85}
          >
            <Text style={[pickerStyles.optionText, { color: '#7E5400' }]}>{t('birthBag.moreMenu.hide')}</Text>
          </TouchableOpacity>
          {isCustom && (
            <TouchableOpacity
              style={[pickerStyles.option, { backgroundColor: '#FFEBEE' }]}
              onPress={onDelete}
              activeOpacity={0.85}
            >
              <Text style={[pickerStyles.optionText, { color: '#C62828' }]}>{t('birthBag.moreMenu.deleteForever')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[pickerStyles.option, { backgroundColor: '#F2EFEC' }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={[pickerStyles.optionText, { color: '#9A9A9F' }]}>{t('common.close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function HiddenItemsModal({
  visible, items, onRestore, onClose,
}: {
  visible: boolean;
  items: BagItem[];
  onRestore: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const categoryLabel = useMemo(() => getCategoryLabel(t), [t]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pickerStyles.backdrop} onPress={onClose}>
        <Pressable style={[pickerStyles.sheet, { maxHeight: '70%' }]} onPress={(e) => e.stopPropagation()}>
          <Text style={pickerStyles.title}>{t('birthBag.hiddenModal.title', { count: items.length })}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {items.length === 0 ? (
              <Text style={hiddenStyles.empty}>{t('birthBag.hiddenModal.empty')}</Text>
            ) : (
              items.map((it) => (
                <View key={it.id} style={hiddenStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={hiddenStyles.label}>{it.label}</Text>
                    <Text style={hiddenStyles.cat}>{categoryLabel[it.category]}</Text>
                  </View>
                  <TouchableOpacity
                    style={hiddenStyles.restoreBtn}
                    onPress={() => onRestore(it.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={hiddenStyles.restoreText}>{t('birthBag.hiddenModal.restore')}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
          <TouchableOpacity
            style={[pickerStyles.option, { backgroundColor: '#F2EFEC', marginTop: 8 }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={[pickerStyles.optionText, { color: '#9A9A9F', textAlign: 'center', flex: 1 }]}>{t('common.close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ============================================================== */
/*  Styles                                                         */
/* ============================================================== */

const COLOR = {
  bg: '#F8F5F2',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#9A9A9F',
  border: '#EFE6DC',
  primary: '#FF8C5A',
  primaryLight: '#FFF0E6',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 60 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLOR.border,
  },
  backArrow: { fontSize: 20, color: COLOR.text, fontWeight: '700' },
  topTitle: { fontSize: 16, fontWeight: '700', color: COLOR.text },
  shareBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: COLOR.primaryLight,
    borderWidth: 1,
    borderColor: COLOR.primary,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.primary,
  },

  hero: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: COLOR.text, marginBottom: 4 },
  heroSub: { fontSize: 12, color: COLOR.textSub, fontWeight: '600', lineHeight: 18 },

  section: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLOR.textSub,
    marginBottom: 6,
    letterSpacing: 0.5,
  },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLOR.border,
  },
  typeCardActive: {
    backgroundColor: COLOR.primaryLight,
    borderColor: COLOR.primary,
  },
  typeEmoji: { fontSize: 20, marginBottom: 4 },
  typeIcon: { width: 32, height: 32, marginBottom: 4 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: COLOR.text },
  typeLabelActive: { color: COLOR.primary },
  typeSub: { fontSize: 10, fontWeight: '600', color: COLOR.textSub, marginTop: 2 },
  typeSubActive: { color: COLOR.primary },

  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: { fontSize: 13, fontWeight: '700', color: COLOR.text },
  progressValue: { fontSize: 15, fontWeight: '700', color: COLOR.primary },
  progressPct: { fontSize: 12, color: COLOR.textSub, fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F2E6DC',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLOR.primary,
    borderRadius: 4,
  },
  summaryChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  progressDone: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#43A047',
    textAlign: 'center',
  },
  progressDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  progressDoneIconImg: { width: 18, height: 18 },

  filterRow: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    gap: 6,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLOR.border,
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: COLOR.primary,
    borderColor: COLOR.primary,
  },
  // 아빠 담당 chip — 비활성 시 파랑 강조 (눈에 띄게)
  filterChipDadEmph: {
    backgroundColor: '#E3F2FD',
    borderColor: '#90CAF9',
  },
  // 아빠 담당 chip — 활성 시 진한 파랑 (다른 chip과 구분)
  filterChipActiveDad: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.textSub,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipTextDadEmph: {
    color: '#1565C0',
    fontWeight: '700',
  },
  filterChipTextActiveDad: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  itemSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  itemSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 4,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: COLOR.textSub,
  },
  sectionCaret: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.textLight,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  customBadge: {
    backgroundColor: '#FFF0E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 1,
  },
  customBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLOR.primary,
  },
  // '필수' 배지 — 분만/산후 특화 항목 표시
  essentialBadge: {
    backgroundColor: '#FFE8EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 1,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#F8BBD0',
  },
  essentialBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#C2185B',
  },
  moreBtn: {
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 12,
  },
  moreBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLOR.textLight,
    lineHeight: 16,
  },
  addItemBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLOR.primaryLight,
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: '#FFFAF6',
  },
  addItemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.primary,
  },
  hiddenLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  hiddenLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.textSub,
    textDecorationLine: 'underline',
  },

  // 아빠 담당 항목 — 좌측 파란 막대로 강조 (한눈에 식별)
  itemRowDad: {
    borderLeftWidth: 3,
    borderLeftColor: '#1976D2',
    paddingLeft: 8,
    backgroundColor: '#F8FBFF',
    borderRadius: 6,
  },
  // 아빠 모드 토글 — 진행률 카드와 필터 사이에 배치
  dadModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BBDEFB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  dadModeToggleActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
  },
  dadModeIcon: {
    fontSize: 22,
    opacity: 0.85,
  },
  dadModeIconActive: {
    opacity: 1,
  },
  dadModeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1565C0',
  },
  dadModeTitleActive: {
    color: '#0D47A1',
  },
  dadModeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976D2',
    marginTop: 1,
    opacity: 0.85,
  },
  dadModeSubActive: {
    opacity: 1,
  },
  dadShareBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1976D2',
  },
  dadShareBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E6DC',
  },
  itemRowDim: { opacity: 0.55 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#D6CDC2',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLOR.primary,
    borderColor: COLOR.primary,
  },
  checkMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 14 },
  itemLabel: { fontSize: 13, fontWeight: '600', color: COLOR.text, lineHeight: 18 },
  itemLabelChecked: { textDecorationLine: 'line-through', color: COLOR.textLight },
  itemLabelNa: { color: COLOR.textLight },
  itemHint: { fontSize: 11, color: COLOR.textSub, fontWeight: '600', marginTop: 2 },

  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  // 네이티브 커머스 미니 슬롯 — 구매필요 항목 하단 (파스텔 톤 유지)
  commerceSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#FFE8D6',
  },
  commerceSlotIcon: {
    fontSize: 13,
  },
  commerceSlotText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5E3C',
  },
  commerceSlotArrow: {
    fontSize: 14,
    color: '#B5895C',
    fontWeight: '700',
  },
  commerceSlotAd: {
    fontSize: 8,
    fontWeight: '700',
    color: '#B5895C',
    backgroundColor: '#FFF0E0',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },

  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  tipIcon: { fontSize: 18, marginTop: 2 },
  tipIconImg: { width: 28, height: 28, marginTop: 2 },
  tipTitle: { fontSize: 13, fontWeight: '700', color: '#7E5400', marginBottom: 4 },
  tipText: { fontSize: 12, color: '#7E5400', fontWeight: '600', lineHeight: 18 },
});

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  chipLabel: { fontSize: 10, fontWeight: '700' },
  chipValue: { fontSize: 13, fontWeight: '700' },
});

const tagStyles = StyleSheet.create({
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});

const recoStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0E6DC',
    gap: 10,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#FFF0E6',
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 16 },
  iconImg: { width: 22, height: 22 },
  title: { fontSize: 12, fontWeight: '700', color: COLOR.text },
  desc: { fontSize: 11, color: COLOR.textSub, fontWeight: '600', marginTop: 1 },
  arrow: { fontSize: 18, color: COLOR.textLight, fontWeight: '700' },
});

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionActive: {
    borderWidth: 1.5,
    borderColor: COLOR.text,
  },
  optionText: { fontSize: 14, fontWeight: '600' },
  optionCheck: { fontSize: 16, fontWeight: '700' },
});

const addStyles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLOR.textSub,
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#F7F2EC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.text,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F2EFEC',
    alignItems: 'center',
  },
  cancelText: { fontSize: 13, fontWeight: '700', color: COLOR.textSub },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLOR.primary,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#F0D0BD' },
  submitText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});

const hiddenStyles = StyleSheet.create({
  empty: {
    fontSize: 13,
    color: COLOR.textSub,
    textAlign: 'center',
    paddingVertical: 24,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E6DC',
  },
  label: { fontSize: 13, fontWeight: '700', color: COLOR.text },
  cat: { fontSize: 11, fontWeight: '600', color: COLOR.textSub, marginTop: 1 },
  restoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLOR.primaryLight,
  },
  restoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.primary,
  },
});

const shareStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLOR.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLOR.textSub,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLOR.textSub,
  },
  optionPrimary: {
    backgroundColor: COLOR.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  optionPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  optionSecondary: {
    backgroundColor: COLOR.primaryLight,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLOR.primary,
  },
  optionSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.primary,
  },
  privacyNote: {
    fontSize: 11,
    fontWeight: '600',
    color: COLOR.textLight,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 17,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.textSub,
  },
});
