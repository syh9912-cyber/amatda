import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

/**
 * 분석 한도 초과 시 표시되는 업셀 모달.
 * "오늘의 분석이 완료되었습니다. 커피 한잔값으로 월 300회 이용하기"
 */
export function UpsellModal({
  visible,
  onClose,
  title = '오늘의 분석이 완료되었습니다',
  message = '커피 한잔값으로 월 300회 이용하기',
}: Props) {
  const router = useRouter();

  const handleUpgrade = () => {
    onClose();
    router.push('/(main)/subscription');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.emoji}>{'☕️'}</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>

          <View style={s.benefits}>
            <Text style={s.benefit}>• 음식 · 대변 · 울음 분석 각 월 300회</Text>
            <Text style={s.benefit}>• 상담이모 무제한</Text>
            <Text style={s.benefit}>• 광고 제거</Text>
          </View>

          <TouchableOpacity style={s.primaryBtn} onPress={handleUpgrade} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>{'프리미엄 플랜 보기'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.secondaryBtnText}>{'내일 다시 할게요'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#636366',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  benefits: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF0E8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  benefit: {
    fontSize: 13,
    color: '#1C1C1E',
    lineHeight: 20,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#FF8C5A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
  },
});
