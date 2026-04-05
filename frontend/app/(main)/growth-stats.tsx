import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type TabKey = 'physical' | 'trait' | 'learning';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'physical', label: '키/몸무게' },
  { key: 'trait', label: '기질 변화' },
  { key: 'learning', label: '학습 활동' },
];

export default function GrowthStatsScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('physical');
  const selectedChild = useChildStore((s) => s.selectedChild);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <GrowthHeader />
      <FilterTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'physical' && (
        <PhysicalTab childName={selectedChild?.name ?? '아이'} />
      )}
      {activeTab === 'trait' && <TraitTab />}
      {activeTab === 'learning' && <LearningTab />}
    </ScrollView>
  );
}

function GrowthHeader() {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backArrow}>{'<'}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>성장 기록 & 변화</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function FilterTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}) {
  return (
    <View style={styles.tabsRow}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.key)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PhysicalTab({ childName }: { childName: string }) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const handleSave = () => {
    if (!height && !weight) {
      Alert.alert('알림', '키 또는 몸무게를 입력해주세요');
      return;
    }
    Alert.alert('저장 완료', `${childName}의 성장 기록이 저장되었습니다`);
    setHeight('');
    setWeight('');
  };

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>키 & 몸무게 변화</Text>
        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartIcon}>{'📈'}</Text>
          <Text style={styles.chartPlaceholderText}>
            데이터가 쌓이면 성장 차트가 표시됩니다
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>이번 달 기록</Text>
        <View style={styles.statsRow}>
          <StatBox label="키" value="-- cm" color={COLORS.secondary} />
          <StatBox label="몸무게" value="-- kg" color={COLORS.primary} />
          <StatBox label="성장 점수" value="--" color={COLORS.info} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>기록 입력</Text>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>키 (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>몸무게 (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />
          </View>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>기록 저장</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.statBox, { borderTopColor: color }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function TraitTab() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const dominantType = selectedChild?.innateData.dominantType ?? '--';

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>기질 변화 기록</Text>
        <View style={styles.traitInfo}>
          <Text style={styles.traitIcon}>{'🧠'}</Text>
          <Text style={styles.traitCurrentLabel}>현재 기질 유형</Text>
          <Text style={styles.traitCurrentValue}>{dominantType}</Text>
        </View>
        <View style={styles.traitNotice}>
          <Text style={styles.traitNoticeText}>
            기질 변화를 확인하려면 정기적으로 분석해주세요
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>분석 이력</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'📋'}</Text>
          <Text style={styles.emptyText}>
            추가 분석 기록이 쌓이면 변화를 비교할 수 있습니다
          </Text>
        </View>
      </View>
    </View>
  );
}

function LearningTab() {
  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>학습 활동 기록</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'📚'}</Text>
          <Text style={styles.emptyText}>
            학습 활동 데이터가 쌓이면 여기에 표시됩니다
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5EC',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
    paddingRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 24,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  chartPlaceholder: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
  },
  chartIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  chartPlaceholderText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  traitInfo: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  traitIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  traitCurrentLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  traitCurrentValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  traitNotice: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  traitNoticeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
