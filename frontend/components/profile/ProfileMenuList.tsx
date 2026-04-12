import { View, Text, Image, TouchableOpacity, StyleSheet, ImageSourcePropType, Alert } from 'react-native';
import { router } from 'expo-router';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';
import { useChildStore } from '../../stores/childStore';
import { exportChildDataAsPDF } from '../../services/dataExport';

interface MenuItem {
  icon: ImageSourcePropType;
  label: string;
  description: string;
  route?: string;
  action?: () => void;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: require('../../assets/icon-settings.png'),
    label: '내 정보 수정',
    description: '별명, 비밀번호 변경',
    route: '/(main)/edit-profile',
  },
  {
    icon: require('../../assets/feature-childcard.png'),
    label: '아이 디지털 카드',
    description: '아이 정보 카드 공유하기',
    route: '/(main)/child-card',
  },
  {
    icon: require('../../assets/trait-analyst-small.png'),
    label: '기질분석 기록',
    description: '기질 검사 결과 보기',
    route: '/(main)/trait-detail',
  },
  {
    icon: require('../../assets/quick-report.png'),
    label: '개월별 발달 특징',
    description: '우리 아이 월령별 성장 포인트',
    route: '/(main)/monthly-characteristic',
  },
  {
    icon: require('../../assets/play-activity.png'),
    label: '맞춤 추천',
    description: '음식, 생활습관, 학원, 놀이학습 추천',
    route: '/(main)/recommendations',
  },
  {
    icon: require('../../assets/icon-camera.png'),
    label: '성장 타임라인',
    description: '마일스톤 사진과 기록 모아보기',
    route: '/(main)/album',
  },
  {
    icon: require('../../assets/icon-heart.png'),
    label: '맘스타그램',
    description: '엄마들의 인스타그램',
    route: '/(main)/momstagram',
  },
  {
    icon: require('../../assets/growth-physical.png'),
    label: '성장 기록 & 통계',
    description: '성장 추이 확인',
    route: '/(main)/growth-stats',
  },
  {
    icon: require('../../assets/premium-badge.png'),
    label: '프리미엄 플랜',
    description: 'AI 코칭 무제한 이용',
    route: '/(main)/subscription',
  },
  {
    icon: require('../../assets/icon-bell.png'),
    label: '알림 설정',
    description: '푸시 알림 관리',
    route: '/(main)/notification-settings',
  },
  {
    icon: require('../../assets/icon-share.png'),
    label: '데이터 내보내기',
    description: '아이 성장 기록 PDF로 저장',
  },
  {
    icon: require('../../assets/support-faq.png'),
    label: '고객센터',
    description: '문의 및 건의사항 보내기',
    route: '/(main)/support',
  },
];

export function ProfileMenuList() {
  const selectedChild = useChildStore((s) => s.selectedChild);

  const handleExport = async () => {
    if (!selectedChild) {
      Alert.alert('알림', '등록된 자녀가 없습니다.');
      return;
    }
    try {
      await exportChildDataAsPDF(selectedChild);
    } catch {
      Alert.alert('오류', '데이터 내보내기에 실패했습니다.');
    }
  };

  const getOnPress = (item: MenuItem) => {
    if (item.label === '데이터 내보내기') return handleExport;
    return () => router.push(item.route as never);
  };

  return (
    <View style={styles.card}>
      {MENU_ITEMS.map((item, idx) => {
        const isLast = idx === MENU_ITEMS.length - 1;
        return (
          <TouchableOpacity
            key={item.label}
            style={[styles.row, !isLast && styles.rowBorder]}
            onPress={getOnPress(item)}
          >
            <View style={styles.iconWrap}>
              <Image source={item.icon} style={styles.icon} resizeMode="contain" />
            </View>
            <View style={styles.labelCol}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.desc}>{item.description}</Text>
            </View>
            <Text style={styles.chevron}>{'>'}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5EDE4',
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  labelCol: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  desc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    fontWeight: '300',
  },
});
