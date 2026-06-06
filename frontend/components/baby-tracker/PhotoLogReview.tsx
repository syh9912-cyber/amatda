/**
 * PhotoLogReview — 어린이집 알림장/기록지 "사진"으로 육아 기록 일괄 입력.
 *
 * 흐름: 사진 찍기/갤러리 선택 → 리사이즈 → Gemini 비전 파싱(/tracker/photo-parse)
 *      → 추출된 기록 "확인 리스트"(빼기 가능) → 저장.
 *
 * ★ OCR/AI라 100%가 아니므로 "저장 전 확인" 단계 필수.
 */
import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { pickImageFromLibrary, pickImageFromCamera } from '../../utils/imagePicker';
import { trackerApi } from '../../services/api';
import { loadRecords, saveRecords } from '../../features/baby-tracker/storage';
import type { TrackerRecord } from '../../features/baby-tracker/types';
import { resolveAuthorMeta, stampAuthor } from '../../features/baby-tracker/author';
import { useTrackerStore } from '../../stores/trackerStore';

interface ParsedPhotoRecord {
  type: string;
  subType: string;
  date?: string;
  time?: string;
  endTime?: string;
  amount?: number | null;
  duration?: number | null;
  note?: string | null;
}
interface ReviewItem extends ParsedPhotoRecord {
  _id: string;
  include: boolean;
}

interface Props {
  visible: boolean;
  childId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  feeding: '수유/식사', sleep: '수면', diaper: '배변', medication: '투약',
};
const SUB_LABEL: Record<string, string> = {
  breast: '모유', formula: '분유', baby_food: '이유식/밥', snack: '간식',
  pee: '소변', poop: '대변', both: '소변+대변',
  sleep: '수면', fever: '해열제', antibiotic: '항생제', vitamin: '비타민', other: '약',
};

function summarize(r: ParsedPhotoRecord): string {
  const parts: string[] = [SUB_LABEL[r.subType] || TYPE_LABEL[r.type] || r.type];
  if (r.type === 'feeding' && r.amount) parts.push(`${r.amount}ml`);
  if (r.type === 'sleep' && r.endTime) parts.push(`~${r.endTime}`);
  if (r.duration) parts.push(`${r.duration}분`);
  if (r.note) parts.push(`· ${r.note}`);
  return parts.join(' ');
}

// 사용자가 편집한 시각을 HH:MM 으로 정규화 (잘못된 입력은 현재시각)
function normTime(raw: string | undefined, now: Date): string {
  const t = (raw || '').trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) return t.length === 4 ? `0${t}` : t;
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const COLOR = { accent: '#FF8C5A', text: '#1C1C1E', sub: '#636366', border: '#E5E5EA' };

export function PhotoLogReview({ visible, childId, onClose, onSaved }: Props) {
  const [phase, setPhase] = useState<'choose' | 'parsing' | 'review' | 'saving'>('choose');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('choose'); setItems([]); setPreviewUri(null);
  }, []);

  const handleClose = useCallback(() => {
    if (phase === 'parsing' || phase === 'saving') return;
    reset(); onClose();
  }, [phase, reset, onClose]);

  const runParse = useCallback(async (uri: string) => {
    setPreviewUri(uri);
    setPhase('parsing');
    try {
      // 리사이즈 + base64 (전송량 절감)
      const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, base64: true, format: ImageManipulator.SaveFormat.JPEG },
      );
      if (!manip.base64) throw new Error('no base64');
      const res = await trackerApi.photoParse(manip.base64, 'image/jpeg');
      const data = res.data?.data as { records?: ParsedPhotoRecord[] } | undefined;
      const records = Array.isArray(data?.records) ? data!.records : [];
      if (records.length === 0) {
        Alert.alert('알림', '사진에서 기록을 찾지 못했어요. 더 선명한 사진으로 다시 시도해주세요.');
        reset();
        return;
      }
      setItems(records.map((r, i) => ({ ...r, _id: `${i}`, include: true })));
      setPhase('review');
    } catch {
      Alert.alert('오류', '사진 분석에 실패했어요. 다시 시도해주세요.');
      reset();
    }
  }, [reset]);

  const pickCamera = useCallback(async () => {
    const p = await pickImageFromCamera({ quality: 0.9 });
    if (p) runParse(p.uri);
  }, [runParse]);

  const pickGallery = useCallback(async () => {
    const p = await pickImageFromLibrary({ quality: 0.9 });
    if (p) runParse(p.uri);
  }, [runParse]);

  const toggleInclude = useCallback((id: string) => {
    setItems((prev) => prev.map((it) => (it._id === id ? { ...it, include: !it.include } : it)));
  }, []);

  const setItemTime = useCallback((id: string, time: string) => {
    setItems((prev) => prev.map((it) => (it._id === id ? { ...it, time } : it)));
  }, []);

  // 사진 1장 = 보통 하루 → 날짜는 상단에서 한 번에 전체 적용
  const setAllDates = useCallback((date: string) => {
    setItems((prev) => prev.map((it) => ({ ...it, date })));
  }, []);
  const setAllToday = useCallback(() => {
    const now = new Date();
    const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setAllDates(t);
  }, [setAllDates]);

  const handleSave = useCallback(async () => {
    if (!childId) return;
    const chosen = items.filter((it) => it.include);
    if (chosen.length === 0) { Alert.alert('알림', '저장할 기록을 1개 이상 선택해주세요.'); return; }
    setPhase('saving');
    try {
      // 공동육아: 초대받은 가족이 사진으로 일괄 기록하면 작성자 라벨 주입 (소유자는 no-op)
      const authorMeta = await resolveAuthorMeta(childId);
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const byDate: Record<string, TrackerRecord[]> = {};
      chosen.forEach((r, i) => {
        const date = r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : todayStr;
        const rec: TrackerRecord = stampAuthor({
          id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          type: r.type as TrackerRecord['type'],
          subType: r.subType,
          time: normTime(r.time, now),
          endTime: r.endTime || undefined,
          amount: r.amount ?? undefined,
          duration: r.duration ?? undefined,
          note: r.note || undefined,
          createdAt: new Date().toISOString(),
        }, authorMeta);
        (byDate[date] ||= []).push(rec);
      });
      for (const [date, recs] of Object.entries(byDate)) {
        const existing = await loadRecords(childId, date);
        await saveRecords(childId, date, [...existing, ...recs]);
      }
      useTrackerStore.getState().bump();
      reset();
      onSaved();
      Alert.alert('완료', `${chosen.length}건 기록 저장 완료`);
    } catch {
      Alert.alert('오류', '저장에 실패했어요.');
      setPhase('review');
    }
  }, [childId, items, reset, onSaved]);

  const includedCount = items.filter((it) => it.include).length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      {/* 안전영역: New Arch 에서 RN Modal 내 safe-area-context 측정이 불안정 →
          iOS 노치/다이내믹아일랜드(최대 ~59pt)를 덮는 고정 상단 패딩으로 확실히 처리 */}
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 24) }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={phase === 'parsing' || phase === 'saving'}>
            <Text style={[styles.cancel, (phase === 'parsing' || phase === 'saving') && { opacity: 0.4 }]}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.title}>사진으로 기록</Text>
          <View style={{ width: 36 }} />
        </View>

        {phase === 'choose' && (
          <View style={styles.choose}>
            <Text style={styles.chooseDesc}>
              어린이집 알림장이나 손글씨 기록지, 다른 앱 캡처 사진을 찍거나 골라주세요.{'\n'}
              AI가 수유·수면·배변 등을 자동으로 읽어드려요.
            </Text>
            <TouchableOpacity style={styles.bigBtn} onPress={pickCamera} activeOpacity={0.85}>
              <Text style={styles.bigBtnText}>📷  사진 찍기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bigBtn, styles.bigBtnAlt]} onPress={pickGallery} activeOpacity={0.85}>
              <Text style={[styles.bigBtnText, { color: COLOR.accent }]}>🖼  갤러리에서 선택</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'parsing' && (
          <View style={styles.center}>
            {previewUri && <Image source={{ uri: previewUri }} style={styles.preview} contentFit="contain" />}
            <ActivityIndicator color={COLOR.accent} style={{ marginTop: 16 }} />
            <Text style={styles.parsingText}>사진에서 기록을 읽는 중...</Text>
          </View>
        )}

        {(phase === 'review' || phase === 'saving') && (
          <>
            <Text style={styles.reviewHint}>읽어온 기록이에요. 틀린 건 빼고 저장하세요.</Text>

            {/* 날짜 — 전체 기록에 한 번에 적용 (사진 1장 = 보통 하루). 알림장 날짜 자동, 틀리면 수정/오늘 */}
            <View style={styles.dateBar}>
              <Text style={styles.dateBarLabel}>{'📅 날짜'}</Text>
              <TextInput
                style={styles.dateInput}
                value={items[0]?.date || ''}
                onChangeText={setAllDates}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#C7C7CC"
                maxLength={10}
                keyboardType="numbers-and-punctuation"
                editable={phase !== 'saving'}
              />
              <TouchableOpacity
                style={styles.todayBtn}
                onPress={setAllToday}
                disabled={phase === 'saving'}
                activeOpacity={0.8}
              >
                <Text style={styles.todayBtnText}>{'오늘'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dateBarHint}>{'모든 기록에 적용돼요'}</Text>

            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              {items.map((it) => (
                <TouchableOpacity
                  key={it._id}
                  style={[styles.row, !it.include && styles.rowOff]}
                  onPress={() => toggleInclude(it._id)}
                  activeOpacity={0.7}
                  disabled={phase === 'saving'}
                >
                  <View style={[styles.typeTag, !it.include && { opacity: 0.4 }]}>
                    <Text style={styles.typeTagText}>{TYPE_LABEL[it.type] || it.type}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowSummary, !it.include && styles.rowTextOff]}>{summarize(it)}</Text>
                    <View style={styles.timeEditRow}>
                      <Text style={styles.timeIcon}>🕐</Text>
                      <TextInput
                        style={[styles.timeInput, !it.include && styles.rowTextOff]}
                        value={it.time || ''}
                        onChangeText={(t) => setItemTime(it._id, t)}
                        placeholder="HH:MM"
                        placeholderTextColor="#C7C7CC"
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        editable={it.include && phase !== 'saving'}
                      />
                      {it.date ? <Text style={styles.rowDate}>{it.date}</Text> : null}
                    </View>
                  </View>
                  <Text style={[styles.toggleMark, it.include ? { color: COLOR.accent } : { color: '#C7C7CC' }]}>
                    {it.include ? '✓' : '제외'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.saveBtn, phase === 'saving' && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={phase === 'saving' || includedCount === 0}
                activeOpacity={0.85}
              >
                {phase === 'saving' ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>{`${includedCount}건 저장`}</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: COLOR.border,
  },
  cancel: { fontSize: 15, color: COLOR.sub, width: 36 },
  title: { fontSize: 17, fontWeight: '700', color: COLOR.text },
  choose: { padding: 24, gap: 14 },
  chooseDesc: { fontSize: 14, color: COLOR.sub, lineHeight: 21, marginBottom: 8 },
  bigBtn: { backgroundColor: COLOR.accent, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  bigBtnAlt: { backgroundColor: '#FFF0E6', borderWidth: 1, borderColor: '#FFD2B3' },
  bigBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  preview: { width: '80%', height: 280, borderRadius: 12, backgroundColor: '#F2F2F7' },
  parsingText: { marginTop: 10, fontSize: 14, color: COLOR.sub },
  reviewHint: { fontSize: 13, color: COLOR.sub, paddingHorizontal: 16, paddingVertical: 12 },
  dateBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  dateBarLabel: { fontSize: 13, color: COLOR.text, fontWeight: '700' },
  dateInput: {
    flex: 1, fontSize: 14, color: COLOR.text, fontWeight: '600',
    borderWidth: 1, borderColor: '#FFD2B3', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7, textAlign: 'center',
  },
  todayBtn: { backgroundColor: COLOR.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  todayBtnText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
  dateBarHint: { fontSize: 11.5, color: COLOR.sub, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0',
  },
  rowOff: { backgroundColor: '#FAFAFA' },
  typeTag: { backgroundColor: '#FFF0E6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 56, alignItems: 'center' },
  typeTagText: { fontSize: 12, fontWeight: '700', color: COLOR.accent },
  rowSummary: { fontSize: 14.5, color: COLOR.text, fontWeight: '600' },
  timeEditRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  timeIcon: { fontSize: 11 },
  timeInput: {
    fontSize: 13, color: COLOR.text, fontWeight: '600',
    borderWidth: 1, borderColor: '#FFD2B3', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, minWidth: 64, textAlign: 'center',
  },
  rowDate: { fontSize: 11.5, color: COLOR.sub, marginLeft: 4 },
  rowTextOff: { color: '#C7C7CC', textDecorationLine: 'line-through' },
  toggleMark: { fontSize: 13, fontWeight: '700' },
  footer: { padding: 16, borderTopWidth: 0.5, borderTopColor: COLOR.border },
  saveBtn: { backgroundColor: COLOR.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
