/**
 * 임신부 분만 병원 등록 유도 팝업.
 *
 * 표시 조건:
 *   - 일반 임신부: weeks >= 30
 *   - 고위험 임신부(isHighRisk): weeks >= 24 — 조산 위험 고려
 *   - 분만/진료 병원 둘 다 미등록
 *   - "3일 보지 않기" 옵션 사용 후 3일 미경과
 *
 * 표시 위치: 홈 화면 진입 시 useEffect 로 1회 체크 → 조건 부합 시 팝업.
 *
 * 사용자가 "지금 등록" 누르면 HospitalRegisterModal 즉시 노출.
 * "3일 보지 않기" 누르면 AsyncStorage 에 timestamp 저장 → 3일간 표시 안 함.
 * "X" 누르면 닫지만 다음 앱 실행 시 다시 표시 (3일 옵션과 다름).
 */
import { useEffect, useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HospitalRegisterModal } from './HospitalRegisterModal';
import { getHospital } from '../../services/deliveryHospital';

interface Props {
  childId: string;
  weeks: number;
  /** 고위험 임신 여부 — true 면 24주부터 노출 + 위험 강조 톤 */
  isHighRisk?: boolean;
  /** 같은 세션에서 한 번만 표시되도록 외부에서 제어 — 매 화면 이동마다 뜨면 안 됨 */
  enabled?: boolean;
}

const SNOOZE_KEY = (childId: string) => `hospital_register_prompt_snooze_${childId}`;
const SNOOZE_DAYS = 3;
const NORMAL_THRESHOLD = 30;
const HIGH_RISK_THRESHOLD = 24;

export function HospitalRegisterPrompt({ childId, weeks, isHighRisk = false, enabled = true }: Props) {
  const [shouldShow, setShouldShow] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const threshold = isHighRisk ? HIGH_RISK_THRESHOLD : NORMAL_THRESHOLD;

  const checkConditions = useCallback(async () => {
    if (!childId || weeks < threshold) {
      setShouldShow(false);
      return;
    }
    // 1. 등록 여부
    const delivery = await getHospital(childId, 'delivery');
    const clinic = await getHospital(childId, 'clinic');
    const has =
      !!(delivery?.mainPhone || delivery?.deliveryWardPhone) ||
      !!(clinic?.mainPhone || clinic?.deliveryWardPhone);
    if (has) {
      setShouldShow(false);
      return;
    }
    // 2. snooze 만료 체크
    try {
      const raw = await AsyncStorage.getItem(SNOOZE_KEY(childId));
      if (raw) {
        const snoozedAt = parseInt(raw, 10);
        const elapsed = Date.now() - snoozedAt;
        const threshold = SNOOZE_DAYS * 24 * 60 * 60 * 1000;
        if (elapsed < threshold) {
          setShouldShow(false);
          return;
        }
      }
    } catch {
      // ignore
    }
    setShouldShow(true);
  }, [childId, weeks, threshold]);

  useEffect(() => {
    if (!enabled || checked) return;
    setChecked(true);
    checkConditions();
  }, [enabled, checked, checkConditions]);

  const handleSnooze = async () => {
    try {
      await AsyncStorage.setItem(SNOOZE_KEY(childId), String(Date.now()));
    } catch {
      // ignore
    }
    setShouldShow(false);
  };

  const handleClose = () => {
    setShouldShow(false);
  };

  const handleRegister = () => {
    setShouldShow(false);
    setRegisterOpen(true);
  };

  return (
    <>
      <Modal
        visible={shouldShow}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.backdrop}>
          <View style={[styles.card, isHighRisk && styles.cardHighRisk]}>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.icon}>{isHighRisk ? '🚨' : '⏰'}</Text>
            <Text style={[styles.title, isHighRisk && styles.titleHighRisk]}>
              {isHighRisk ? '고위험 임신 — 병원 등록이 꼭 필요해요' : '출산이 가까워지고 있어요'}
            </Text>
            <Text style={styles.body}>
              {isHighRisk ? (
                <>
                  조산 가능성을 고려해 24주부터 안내드려요.{'\n'}
                  급한 순간 바로 전화할 수 있도록{'\n'}
                  <Text style={[styles.bodyEmph, styles.bodyEmphHighRisk]}>
                    분만 병원 번호를 지금 등록
                  </Text>
                  해 주세요.
                </>
              ) : (
                <>
                  급한 순간 바로 전화할 수 있도록{'\n'}
                  <Text style={styles.bodyEmph}>병원 번호를 미리 등록</Text>해 주세요.
                </>
              )}
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, isHighRisk && styles.primaryBtnHighRisk]}
              onPress={handleRegister}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>지금 등록하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSnooze} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>3일간 보지 않기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <HospitalRegisterModal
        visible={registerOpen}
        childId={childId}
        initialKind="delivery"
        onClose={() => setRegisterOpen(false)}
        onSaved={() => setRegisterOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    paddingTop: 28,
    alignItems: 'center',
  },
  cardHighRisk: {
    borderTopWidth: 4,
    borderTopColor: '#D9534F',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#999',
  },
  icon: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleHighRisk: { color: '#D9534F' },
  body: {
    fontSize: 14,
    color: '#4A4A4A',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  bodyEmph: {
    fontWeight: '800',
    color: '#FF8C5A',
  },
  bodyEmphHighRisk: { color: '#D9534F' },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#FF8C5A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnHighRisk: { backgroundColor: '#D9534F' },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
});
