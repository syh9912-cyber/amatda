import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  Image,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { clinicApi } from '../../services/api';
import { useLocationStore } from '../../stores/locationStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';

const IC_HOSPITAL = require('../../assets/icon-hospital.png') as ImageSourcePropType;

// ── Types ──

interface KakaoClinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  distance: number;
  category: string;
  hasEmergency: boolean;
  placeUrl: string;
  latitude: number;
  longitude: number;
}

interface ClinicRatings {
  kindness: number;
  waitTime: number;
  convenience: number;
  expertise: number;
}

// ── Constants ──

const DEFAULT_LAT = 34.815;
const DEFAULT_LNG = 126.463;

const RADIUS_OPTIONS = [3, 5, 10, 20] as const;

// ── Sub-components ──

// ── Main Screen ──

export default function ClinicScreen() {
  const { t } = useTranslation();
  const [clinics, setClinics] = useState<KakaoClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRadius, setSearchRadius] = useState<number>(5);
  const [keyword, setKeyword] = useState('');

  const userLocation = useLocationStore((s) => s.userLocation);
  const lat = userLocation?.latitude ?? DEFAULT_LAT;
  const lng = userLocation?.longitude ?? DEFAULT_LNG;

  const loadClinics = useCallback(async (kw?: string) => {
    setLoading(true);
    try {
      const res = await clinicApi.search(lat, lng, searchRadius, kw || undefined);
      const data = res.data?.data;
      if (Array.isArray(data)) {
        setClinics(data as KakaoClinic[]);
      } else {
        setClinics([]);
      }
    } catch {
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, searchRadius]);

  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  const handleSearch = () => {
    loadClinics(keyword.trim() || undefined);
  };

  const callPhone = (phone: string) => {
    if (!phone) {
      Alert.alert(t('common.notice'), t('clinic.noPhoneRegistered'));
      return;
    }
    Linking.openURL(`tel:${phone.replace(/[^0-9]/g, '')}`).catch(() => {
      Alert.alert(t('common.error'), t('clinic.callFailed'));
    });
  };

  const openMap = (clinic: KakaoClinic) => {
    const url = `https://map.kakao.com/link/map/${encodeURIComponent(clinic.name)},${clinic.latitude},${clinic.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t('common.error'), t('clinic.mapOpenFailed'));
    });
  };

  const formatDistance = (d: number) => {
    if (d < 1) return `${Math.round(d * 1000)}m`;
    return `${d.toFixed(1)}km`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('clinic.screenTitle'), headerShown: true, headerLeft: () => <BackButton /> }} />

      {/* Search bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={setKeyword}
            placeholder={t('clinic.searchPlaceholder')}
            placeholderTextColor={COLORS.textLight}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchBtnText}>{t('clinic.search')}</Text>
          </TouchableOpacity>
        </View>

        {/* Radius filter */}
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((r) => {
            const isActive = searchRadius === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.radiusBtn, isActive && styles.radiusBtnActive]}
                onPress={() => setSearchRadius(r)}
              >
                <Text style={[styles.radiusBtnText, isActive && styles.radiusBtnTextActive]}>
                  {r}km
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={styles.loader} />
      ) : clinics.length > 0 ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <Text style={styles.resultCount}>
            {t('clinic.resultCount', { count: clinics.length })}
          </Text>
          {clinics.map((clinic) => (
            <View key={clinic.id} style={styles.clinicCard}>
              <View style={styles.clinicHeader}>
                <View style={styles.clinicNameRow}>
                  <Text style={styles.clinicName} numberOfLines={1}>{clinic.name}</Text>
                  {clinic.hasEmergency && (
                    <View style={styles.erBadge}>
                      <Text style={styles.erBadgeText}>{t('clinic.emergencyBadge')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.clinicDistance}>
                  {formatDistance(clinic.distance)}
                </Text>
              </View>
              <Text style={styles.clinicAddress} numberOfLines={1}>{clinic.address}</Text>
              {clinic.category ? (
                <Text style={styles.clinicCategory} numberOfLines={1}>{clinic.category}</Text>
              ) : null}
              {clinic.phone ? (
                <Text style={styles.clinicPhone}>{clinic.phone}</Text>
              ) : null}

              {/* Action buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => callPhone(clinic.phone)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionText}>{t('clinic.actionCall')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openMap(clinic)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionText}>{t('clinic.actionMap')}</Text>
                </TouchableOpacity>
                {clinic.placeUrl ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => Linking.openURL(clinic.placeUrl).catch(() => {})}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionText}>{t('clinic.actionDetail')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Image source={IC_HOSPITAL} style={styles.emptyEmojiImg} resizeMode="contain" />
          <Text style={styles.emptyText}>
            {t('clinic.emptyText')}
          </Text>
          <Text style={styles.emptySubText}>
            {t('clinic.emptySubText')}
          </Text>
        </View>
      )}
      <AdSlot />
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { padding: SPACING.lg, paddingBottom: 100 },
  loader: { marginTop: SPACING.xl },

  // Search
  searchSection: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  radiusRow: { flexDirection: 'row', gap: 8 },
  radiusBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surface,
  },
  radiusBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  radiusBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  radiusBtnTextActive: { color: COLORS.primary },

  resultCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },

  // Clinic card
  clinicCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  clinicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clinicNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  clinicName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1,
  },
  erBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  erBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clinicDistance: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    fontWeight: '600',
    marginLeft: 8,
  },
  clinicAddress: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  clinicCategory: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  clinicPhone: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
  },
  actionIcon: { fontSize: 14 },
  actionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyEmojiImg: { width: 64, height: 64, marginBottom: SPACING.md },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
});
