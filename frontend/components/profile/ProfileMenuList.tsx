import { View, StyleSheet, ImageSourcePropType } from 'react-native';
import { router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { NavCard } from '../ui/NavCard';

interface MenuItem {
  icon: ImageSourcePropType;
  label: string;
  description: string;
  route?: string;
  action?: () => void;
}

const COMMON_TOP: MenuItem[] = [
  {
    icon: require('../../assets/icon-settings.png'),
    label: '내 정보 수정',
    description: '별명, 비밀번호 변경',
    route: '/(main)/edit-profile',
  },
];

const PREGNANCY_ITEMS: MenuItem[] = [
  {
    icon: require('../../assets/quick-learning.png'),
    label: '임신 기록',
    description: '주차별 기록 및 체크리스트',
    route: '/(main)/pregnancy',
  },
  {
    icon: require('../../assets/quick-report.png'),
    label: '주수별 발달',
    description: '태아 성장 정보 확인',
    route: '/(main)/growth-stats',
  },
  {
    icon: require('../../assets/quick-report.png'),
    label: '임당 관리',
    description: '임신성 당뇨 식사·혈당 기록',
    route: '/(main)/gdm',
  },
  {
    icon: require('../../assets/quick-sleep.png'),
    label: '태동 체크',
    description: '태동 카운트 기록',
    route: '/(main)/labor-monitor?tab=kick',
  },
  {
    icon: require('../../assets/quick-parent-level.png'),
    label: '맘 체크인',
    description: '오늘의 컨디션과 기분 기록',
    route: '/(main)/mom-wellness',
  },
  {
    icon: require('../../assets/icon-heart.png'),
    label: '맘스톡',
    description: '예비맘들과 이야기 나누기',
    route: '/(main)/mom-group',
  },
  {
    icon: require('../../assets/quick-lullaby.png'),
    label: '태교음악',
    description: '편안한 태교 사운드',
    route: '/(main)/lullaby?mode=prenatal',
  },
  {
    icon: require('../../assets/play-activity.png'),
    label: '맞춤 추천',
    description: '임신·출산 준비 가이드',
    route: '/(main)/recommendations',
  },
  {
    icon: require('../../assets/quick-coparenting.png'),
    label: '가족육아',
    description: '배우자와 함께 준비하기',
    route: '/(main)/coparenting',
  },
  {
    icon: require('../../assets/icon-heart.png'),
    label: '가족피드',
    description: '가족과 소중한 순간을 공유해보세요',
    route: '/(main)/momstagram',
  },
];

const PARENTING_ITEMS: MenuItem[] = [
  {
    icon: require('../../assets/feature-childcard.png'),
    label: '아이 디지털 카드',
    description: '아이 정보 카드 공유하기',
    route: '/(main)/child-card',
  },
  {
    icon: require('../../assets/badge-ai.png'),
    label: '기질 분석',
    description: '우리 아이 기질 결과 다시 보기 / 재분석',
    route: '/(main)/trait-detail',
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
    label: '가족피드',
    description: '가족과 소중한 순간을 공유해보세요',
    route: '/(main)/momstagram',
  },
  {
    icon: require('../../assets/growth-physical.png'),
    label: '성장 기록 & 통계',
    description: '성장 추이 확인',
    route: '/(main)/growth-stats',
  },
  {
    icon: require('../../assets/quick-timeline.png'),
    label: '성장앨범만들기',
    description: '성장 사진으로 앨범 만들기',
    route: '/(main)/album',
  },
];

const COMMON_BOTTOM: MenuItem[] = [
  {
    icon: require('../../assets/badge-ai.png'),
    label: 'AI 분석',
    description: '육아패턴·대변·울음 분석 결과',
    route: '/(main)/ai-analysis',
  },
  {
    icon: require('../../assets/premium-badge.png'),
    label: '프리미엄 플랜',
    description: '상담이모 무제한 이용',
    route: '/(main)/subscription',
  },
  {
    icon: require('../../assets/icon-mic.png'),
    label: '음성 기록 설정',
    description: '음성 명령 가이드 및 기본값 설정',
    route: '/(main)/voice-settings',
  },
  {
    icon: require('../../assets/icon-bell.png'),
    label: '알림 설정',
    description: '푸시 알림 관리',
    route: '/(main)/notification-settings',
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
  const isPregnant = selectedChild?.isPregnant === true;

  const modeItems = isPregnant ? PREGNANCY_ITEMS : PARENTING_ITEMS;
  const items: MenuItem[] = [...COMMON_TOP, ...modeItems, ...COMMON_BOTTOM];

  const getOnPress = (item: MenuItem) => {
    return () => router.push(item.route as never);
  };

  return (
    <View style={styles.card}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <NavCard
            key={item.label}
            icon={item.icon}
            title={item.label}
            description={item.description}
            onPress={getOnPress(item)}
            variant="row"
            showBottomBorder={!isLast}
          />
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
});
