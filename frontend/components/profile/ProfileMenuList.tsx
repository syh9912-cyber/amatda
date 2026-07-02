import { View, StyleSheet, ImageSourcePropType } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

function getCommonTopItems(t: TFunction): MenuItem[] {
  return [
    {
      icon: require('../../assets/icon-settings.png'),
      label: t('components.profileMenuList.editProfile.label'),
      description: t('components.profileMenuList.editProfile.description'),
      route: '/(main)/edit-profile',
    },
  ];
}

function getPregnancyItems(t: TFunction): MenuItem[] {
  return [
    {
      icon: require('../../assets/quick-learning.png'),
      label: t('pregnancy.screenTitle'),
      description: t('components.profileMenuList.pregnancyAlbum.description'),
      route: '/(main)/pregnancy',
    },
    {
      icon: require('../../assets/quick-report.png'),
      label: t('components.profileMenuList.weeklyDevelopment.label'),
      description: t('components.profileMenuList.weeklyDevelopment.description'),
      route: '/(main)/growth-stats',
    },
    {
      icon: require('../../assets/quick-report.png'),
      label: t('gdm.screenTitle'),
      description: t('components.profileMenuList.gdmManagement.description'),
      route: '/(main)/gdm',
    },
    {
      icon: require('../../assets/quick-sleep.png'),
      label: t('components.profileMenuList.kickCheck.label'),
      description: t('components.profileMenuList.kickCheck.description'),
      route: '/(main)/labor-monitor?tab=kick',
    },
    {
      icon: require('../../assets/quick-parent-level.png'),
      label: t('components.profileMenuList.momWellness.label'),
      description: t('components.profileMenuList.momWellness.description'),
      route: '/(main)/mom-wellness',
    },
    {
      icon: require('../../assets/icon-heart.png'),
      label: t('components.profileMenuList.momGroup.label'),
      description: t('components.profileMenuList.momGroup.description'),
      route: '/(main)/mom-group',
    },
    {
      icon: require('../../assets/quick-lullaby.png'),
      label: t('components.profileMenuList.lullaby.label'),
      description: t('components.profileMenuList.lullaby.description'),
      route: '/(main)/lullaby?mode=prenatal',
    },
    {
      icon: require('../../assets/play-activity.png'),
      label: t('components.profileMenuList.recommendations.label'),
      description: t('components.profileMenuList.recommendations.pregnancyDescription'),
      route: '/(main)/recommendations',
    },
    {
      icon: require('../../assets/quick-coparenting.png'),
      label: t('components.profileMenuList.coparenting.label'),
      description: t('components.profileMenuList.coparenting.description'),
      route: '/(main)/coparenting',
    },
    {
      icon: require('../../assets/icon-heart.png'),
      label: t('components.profileMenuList.momstagram.label'),
      description: t('components.profileMenuList.momstagram.description'),
      route: '/(main)/momstagram',
    },
  ];
}

function getParentingItems(t: TFunction): MenuItem[] {
  return [
    {
      icon: require('../../assets/feature-childcard.png'),
      label: t('components.profileMenuList.childCard.label'),
      description: t('components.profileMenuList.childCard.description'),
      route: '/(main)/child-card',
    },
    {
      icon: require('../../assets/badge-ai.png'),
      label: t('components.profileMenuList.traitDetail.label'),
      description: t('components.profileMenuList.traitDetail.description'),
      route: '/(main)/trait-detail',
    },
    {
      icon: require('../../assets/play-activity.png'),
      label: t('components.profileMenuList.recommendations.label'),
      description: t('components.profileMenuList.recommendations.parentingDescription'),
      route: '/(main)/recommendations',
    },
    {
      icon: require('../../assets/icon-camera.png'),
      label: t('components.profileMenuList.growthTimeline.label'),
      description: t('components.profileMenuList.growthTimeline.description'),
      route: '/(main)/album',
    },
    {
      icon: require('../../assets/icon-heart.png'),
      label: t('components.profileMenuList.momstagram.label'),
      description: t('components.profileMenuList.momstagram.description'),
      route: '/(main)/momstagram',
    },
    {
      icon: require('../../assets/growth-physical.png'),
      label: t('components.profileMenuList.growthStats.label'),
      description: t('components.profileMenuList.growthStats.description'),
      route: '/(main)/growth-stats',
    },
    {
      icon: require('../../assets/quick-timeline.png'),
      label: t('components.profileMenuList.growthAlbumMaker.label'),
      description: t('components.profileMenuList.growthAlbumMaker.description'),
      route: '/(main)/album',
    },
  ];
}

function getCommonBottomItems(t: TFunction): MenuItem[] {
  return [
    {
      icon: require('../../assets/badge-ai.png'),
      label: t('aiAnalysis.screenTitle'),
      description: t('components.profileMenuList.aiAnalysis.description'),
      route: '/(main)/ai-analysis',
    },
    {
      icon: require('../../assets/premium-badge.png'),
      label: t('subscription.screenTitle'),
      description: t('components.profileMenuList.premiumPlan.description'),
      route: '/(main)/subscription',
    },
    {
      icon: require('../../assets/icon-mic.png'),
      label: t('components.profileMenuList.voiceSettings.label'),
      description: t('components.profileMenuList.voiceSettings.description'),
      route: '/(main)/voice-settings',
    },
    {
      icon: require('../../assets/icon-bell.png'),
      label: t('notificationSettings.title'),
      description: t('components.profileMenuList.notificationSettings.description'),
      route: '/(main)/notification-settings',
    },
    {
      icon: require('../../assets/support-faq.png'),
      label: t('support.title'),
      description: t('components.profileMenuList.support.description'),
      route: '/(main)/support',
    },
    {
      icon: require('../../assets/support-faq.png'),
      label: t('terms.pageTitle'),
      description: t('components.profileMenuList.termsDescription'),
      route: '/(main)/terms',
    },
    {
      icon: require('../../assets/icon-lock.png'),
      label: t('privacy.pageTitle'),
      description: t('components.profileMenuList.privacyDescription'),
      route: '/(main)/privacy',
    },
  ];
}

export function ProfileMenuList() {
  const { t, i18n } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const isPregnant = selectedChild?.isPregnant === true;

  const modeItems = isPregnant ? getPregnancyItems(t) : getParentingItems(t);
  let items: MenuItem[] = [...getCommonTopItems(t), ...modeItems, ...getCommonBottomItems(t)];
  // 맘스톡(mom-group)은 한국 지역 기반 커뮤니티 — 비한국어 로케일에서는 숨김
  if (i18n.language !== 'ko') {
    items = items.filter((it) => it.route !== '/(main)/mom-group');
  }

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
