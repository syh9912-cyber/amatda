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
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { clinicApi } from '../../services/api';
import { useLocationStore } from '../../stores/locationStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

// ── Types ──

interface ClinicRatings {
  kindness: number;
  waitTime: number;
  convenience: number;
  expertise: number;
}

interface Clinic {
  id: string;
  name: string;
  address: string;
  ratings: ClinicRatings;
  reviewCount: number;
  distance?: number;
}

interface Review {
  id: string;
  clinicId: string;
  userName: string;
  ratings: ClinicRatings;
  comment: string;
  createdAt: string;
}

// ── Constants ──

const DEFAULT_LAT = 34.815;
const DEFAULT_LNG = 126.463;

const RADIUS_OPTIONS = [10, 20, 40, 60] as const;

const RATING_LABELS: { key: keyof ClinicRatings; label: string }[] = [
  { key: 'kindness', label: '친절도' },
  { key: 'waitTime', label: '대기시간' },
  { key: 'convenience', label: '편의성' },
  { key: 'expertise', label: '전문성' },
];

// ── Sub-components ──

function RatingBars({ ratings }: { ratings: ClinicRatings }) {
  return (
    <View style={styles.ratingBarsContainer}>
      {RATING_LABELS.map(({ key, label }) => {
        const value = ratings[key] ?? 0;
        const pct = (value / 5) * 100;
        return (
          <View key={key} style={styles.ratingBarRow}>
            <Text style={styles.ratingBarLabel}>{label}</Text>
            <View style={styles.ratingBarTrack}>
              <View style={[styles.ratingBarFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.ratingBarValue}>{value.toFixed(1)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      <Text style={styles.starLabel}>{label}</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => onChange(n)}>
            <Text style={[styles.star, n <= value && styles.starActive]}>
              {'★'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Main Screen ──

export default function ClinicScreen() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRadius, setSearchRadius] = useState<number>(10);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const userLocation = useLocationStore((s) => s.userLocation);

  // Review form state
  const [formClinicName, setFormClinicName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formComment, setFormComment] = useState('');
  const [formRatings, setFormRatings] = useState<ClinicRatings>({
    kindness: 0,
    waitTime: 0,
    convenience: 0,
    expertise: 0,
  });

  const lat = userLocation?.latitude ?? DEFAULT_LAT;
  const lng = userLocation?.longitude ?? DEFAULT_LNG;

  const loadClinics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clinicApi.nearby(lat, lng, searchRadius);
      if (res.data?.data) {
        setClinics(res.data.data as Clinic[]);
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

  const handleSelectClinic = async (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setReviewsLoading(true);
    try {
      const res = await clinicApi.reviews(clinic.id);
      if (res.data?.data) {
        setReviews(res.data.data as Review[]);
      }
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedClinic(null);
    setReviews([]);
  };

  const openReviewForm = () => {
    setFormClinicName(selectedClinic?.name ?? '');
    setFormAddress(selectedClinic?.address ?? '');
    setFormComment('');
    setFormRatings({ kindness: 0, waitTime: 0, convenience: 0, expertise: 0 });
    setShowReviewModal(true);
  };

  const updateFormRating = (key: keyof ClinicRatings, value: number) => {
    setFormRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitReview = async () => {
    if (!formClinicName.trim()) {
      Alert.alert('알림', '병원 이름을 입력해주세요.');
      return;
    }
    const hasZero = Object.values(formRatings).some((v) => v === 0);
    if (hasZero) {
      Alert.alert('알림', '모든 항목에 별점을 매겨주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await clinicApi.postReview({
        clinicId: selectedClinic?.id,
        clinicName: formClinicName,
        address: formAddress,
        ratings: formRatings,
        comment: formComment,
      });
      Alert.alert('감사합니다', '후기가 등록되었습니다!');
      setShowReviewModal(false);
      if (selectedClinic) {
        handleSelectClinic(selectedClinic);
      }
    } catch {
      Alert.alert('오류', '후기 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Detail View ──

  if (selectedClinic) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: selectedClinic.name, headerShown: true }} />
        <ScrollView contentContainerStyle={styles.content}>
          {/* Clinic info */}
          <View style={styles.detailCard}>
            <Text style={styles.detailName}>{selectedClinic.name}</Text>
            <Text style={styles.detailAddress}>{selectedClinic.address}</Text>
            <RatingBars ratings={selectedClinic.ratings} />
            <Text style={styles.reviewCountText}>
              후기 {selectedClinic.reviewCount}개
            </Text>
          </View>

          {/* Reviews */}
          <Text style={styles.sectionTitle}>후기 목록</Text>
          {reviewsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={styles.loader} />
          ) : reviews.length > 0 ? (
            reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewUser}>{r.userName}</Text>
                  <Text style={styles.reviewDate}>
                    {r.createdAt.split('T')[0]}
                  </Text>
                </View>
                <RatingBars ratings={r.ratings} />
                {r.comment ? (
                  <Text style={styles.reviewComment}>{r.comment}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>아직 후기가 없습니다.</Text>
          )}

          <TouchableOpacity style={styles.backBtn} onPress={handleBackToList}>
            <Text style={styles.backBtnText}>목록으로 돌아가기</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Floating review button */}
        <TouchableOpacity style={styles.fab} onPress={openReviewForm}>
          <Text style={styles.fabText}>후기 작성</Text>
        </TouchableOpacity>

        {/* Review Modal */}
        <ReviewModal
          visible={showReviewModal}
          clinicName={formClinicName}
          address={formAddress}
          comment={formComment}
          ratings={formRatings}
          submitting={submitting}
          onChangeClinicName={setFormClinicName}
          onChangeAddress={setFormAddress}
          onChangeComment={setFormComment}
          onChangeRating={updateFormRating}
          onSubmit={handleSubmitReview}
          onClose={() => setShowReviewModal(false)}
        />
      </View>
    );
  }

  // ── List View ──

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '우리 동네 소아과', headerShown: true }} />

      {/* Radius filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>검색 반경</Text>
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

      {/* Clinic list */}
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={styles.loader} />
      ) : clinics.length > 0 ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {clinics.map((clinic) => (
            <TouchableOpacity
              key={clinic.id}
              style={styles.clinicCard}
              onPress={() => handleSelectClinic(clinic)}
              activeOpacity={0.7}
            >
              <View style={styles.clinicHeader}>
                <Text style={styles.clinicName}>{clinic.name}</Text>
                {clinic.distance !== undefined && (
                  <Text style={styles.clinicDistance}>
                    {clinic.distance < 1
                      ? `${Math.round(clinic.distance * 1000)}m`
                      : `${clinic.distance.toFixed(1)}km`}
                  </Text>
                )}
              </View>
              <Text style={styles.clinicAddress}>{clinic.address}</Text>
              <RatingBars ratings={clinic.ratings} />
              <Text style={styles.clinicReviewCount}>
                후기 {clinic.reviewCount}개
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{'🏥'}</Text>
          <Text style={styles.emptyText}>
            주변에 등록된 소아과가 없습니다.
          </Text>
          <Text style={styles.emptySubText}>
            검색 반경을 넓혀보세요.
          </Text>
        </View>
      )}

      {/* Floating review button */}
      <TouchableOpacity style={styles.fab} onPress={() => {
        setFormClinicName('');
        setFormAddress('');
        setFormComment('');
        setFormRatings({ kindness: 0, waitTime: 0, convenience: 0, expertise: 0 });
        setShowReviewModal(true);
      }}>
        <Text style={styles.fabText}>후기 작성</Text>
      </TouchableOpacity>

      {/* Review Modal */}
      <ReviewModal
        visible={showReviewModal}
        clinicName={formClinicName}
        address={formAddress}
        comment={formComment}
        ratings={formRatings}
        submitting={submitting}
        onChangeClinicName={setFormClinicName}
        onChangeAddress={setFormAddress}
        onChangeComment={setFormComment}
        onChangeRating={updateFormRating}
        onSubmit={handleSubmitReview}
        onClose={() => setShowReviewModal(false)}
      />
    </View>
  );
}

// ── Review Modal Component ──

function ReviewModal({
  visible,
  clinicName,
  address,
  comment,
  ratings,
  submitting,
  onChangeClinicName,
  onChangeAddress,
  onChangeComment,
  onChangeRating,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  clinicName: string;
  address: string;
  comment: string;
  ratings: ClinicRatings;
  submitting: boolean;
  onChangeClinicName: (v: string) => void;
  onChangeAddress: (v: string) => void;
  onChangeComment: (v: string) => void;
  onChangeRating: (key: keyof ClinicRatings, value: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>후기 작성</Text>

            <Text style={styles.inputLabel}>병원 이름</Text>
            <TextInput
              style={styles.input}
              value={clinicName}
              onChangeText={onChangeClinicName}
              placeholder="병원 이름을 입력하세요"
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.inputLabel}>주소</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={onChangeAddress}
              placeholder="주소를 입력하세요"
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.inputLabel}>별점</Text>
            {RATING_LABELS.map(({ key, label }) => (
              <StarRow
                key={key}
                label={label}
                value={ratings[key]}
                onChange={(v) => onChangeRating(key, v)}
              />
            ))}

            <Text style={styles.inputLabel}>한줄 후기</Text>
            <TextInput
              style={[styles.input, styles.commentInput]}
              value={comment}
              onChangeText={(t) => onChangeComment(t.slice(0, 100))}
              placeholder="후기를 작성해주세요 (최대 100자)"
              placeholderTextColor={COLORS.textLight}
              multiline
              maxLength={100}
            />
            <Text style={styles.charCount}>{comment.length}/100</Text>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>등록하기</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 100 },
  listContent: { padding: SPACING.lg, paddingBottom: 100 },
  loader: { marginTop: SPACING.xl },

  // Filter
  filterSection: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  filterLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
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
  clinicName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  clinicDistance: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  clinicAddress: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  clinicReviewCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },

  // Rating bars
  ratingBarsContainer: { gap: 6 },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBarLabel: {
    width: 55,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  ratingBarValue: {
    width: 28,
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Detail
  detailCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  detailName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  detailAddress: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  reviewCountText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },

  // Review card
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  reviewUser: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  reviewDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
  reviewComment: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    lineHeight: 20,
  },

  // Back button
  backBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  backBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
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

  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },

  // Form
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    textAlign: 'right',
    marginTop: 4,
  },

  // Stars
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  starLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    width: 60,
  },
  starsContainer: { flexDirection: 'row', gap: 4 },
  star: { fontSize: 24, color: COLORS.borderLight },
  starActive: { color: '#FFB800' },

  // Submit
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  cancelBtn: {
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
});
