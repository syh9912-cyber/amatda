/**
 * 임신부 홈 배너 — 분만 병원 번호 미등록 시 경고 노출.
 *
 * 일반 임신부: 35주+
 * 고위험 임신부: 28주+ (조산 위험 → 더 일찍 등록 유도)
 *
 * 클릭 시 HospitalRegisterModal 열어 즉시 등록 가능.
 * 등록 완료되면 자동으로 배너 사라짐.
 */
import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HospitalRegisterModal } from './HospitalRegisterModal';
import { getHospital } from '../../services/deliveryHospital';

interface Props {
  childId: string;
  weeks: number;
  /** 고위험 임신 여부 — true 면 28주부터 강조 톤 노출 */
  isHighRisk?: boolean;
  /** 다른 화면에서 등록 후 돌아왔을 때 강제 재조회용 */
  refreshKey?: number;
}

const NORMAL_THRESHOLD = 35;
const HIGH_RISK_THRESHOLD = 28;

export function HospitalRegisterBanner({ childId, weeks, isHighRisk = false, refreshKey }: Props) {
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const checkRegistered = useCallback(async () => {
    if (!childId) {
      setRegistered(true);  // childId 없으면 배너 숨김
      return;
    }
    const delivery = await getHospital(childId, 'delivery');
    const clinic = await getHospital(childId, 'clinic');
    // 분만 병원 또는 진료 병원 중 하나라도 번호 등록 → 배너 숨김
    const has =
      !!(delivery?.mainPhone || delivery?.deliveryWardPhone) ||
      !!(clinic?.mainPhone || clinic?.deliveryWardPhone);
    setRegistered(has);
  }, [childId]);

  useEffect(() => {
    checkRegistered();
  }, [checkRegistered, refreshKey]);

  const threshold = isHighRisk ? HIGH_RISK_THRESHOLD : NORMAL_THRESHOLD;
  // 임계 미만 또는 등록 완료 시 표시 안 함
  if (weeks < threshold || registered !== false) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.banner, isHighRisk && styles.bannerHighRisk]}
        activeOpacity={0.85}
        onPress={() => setModalOpen(true)}
      >
        <Text style={styles.icon}>{isHighRisk ? '🚨' : '📞'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, isHighRisk && styles.titleHighRisk]}>
            {isHighRisk
              ? '고위험 임신 — 분만 병원을 지금 등록하세요'
              : '병원 번호를 미리 등록해 주세요'}
          </Text>
          <Text style={[styles.sub, isHighRisk && styles.subHighRisk]}>
            {isHighRisk
              ? '조산 가능성을 고려해 28주부터 안내드려요. 급한 순간 즉시 전화할 수 있도록 준비해 주세요.'
              : '출산이 가까워지고 있어요. 급한 순간 바로 전화할 수 있도록 준비해 두세요.'}
          </Text>
        </View>
        <Text style={[styles.arrow, isHighRisk && styles.arrowHighRisk]}>{'>'}</Text>
      </TouchableOpacity>

      <HospitalRegisterModal
        visible={modalOpen}
        childId={childId}
        initialKind="delivery"
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          checkRegistered();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // 일반 임신부 — 코랄/살구 톤 (압박감 ↓, "미리 준비하자" 느낌)
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3EC',
    borderWidth: 1,
    borderColor: '#FFB89A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  // 고위험 임신 — 기존 빨강 유지 (안전 우선)
  bannerHighRisk: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1.5,
    borderColor: '#E53935',
  },
  icon: {
    fontSize: 22,
    marginRight: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C2410C',
    marginBottom: 3,
  },
  titleHighRisk: { color: '#B71C1C', fontWeight: '900' },
  sub: {
    fontSize: 12,
    color: '#7A4527',
    lineHeight: 16,
  },
  subHighRisk: { color: '#7A1F1F' },
  arrow: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D8631F',
    marginLeft: 8,
  },
  arrowHighRisk: { color: '#C62828', fontWeight: '900' },
});
