/**
 * 맘스톡 위치 등록 화면.
 * - GPS 자동 또는 수동 좌표 입력
 * - 위치는 반경 매칭(맘스톡 5/10/50/100km)에 사용
 * - 아이 출생연도(동갑 매칭) 자동 첨부
 *
 * 임시 단계: GPS 권한 + reverse geocoding (expo-location).
 * 수동 입력은 위·경도 직접 입력 모달로 단순화 (추후 주소 검색으로 개선 가능).
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, TextInput, Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { momLocationApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';

const COLOR = {
  bg: '#F8F5F2',
  card: '#FFFFFF',
  border: '#E5E5EA',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#9A9A9F',
  primary: '#FF8C5A',
  primaryLight: '#FFF0E6',
};

interface SavedLocation {
  hasLocation: boolean;
  lat?: number;
  lng?: number;
  locationLabel?: string;
  babyBirthYear?: number | null;
}

function getBabyBirthYear(child: { birthDate?: string | null; isPregnant?: boolean; dueDate?: string | null } | null): number | null {
  if (!child) return null;
  if (child.isPregnant) {
    if (child.dueDate) {
      const y = new Date(child.dueDate).getFullYear();
      if (!isNaN(y)) return y;
    }
    return null;
  }
  if (child.birthDate) {
    const y = new Date(child.birthDate).getFullYear();
    if (!isNaN(y)) return y;
  }
  return null;
}

export default function MomLocationSetupScreen() {
  const insets = useSafeAreaInsets();
  const child = useChildStore((s) => s.selectedChild);
  const babyBirthYear = getBabyBirthYear(child);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saved, setSaved] = useState<SavedLocation>({ hasLocation: false });
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [label, setLabel] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await momLocationApi.get();
      const data = res.data?.data as SavedLocation | undefined;
      if (data?.hasLocation) {
        setSaved(data);
        setLat(String(data.lat ?? ''));
        setLng(String(data.lng ?? ''));
        setLabel(data.locationLabel ?? '');
      }
    } catch {
      // first time — empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const useGps = async () => {
    setGpsLoading(true);
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('위치 권한 필요', '위치 권한이 거부됐어요. 설정에서 권한을 켜거나 수동으로 입력해주세요.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const newLat = pos.coords.latitude;
      const newLng = pos.coords.longitude;
      setLat(newLat.toFixed(6));
      setLng(newLng.toFixed(6));

      // reverse geocoding (가능하면 동·구 이름 표시)
      try {
        const places = await Location.reverseGeocodeAsync({ latitude: newLat, longitude: newLng });
        const p = places?.[0];
        if (p) {
          const parts = [p.region, p.city, p.district, p.subregion].filter(Boolean);
          if (parts.length > 0) setLabel(parts.slice(0, 2).join(' '));
        }
      } catch { /* ignore */ }
    } catch {
      Alert.alert('GPS 실패', '위치를 가져올 수 없습니다. 수동으로 입력하거나 설정을 확인해주세요.');
    } finally {
      setGpsLoading(false);
    }
  };

  const onSave = async () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!isFinite(latNum) || !isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      Alert.alert('좌표 오류', '위도(-90~90)·경도(-180~180)를 올바르게 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await momLocationApi.put({
        lat: latNum,
        lng: lngNum,
        locationLabel: label.trim(),
        babyBirthYear: babyBirthYear ?? undefined,
      });
      Alert.alert('저장 완료', '위치가 저장됐어요. 맘스톡에서 반경 검색이 활성화됩니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('저장 실패', '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    Alert.alert('위치 삭제', '저장된 위치를 삭제할까요? 반경 검색이 비활성화됩니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          await momLocationApi.remove();
          setSaved({ hasLocation: false });
          setLat(''); setLng(''); setLabel('');
          Alert.alert('삭제 완료');
        } catch {
          Alert.alert('삭제 실패');
        }
      } },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>위치 등록</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Text style={styles.introTitle}>내 동네 맘들 만나기</Text>
            <Text style={styles.introSub}>
              위치를 등록하면 5km / 10km / 50km / 100km 반경의 맘들과 매칭됩니다.{'\n'}
              위치는 절대 다른 사용자에게 노출되지 않고, 거리 계산에만 사용해요.
            </Text>
          </View>

          {/* GPS 자동 */}
          <TouchableOpacity
            style={[styles.gpsBtn, gpsLoading && { opacity: 0.6 }]}
            onPress={useGps}
            disabled={gpsLoading}
            activeOpacity={0.85}
          >
            {gpsLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.gpsBtnText}>현재 위치 자동 입력</Text>
              </>
            )}
          </TouchableOpacity>

          {/* 수동 입력 */}
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>위도 (latitude)</Text>
            <TextInput
              style={styles.input}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              value={lat}
              onChangeText={setLat}
              placeholder="37.5665"
              placeholderTextColor={COLOR.textLight}
            />
            <Text style={styles.formLabel}>경도 (longitude)</Text>
            <TextInput
              style={styles.input}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              value={lng}
              onChangeText={setLng}
              placeholder="126.9780"
              placeholderTextColor={COLOR.textLight}
            />
            <Text style={styles.formLabel}>표시 이름 (선택)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="서울특별시 중구"
              placeholderTextColor={COLOR.textLight}
              maxLength={60}
            />
          </View>

          {/* 동갑 매칭 정보 */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>동갑 매칭</Text>
            <Text style={styles.infoText}>
              {babyBirthYear
                ? `우리 아이 ${babyBirthYear}년생 → 같은 ${babyBirthYear}년생 맘들과 매칭`
                : '선택된 자녀의 출생연도 정보가 없어요. 자녀 등록·생년월일을 먼저 설정해주세요.'}
            </Text>
          </View>

          {/* 저장·삭제 */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={onSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>저장</Text>}
          </TouchableOpacity>

          {saved.hasLocation && (
            <TouchableOpacity style={styles.removeLink} onPress={onRemove}>
              <Text style={styles.removeLinkText}>저장된 위치 삭제</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
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
  topTitle: { fontSize: 16, fontWeight: '900', color: COLOR.text },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 16, paddingBottom: 60, gap: 14 },

  intro: { paddingTop: 6, paddingBottom: 4 },
  introTitle: { fontSize: 22, fontWeight: '900', color: COLOR.text, marginBottom: 6 },
  introSub: { fontSize: 13, color: COLOR.textSub, fontWeight: '600', lineHeight: 19 },

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLOR.primary,
    paddingVertical: 16,
    borderRadius: 14,
    minHeight: 52,
  },
  gpsBtnIcon: { fontSize: 20 },
  gpsBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLOR.border,
    gap: 4,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.textSub,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.text,
    backgroundColor: '#F8F5F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },

  infoCard: {
    backgroundColor: COLOR.primaryLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFD4BB',
  },
  infoTitle: { fontSize: 13, fontWeight: '900', color: COLOR.primary, marginBottom: 4 },
  infoText: { fontSize: 12, color: '#7A4A2E', fontWeight: '600', lineHeight: 18 },

  saveBtn: {
    backgroundColor: '#1C1C1E',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 52,
    marginTop: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },

  removeLink: { alignSelf: 'center', paddingVertical: 8 },
  removeLinkText: { fontSize: 13, color: '#FF3B30', fontWeight: '700', textDecorationLine: 'underline' },
});
