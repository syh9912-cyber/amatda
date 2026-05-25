/**
 * MissionInfoModal — 물/영양제 long-press 시 의학적 의미 + 주간 통계 설명 모달
 *
 * 사용처: DailyMissionBadges, DenseStatsRow (임신부 모드)
 */

import { Modal, View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

const WATER_ICON = require('../../assets/quick-water.png') as ImageSourcePropType;
const PILL_ICON = require('../../assets/quick-pill.png') as ImageSourcePropType;

export type MissionInfoKind = 'water' | 'supplements' | null;

interface Props {
  kind: MissionInfoKind;
  water: number;
  supplements: boolean;
  onClose: () => void;
}

export function MissionInfoModal({ kind, water, supplements, onClose }: Props) {
  if (!kind) return null;
  const isWater = kind === 'water';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.iconCircle, { backgroundColor: isWater ? '#E3F2FD' : '#F3E5F5' }]}>
              <Image
                source={isWater ? WATER_ICON : PILL_ICON}
                style={styles.iconImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>
              {isWater ? '하루 물 8잔이 중요한 이유' : '영양제, 매일 챙겨야 하는 이유'}
            </Text>

            <Text style={styles.subtitle}>
              {isWater
                ? `오늘 ${water} / 8잔 마셨어요`
                : supplements
                  ? '오늘 영양제 ✓ 챙기셨어요'
                  : '오늘 아직 영양제를 안 챙기셨어요'}
            </Text>

            {isWater ? (
              <>
                <ReasonRow emoji="🌊" title="양수량 유지" desc="아기를 둘러싼 양수가 충분해야 자유롭게 움직이고 폐가 발달해요." />
                <ReasonRow emoji="🩸" title="혈류량 증가" desc="임신 중 혈액량이 50% 늘어요. 부족하면 어지럼증과 부종이 심해집니다." />
                <ReasonRow emoji="💆‍♀️" title="부종·변비 예방" desc="수분 부족 시 다리 부종, 변비, 요로감염 위험이 올라가요." />
                <ReasonRow emoji="🍼" title="모유 준비" desc="후기에는 초유 생성을 위한 수분이 더 필요해요." />
                <View style={styles.factBox}>
                  <Text style={styles.factTitle}>💡 알아두세요</Text>
                  <Text style={styles.factText}>
                    임신 중 권장 수분 섭취량은 하루 2L (약 8잔). 한 번에 많이 마시지 말고 30분~1시간 간격으로 나눠 드세요.
                    카페인 음료는 제외하고 계산해야 해요.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <ReasonRow emoji="🧠" title="엽산 (Folate)" desc="신경관 결손(이분척추 등) 발생률을 약 70% 낮춥니다. 임신 12주까지 특히 중요." />
                <ReasonRow emoji="❤️" title="철분" desc="혈액량이 늘면서 철분 수요 2배. 부족 시 빈혈·조산 위험이 증가합니다." />
                <ReasonRow emoji="🦴" title="칼슘" desc="아기 뼈·치아 형성에 필수. 부족하면 엄마 뼈에서 빠져나갑니다." />
                <ReasonRow emoji="🐟" title="DHA / 오메가3" desc="태아의 뇌·시각 발달에 직접 관여. 후기일수록 수요 ↑." />
                <View style={styles.factBox}>
                  <Text style={styles.factTitle}>💡 알아두세요</Text>
                  <Text style={styles.factText}>
                    영양제는 식사와 함께 일정한 시간에 매일 드시는 게 가장 효과적이에요.
                    철분제는 비타민C와 함께 먹으면 흡수율이 올라갑니다.
                  </Text>
                </View>
              </>
            )}

            <Text style={styles.disclaimer}>
              ※ 본 정보는 일반적인 임신·수유 가이드이며 개인 상태에 따라 다를 수 있어요.
              정확한 권장량과 복용 일정은 담당 산부인과 의사 또는 약사와 상담해 결정하세요.
            </Text>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeBtnText}>알겠어요 💛</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ReasonRow({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={styles.reasonRow}>
      <Text style={styles.reasonEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.reasonTitle}>{title}</Text>
        <Text style={styles.reasonDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    maxHeight: '88%',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  iconImage: { width: 56, height: 56 },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    fontWeight: '600',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  reasonEmoji: { fontSize: 24 },
  reasonTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 3 },
  reasonDesc: { fontSize: 12.5, color: '#555', lineHeight: 19 },
  factBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  factTitle: { fontSize: 13, fontWeight: '900', color: '#F57C00', marginBottom: 6 },
  factText: { fontSize: 12.5, color: '#5D4037', lineHeight: 19 },
  disclaimer: {
    fontSize: 11,
    color: '#9E9E9E',
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  closeBtn: {
    backgroundColor: '#FF8C5A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  closeBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});
