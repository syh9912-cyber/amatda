/**
 * 예측 알람 설정 — 최근 3일 수유/수면/기상 패턴으로 자동 생성되는 알람을
 * 전체 on/off · 알림 시점(분) · 슬롯별 개별 on/off 로 관리.
 *
 * 데이터: GET/PUT /children/:id/alarm-settings
 *   - settings: { enabled, offsetMin, disabledKeys[] }
 *   - slots: [{ key, type, timeMin, label, on }]  (서버가 현재 패턴으로 계산)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { childApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';

const ACCENT = '#FF8C5A';
const OFFSETS = [10, 20, 30, 45, 60];

interface Slot { key: string; type: string; timeMin: number; label: string; on: boolean }
interface Settings { enabled: boolean; offsetMin: number; disabledKeys: string[] }

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
const TYPE_EMOJI: Record<string, string> = { feeding: '🍼', sleep: '😴', wake: '☀️' };

export default function AlarmSettingsScreen() {
  const params = useLocalSearchParams<{ childId?: string }>();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const childId = params.childId || selectedChild?.id || '';
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({ enabled: true, offsetMin: 30, disabledKeys: [] });
  const [slots, setSlots] = useState<Slot[]>([]);

  const load = useCallback(async () => {
    if (!childId) { setLoading(false); return; }
    try {
      const res = await childApi.getAlarmSettings(childId);
      const d = res.data?.data as { settings: Settings; slots: Slot[] };
      if (d?.settings) setSettings({ ...d.settings, disabledKeys: d.settings.disabledKeys ?? [] });
      if (Array.isArray(d?.slots)) setSlots(d.slots);
    } catch {
      Alert.alert('오류', '알람 설정을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => { load(); }, [load]);

  const persist = useCallback(async (next: Settings) => {
    setSettings(next);
    setSaving(true);
    try {
      await childApi.updateAlarmSettings(childId, next as unknown as Record<string, unknown>);
    } catch {
      Alert.alert('오류', '저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, [childId]);

  const toggleMaster = (v: boolean) => persist({ ...settings, enabled: v });
  const setOffset = (m: number) => persist({ ...settings, offsetMin: m });
  const toggleSlot = (key: string, on: boolean) => {
    const disabled = new Set(settings.disabledKeys);
    if (on) disabled.delete(key); else disabled.add(key);
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, on } : s)));
    persist({ ...settings, disabledKeys: [...disabled] });
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>⏰ 알람 설정</Text>
        <View style={{ width: 32 }}>{saving ? <ActivityIndicator size="small" color={ACCENT} /> : null}</View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={ACCENT} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.desc}>
            최근 3일 동안 기록한 수유·수면·기상 시간을 분석해, 평소 그 시간 전에 미리 알려드려요.
            기록이 없으면 알람도 생기지 않아요.
          </Text>

          {/* 전체 on/off */}
          <View style={s.rowCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>예측 알람 켜기</Text>
              <Text style={s.rowSub}>끄면 모든 예측 알람이 오지 않아요</Text>
            </View>
            <Switch value={settings.enabled} onValueChange={toggleMaster}
              trackColor={{ true: ACCENT, false: '#D1D5DB' }} thumbColor="#FFF" />
          </View>

          {/* 알림 시점 */}
          <Text style={s.sectionLabel}>알림 시점</Text>
          <View style={s.offsetRow}>
            {OFFSETS.map((m) => (
              <TouchableOpacity key={m}
                style={[s.offsetChip, settings.offsetMin === m && s.offsetChipOn, !settings.enabled && s.dim]}
                disabled={!settings.enabled}
                onPress={() => setOffset(m)} activeOpacity={0.8}>
                <Text style={[s.offsetText, settings.offsetMin === m && s.offsetTextOn]}>{m}분 전</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 슬롯 목록 */}
          <Text style={s.sectionLabel}>알람 목록 (패턴 기반)</Text>
          {slots.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>
                아직 패턴이 없어요.{'\n'}수유·수면·기상을 기록하면 다음 날부터 알람이 자동으로 생겨요.
              </Text>
            </View>
          ) : (
            slots.map((slot) => (
              <View key={slot.key} style={[s.slotCard, !settings.enabled && s.dim]}>
                <Text style={s.slotEmoji}>{TYPE_EMOJI[slot.type] ?? '⏰'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.slotLabel}>{slot.label}</Text>
                  <Text style={s.slotTime}>{hhmm(slot.timeMin)} · {settings.offsetMin}분 전 알림</Text>
                </View>
                <Switch value={slot.on} disabled={!settings.enabled}
                  onValueChange={(v) => toggleSlot(slot.key, v)}
                  trackColor={{ true: ACCENT, false: '#D1D5DB' }} thumbColor="#FFF" />
              </View>
            ))
          )}

          <Text style={s.foot}>알람 목록은 기록이 쌓이면 자동으로 업데이트돼요.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 30, color: '#1A1A1A', marginTop: -4 },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 18, paddingBottom: 40 },
  desc: { fontSize: 13.5, color: '#6B7280', lineHeight: 20, marginBottom: 18 },
  rowCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#EFEFEC',
  },
  rowLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  rowSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#9A6635', marginTop: 22, marginBottom: 10 },
  offsetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  offsetChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB',
  },
  offsetChipOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  offsetText: { fontSize: 13.5, fontWeight: '700', color: '#6B7280' },
  offsetTextOn: { color: '#FFF' },
  slotCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#EFEFEC', marginBottom: 10,
  },
  slotEmoji: { fontSize: 24 },
  slotLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  slotTime: { fontSize: 12.5, color: '#9CA3AF', marginTop: 2 },
  empty: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 18 },
  emptyText: { fontSize: 13, color: '#9A6635', lineHeight: 20, textAlign: 'center' },
  dim: { opacity: 0.45 },
  foot: { fontSize: 11.5, color: '#B6B6B0', textAlign: 'center', marginTop: 18 },
});
