import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { retentionApi, premiumApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';

const SCREEN_WIDTH = Dimensions.get('window').width;

/* ------------------------------------------------------------------ */
/* Level / Reward Config                                               */
/* ------------------------------------------------------------------ */

interface LevelConfig {
  level: number;
  name: string;
  icon: string;
  minDays: number;
  passportColors: string[];
  premiumDays: number;
  desc: string;
  stampIcon: string;
}

export const LEVELS: LevelConfig[] = [
  {
    level: 1, name: '새싹 부모', icon: '🌱',
    minDays: 0, passportColors: ['#1A3A5C', '#2A5A8C'],
    premiumDays: 7, desc: '육아 여정의 첫 발걸음 (7일 무료체험)',
    stampIcon: '🌱',
  },
  {
    level: 2, name: '줄기 부모', icon: '🪴',
    minDays: 14, passportColors: ['#1B5E20', '#2E7D32'],
    premiumDays: 3, desc: '14일 연속 사용 달성',
    stampIcon: '🌿',
  },
  {
    level: 3, name: '꽃봉오리 부모', icon: '🌸',
    minDays: 30, passportColors: ['#AD1457', '#E91E63'],
    premiumDays: 5, desc: '30일 연속 사용 달성',
    stampIcon: '🌺',
  },
  {
    level: 4, name: '만개 부모', icon: '🌻',
    minDays: 60, passportColors: ['#BF953F', '#D4AF37'],
    premiumDays: 7, desc: '60일 연속! AI코칭 무제한',
    stampIcon: '🏅',
  },
  {
    level: 5, name: '열매 부모', icon: '💎',
    minDays: 100, passportColors: ['#6A1B9A', '#E040FB', '#00BCD4'],
    premiumDays: 14, desc: '100일 연속! 전설의 육아러',
    stampIcon: '👑',
  },
];

const COLOR = {
  bg: '#FFF5EC',
  card: '#FFFFFF',
  text: '#2D2016',
  textSub: '#8C7A6B',
  accent: '#FF8C5A',
  gold: '#BF953F',
  locked: '#D5CFC7',
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function ParentLevelScreen() {
  const insets = useSafeAreaInsets();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);

  useEffect(() => {
    if (!selectedChild) return;
    retentionApi.streak(selectedChild.id).then((res) => {
      const data = res.data?.data as {
        currentStreak: number;
        level: number;
      } | undefined;
      if (data) {
        setCurrentStreak(data.currentStreak);
        setCurrentLevel(data.level);
      }
    }).catch(() => {});
  }, [selectedChild]);

  const getCurrentLevelConfig = () =>
    LEVELS.find((l) => l.level === currentLevel) ?? LEVELS[0];

  const getNextLevel = () =>
    LEVELS.find((l) => l.level === currentLevel + 1);

  const handleClaimReward = useCallback(async (level: LevelConfig) => {
    if (currentLevel < level.level) return;
    if (level.premiumDays <= 0) return;

    try {
      await premiumApi.startTrial();
      Alert.alert(
        'LEVEL UP!',
        `${level.name} 보상으로 프리미엄 ${level.premiumDays}일을 받았습니다!`,
      );
    } catch {
      Alert.alert('알림', '이미 보상을 받았습니다.');
    }
  }, [currentLevel]);

  const current = getCurrentLevelConfig();
  const next = getNextLevel();
  const progress = next ? Math.min(currentStreak / next.minDays, 1) : 1;
  const childName = selectedChild?.name ?? '아이';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Current Level Hero */}
        <LinearGradient
          colors={current.passportColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroIcon}>{current.icon}</Text>
          <Text style={styles.heroLevel}>Lv.{current.level}</Text>
          <Text style={styles.heroName}>{current.name}</Text>
          <Text style={styles.heroStreak}>{currentStreak}일 연속 접속</Text>

          {next && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
                다음 레벨까지 {Math.max(next.minDays - currentStreak, 0)}일
              </Text>
            </View>
          )}
          {!next && (
            <Text style={styles.heroMaxText}>최고 레벨 달성!</Text>
          )}
        </LinearGradient>

        {/* Passport Skin Preview — detailed cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>여권 스킨 미리보기</Text>
          <Text style={styles.sectionDesc}>레벨이 올라갈수록 아이 여권 디자인이 변합니다</Text>

          {LEVELS.map((lvl) => {
            const unlocked = currentLevel >= lvl.level;
            const isCurrent = currentLevel === lvl.level;

            return (
              <View key={lvl.level} style={[styles.passportWrap, isCurrent && styles.passportWrapCurrent]}>
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>현재 사용중</Text>
                  </View>
                )}

                <LinearGradient
                  colors={(unlocked ? lvl.passportColors : ['#D5CFC7', '#BFBAB2']) as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.passportCard}
                >
                  {/* Top row */}
                  <View style={styles.ppTop}>
                    <Text style={styles.ppTitle}>PASSPORT</Text>
                    <Text style={styles.ppLevelBadge}>Lv.{lvl.level}</Text>
                  </View>

                  {/* Middle — photo area + info */}
                  <View style={styles.ppMiddle}>
                    <View style={styles.ppPhotoArea}>
                      <Text style={styles.ppPhotoIcon}>{unlocked ? lvl.icon : '🔒'}</Text>
                    </View>
                    <View style={styles.ppInfo}>
                      <Text style={styles.ppInfoLabel}>NAME</Text>
                      <Text style={styles.ppInfoValue}>{unlocked ? childName : '???'}</Text>
                      <Text style={styles.ppInfoLabel}>LEVEL</Text>
                      <Text style={styles.ppInfoValue}>{unlocked ? lvl.name : '미해금'}</Text>
                      <Text style={styles.ppInfoLabel}>STAMP</Text>
                      <View style={styles.ppStamps}>
                        {LEVELS.slice(0, lvl.level).map((s) => (
                          <Text key={s.level} style={styles.ppStamp}>
                            {unlocked ? s.stampIcon : '⬜'}
                          </Text>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Bottom */}
                  <View style={styles.ppBottom}>
                    <Text style={styles.ppBottomText}>
                      {unlocked
                        ? `${lvl.minDays}일 달성 | SY Labs`
                        : `${lvl.minDays}일 연속 접속 시 해금`}
                    </Text>
                  </View>

                  {/* Lock overlay */}
                  {!unlocked && (
                    <View style={styles.ppLockOverlay}>
                      <Text style={styles.ppLockIcon}>{'🔒'}</Text>
                      <Text style={styles.ppLockText}>{lvl.minDays}일 후 해금</Text>
                    </View>
                  )}
                </LinearGradient>

                {/* Reward info */}
                <View style={styles.ppReward}>
                  <Text style={styles.ppRewardIcon}>{unlocked ? '🎁' : '🔒'}</Text>
                  <Text style={styles.ppRewardText}>
                    {lvl.premiumDays > 0
                      ? `프리미엄 ${lvl.premiumDays}일 + 여권 스킨`
                      : '여권 스킨 해금'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Reward List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>레벨 보상</Text>
          {LEVELS.map((lvl) => {
            const unlocked = currentLevel >= lvl.level;
            return (
              <TouchableOpacity
                key={lvl.level}
                style={[styles.rewardCard, unlocked && styles.rewardCardUnlocked]}
                onPress={() => handleClaimReward(lvl)}
                activeOpacity={unlocked ? 0.7 : 1}
                disabled={!unlocked || lvl.premiumDays <= 0}
              >
                <Text style={styles.rewardIcon}>{unlocked ? lvl.icon : '🔒'}</Text>
                <View style={styles.rewardInfo}>
                  <Text style={[styles.rewardName, !unlocked && styles.rewardNameLocked]}>
                    Lv.{lvl.level} {lvl.name}
                  </Text>
                  <Text style={styles.rewardDesc}>{lvl.desc}</Text>
                  {lvl.premiumDays > 0 && (
                    <View style={styles.rewardTag}>
                      <Text style={styles.rewardTagText}>
                        {'🎁'} 프리미엄 {lvl.premiumDays}일 + 여권 스킨
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rewardDays}>{lvl.minDays}일</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: insets.bottom + 30 }} />
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const PASSPORT_WIDTH = SCREEN_WIDTH - 80;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  /* Hero */
  heroCard: {
    borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  heroIcon: { fontSize: 56 },
  heroLevel: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  heroName: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  heroStreak: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  heroMaxText: { fontSize: 15, fontWeight: '700', color: '#FFD76E', marginTop: 12 },
  progressWrap: { width: '100%', marginTop: 16 },
  progressBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: '#FFD76E' },
  progressText: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 6 },

  /* Section */
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLOR.text, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: COLOR.textSub, marginBottom: 14 },

  /* Passport Preview — detailed card */
  passportWrap: {
    marginBottom: 20, alignItems: 'center',
  },
  passportWrapCurrent: {
    borderWidth: 2, borderColor: COLOR.accent, borderRadius: 20, padding: 8,
    backgroundColor: '#FFF8F3',
  },
  currentBadge: {
    backgroundColor: COLOR.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4,
    alignSelf: 'center', marginBottom: 8,
  },
  currentBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  passportCard: {
    width: PASSPORT_WIDTH, height: PASSPORT_WIDTH * 0.65,
    borderRadius: 16, padding: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  ppTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  ppTitle: {
    fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
  },
  ppLevelBadge: {
    fontSize: 11, fontWeight: '700', color: '#FFD76E',
    backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  ppMiddle: {
    flexDirection: 'row', marginTop: 12, flex: 1,
  },
  ppPhotoArea: {
    width: 64, height: 78, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  ppPhotoIcon: { fontSize: 32 },
  ppInfo: { marginLeft: 14, flex: 1, justifyContent: 'center' },
  ppInfoLabel: {
    fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1, marginTop: 4,
  },
  ppInfoValue: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.95)',
  },
  ppStamps: { flexDirection: 'row', gap: 4, marginTop: 2 },
  ppStamp: { fontSize: 14 },
  ppBottom: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 6, marginTop: 6,
  },
  ppBottomText: {
    fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textAlign: 'center',
  },

  /* Lock overlay */
  ppLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  ppLockIcon: { fontSize: 36 },
  ppLockText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  /* Reward under passport */
  ppReward: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#FFF0E6', borderRadius: 10,
  },
  ppRewardIcon: { fontSize: 14, marginRight: 6 },
  ppRewardText: { fontSize: 12, fontWeight: '600', color: COLOR.accent },

  /* Rewards */
  rewardCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLOR.card, borderRadius: 16, padding: 16,
    marginBottom: 10, opacity: 0.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  rewardCardUnlocked: { opacity: 1 },
  rewardIcon: { fontSize: 36, marginRight: 14 },
  rewardInfo: { flex: 1 },
  rewardName: { fontSize: 15, fontWeight: '700', color: COLOR.text },
  rewardNameLocked: { color: COLOR.locked },
  rewardDesc: { fontSize: 12, color: COLOR.textSub, marginTop: 2 },
  rewardTag: {
    backgroundColor: '#FFF0E6', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start',
  },
  rewardTagText: { fontSize: 11, fontWeight: '600', color: COLOR.accent },
  rewardDays: { fontSize: 13, fontWeight: '700', color: COLOR.textSub },
});
