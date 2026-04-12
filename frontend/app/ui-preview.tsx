import { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

type StyleTab = 'A' | 'B' | 'C' | 'D' | 'E';

const TAB_LABELS: Record<StyleTab, string> = {
  A: 'A: Stories',
  B: 'B: Widgets',
  C: 'C: Timeline',
  D: 'D: Tinder',
  E: 'E: Magazine',
};

/* ═══════════════════════════════════════════
   Shared data
   ═══════════════════════════════════════════ */

const TRAITS = [
  { label: 'Explore', value: 85, color: '#38D9A9' },
  { label: 'Active', value: 60, color: '#FF6B6B' },
  { label: 'Stable', value: 45, color: '#FFC078' },
  { label: 'Analyze', value: 70, color: '#7C3AED' },
  { label: 'Sense', value: 55, color: '#38BDF8' },
];

const FEATURES = [
  { emoji: '\📖', label: 'Learning', sub: 'Creative writing' },
  { emoji: '\🏫', label: 'Academy', sub: '2 nearby' },
  { emoji: '\🥗', label: 'Nutrition', sub: 'Brain foods' },
  { emoji: '\📦', label: 'Kits', sub: 'New arrivals' },
];

const QUICK_ACTIONS = [
  { emoji: '\📊', label: 'Report' },
  { emoji: '\💕', label: 'Compat' },
  { emoji: '\⏱', label: 'Timer' },
  { emoji: '\📸', label: 'Album' },
  { emoji: '\👫', label: 'Mate' },
];

/* ═══════════════════════════════════════════
   Root Screen
   ═══════════════════════════════════════════ */

export default function UIPreviewScreen() {
  const [tab, setTab] = useState<StyleTab>('A');

  return (
    <View style={root.container}>
      {/* Tab selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={root.tabScroll}
        contentContainerStyle={root.tabBar}
      >
        {(['A', 'B', 'C', 'D', 'E'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[root.tab, tab === t && root.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[root.tabText, tab === t && root.tabTextActive]}>
              {TAB_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Body */}
      <View style={root.body}>
        {tab === 'A' && <StyleAStories />}
        {tab === 'B' && <StyleBWidgets />}
        {tab === 'C' && <StyleCTimeline />}
        {tab === 'D' && <StyleDTinder />}
        {tab === 'E' && <StyleEMagazine />}
      </View>
    </View>
  );
}

const root = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  tabScroll: { flexGrow: 0, paddingTop: 54, backgroundColor: '#1A1A2E' },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#2A2A3E',
  },
  tabActive: { backgroundColor: '#6C5CE7' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#FFF' },
  body: { flex: 1 },
});

/* ═══════════════════════════════════════════
   STYLE A — Stories + Horizontal Swipe
   Instagram/TikTok inspired
   ═══════════════════════════════════════════ */

function StyleAStories() {
  const [cardIndex, setCardIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const storyCircles = [
    { emoji: '\☀\️', label: 'Weather', ring: '#FF9F43' },
    { emoji: '\🌱', label: 'Trait', ring: '#38D9A9' },
    { emoji: '\📔', label: 'Diary', ring: '#6C5CE7' },
    { emoji: '\📸', label: 'Album', ring: '#FF6B6B' },
    { emoji: '\⏱', label: 'Timer', ring: '#38BDF8' },
    { emoji: '\📊', label: 'Report', ring: '#FFC078' },
  ];

  const cards = [
    {
      key: 'weather',
      bg: '#0F2027',
      accent: '#FF9F43',
      content: (
        <View style={sa.cardInner}>
          <Text style={sa.cardBigTemp}>26\°</Text>
          <Text style={sa.cardWeatherLabel}>Partly Cloudy</Text>
          <View style={sa.cardDivider} />
          <Text style={sa.cardMsg}>Perfect for outdoor exploration!</Text>
          <View style={sa.cardTagRow}>
            {['Nature Walk', 'Water Play', 'Sketching'].map((t) => (
              <View key={t} style={[sa.cardTag, { borderColor: '#FF9F43' }]}>
                <Text style={[sa.cardTagText, { color: '#FF9F43' }]}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      key: 'trait',
      bg: '#1A0A2E',
      accent: '#6C5CE7',
      content: (
        <View style={sa.cardInner}>
          <Text style={sa.cardTitle}>Trait Profile</Text>
          <Text style={[sa.cardSub, { marginBottom: 16 }]}>
            Seungha | Explorer | Elementary
          </Text>
          {TRAITS.map((t) => (
            <View key={t.label} style={sa.barRow}>
              <Text style={sa.barLabel}>{t.label}</Text>
              <View style={sa.barTrack}>
                <View
                  style={[
                    sa.barFill,
                    { width: `${t.value}%`, backgroundColor: t.color },
                  ]}
                />
              </View>
              <Text style={sa.barVal}>{t.value}</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      key: 'diary',
      bg: '#0A1628',
      accent: '#38BDF8',
      content: (
        <View style={sa.cardInner}>
          <Text style={sa.cardTitle}>Today&apos;s Diary</Text>
          <Text style={sa.cardSub}>What did Seungha discover today?</Text>
          <View style={sa.diaryPrompt}>
            <Text style={sa.diaryPromptText}>
              Tap to start writing...
            </Text>
          </View>
          <View style={sa.diaryTags}>
            {['\😊 Happy', '\🤔 Curious', '\😌 Calm'].map((m) => (
              <View key={m} style={sa.moodChip}>
                <Text style={sa.moodChipText}>{m}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      key: 'academy',
      bg: '#1A2810',
      accent: '#38D9A9',
      content: (
        <View style={sa.cardInner}>
          <Text style={sa.cardTitle}>Academy Picks</Text>
          <Text style={sa.cardSub}>2 academies nearby match Seungha&apos;s traits</Text>
          {FEATURES.map((f) => (
            <View key={f.label} style={sa.featureRow}>
              <Text style={sa.featureEmoji}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={sa.featureLabel}>{f.label}</Text>
                <Text style={sa.featureSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      ),
    },
  ];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SW - 40));
    setCardIndex(idx);
  };

  return (
    <View style={sa.bg}>
      {/* Greeting */}
      <View style={sa.greetRow}>
        <View>
          <Text style={sa.greetHi}>Good morning</Text>
          <Text style={sa.greetName}>Seungha</Text>
        </View>
        <View style={sa.avatar}>
          <Text style={sa.avatarText}>SH</Text>
        </View>
      </View>

      {/* Story circles */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sa.storyRow}
      >
        {storyCircles.map((s) => (
          <TouchableOpacity key={s.label} style={sa.storyItem}>
            <View style={[sa.storyRing, { borderColor: s.ring }]}>
              <View style={sa.storyCircle}>
                <Text style={sa.storyEmoji}>{s.emoji}</Text>
              </View>
            </View>
            <Text style={sa.storyLabel}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Swipeable cards */}
      <FlatList
        ref={flatRef}
        data={cards}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SW - 40}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 20 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={[sa.card, { backgroundColor: item.bg }]}>
            <View
              style={[sa.cardAccentLine, { backgroundColor: item.accent }]}
            />
            {item.content}
          </View>
        )}
      />

      {/* Dot indicators */}
      <View style={sa.dotRow}>
        {cards.map((_, i) => (
          <View
            key={i}
            style={[sa.dot, cardIndex === i && sa.dotActive]}
          />
        ))}
      </View>

      {/* Quick actions */}
      <View style={sa.quickRow}>
        {QUICK_ACTIONS.map((q) => (
          <TouchableOpacity key={q.label} style={sa.quickBtn}>
            <Text style={sa.quickEmoji}>{q.emoji}</Text>
            <Text style={sa.quickLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const sa = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0D0D1A' },
  greetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greetHi: { fontSize: 13, color: '#666', fontWeight: '400' },
  greetName: { fontSize: 24, color: '#FFF', fontWeight: '700', marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, color: '#FFF', fontWeight: '700' },
  storyRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  storyItem: { alignItems: 'center', width: 64 },
  storyRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyEmoji: { fontSize: 22 },
  storyLabel: { fontSize: 10, color: '#AAA', marginTop: 4, fontWeight: '500' },
  card: {
    width: SW - 40,
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: SH * 0.42,
  },
  cardAccentLine: { height: 3, width: '100%' },
  cardInner: { padding: 24, flex: 1 },
  cardBigTemp: { fontSize: 72, color: '#FFF', fontWeight: '100' },
  cardWeatherLabel: { fontSize: 18, color: 'rgba(255,255,255,0.6)', marginTop: -4 },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  cardMsg: { fontSize: 16, color: '#FFF', fontWeight: '600', lineHeight: 24 },
  cardTagRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  cardTag: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  cardTagText: { fontSize: 12, fontWeight: '600' },
  cardTitle: { fontSize: 22, color: '#FFF', fontWeight: '700', marginBottom: 4 },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  barLabel: { width: 52, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },
  barVal: {
    width: 28,
    fontSize: 13,
    color: '#FFF',
    fontWeight: '700',
    textAlign: 'right',
  },
  diaryPrompt: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    borderStyle: 'dashed',
  },
  diaryPromptText: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },
  diaryTags: { flexDirection: 'row', gap: 8, marginTop: 16 },
  moodChip: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  moodChipText: { fontSize: 13, color: '#38BDF8' },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
  },
  featureEmoji: { fontSize: 28 },
  featureLabel: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  featureSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: { backgroundColor: '#6C5CE7', width: 24 },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingBottom: 16,
  },
  quickBtn: { alignItems: 'center' },
  quickEmoji: { fontSize: 22 },
  quickLabel: { fontSize: 10, color: '#888', marginTop: 4 },
});

/* ═══════════════════════════════════════════
   STYLE B — Dashboard Widgets
   iOS / Samsung One UI widget board
   ═══════════════════════════════════════════ */

function StyleBWidgets() {
  return (
    <ScrollView style={sb.bg} contentContainerStyle={sb.content}>
      {/* Greeting */}
      <View style={sb.greetRow}>
        <View>
          <Text style={sb.greetHi}>Good morning</Text>
          <Text style={sb.greetName}>Seungha</Text>
        </View>
        <View style={sb.avatar}>
          <Text style={sb.avatarText}>SH</Text>
        </View>
      </View>

      {/* Large Hero Widget: Weather + Trait combined */}
      <View style={sb.heroWidget}>
        <View style={sb.heroTop}>
          <View>
            <Text style={sb.heroTemp}>26\°C</Text>
            <Text style={sb.heroWeather}>Partly Cloudy</Text>
          </View>
          <View style={sb.heroTraitBadge}>
            <Text style={sb.heroTraitLabel}>Explorer</Text>
          </View>
        </View>
        <View style={sb.heroDivider} />
        <Text style={sb.heroMsg}>Great day for outdoor exploration!</Text>
        {/* Mini trait bars inside hero */}
        <View style={sb.heroBarSection}>
          {TRAITS.map((t) => (
            <View key={t.label} style={sb.heroBarRow}>
              <Text style={sb.heroBarLabel}>{t.label}</Text>
              <View style={sb.heroBarTrack}>
                <View
                  style={[
                    sb.heroBarFill,
                    { width: `${t.value}%`, backgroundColor: t.color },
                  ]}
                />
              </View>
              <Text style={sb.heroBarVal}>{t.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 2 Medium Widgets side by side */}
      <View style={sb.medRow}>
        <View style={[sb.medWidget, { backgroundColor: '#FFF5EC' }]}>
          <Text style={sb.medIcon}>{'\📔'}</Text>
          <Text style={sb.medTitle}>Diary</Text>
          <Text style={sb.medSub}>What happened today?</Text>
          <View style={sb.medBtn}>
            <Text style={sb.medBtnText}>Write</Text>
          </View>
        </View>
        <View style={[sb.medWidget, { backgroundColor: '#ECFDF5' }]}>
          <Text style={sb.medIcon}>{'\🏫'}</Text>
          <Text style={sb.medTitle}>Academy</Text>
          <Text style={sb.medSub}>2 nearby matches</Text>
          <View style={[sb.medBtn, { backgroundColor: '#10B981' }]}>
            <Text style={sb.medBtnText}>View</Text>
          </View>
        </View>
      </View>

      {/* 3 Small Widgets in a row */}
      <View style={sb.smRow}>
        {[
          { emoji: '\🥗', label: 'Nutrition', val: '3 tips', bg: '#FEF3C7' },
          { emoji: '\⏱', label: 'Timer', val: '45 min', bg: '#EDE9FE' },
          { emoji: '\📸', label: 'Album', val: '12 pics', bg: '#FCE7F3' },
        ].map((w) => (
          <View key={w.label} style={[sb.smWidget, { backgroundColor: w.bg }]}>
            <Text style={sb.smEmoji}>{w.emoji}</Text>
            <Text style={sb.smLabel}>{w.label}</Text>
            <Text style={sb.smVal}>{w.val}</Text>
          </View>
        ))}
      </View>

      {/* Feature cards row */}
      <Text style={sb.sectionLabel}>Today&apos;s Picks</Text>
      <View style={sb.featureRow}>
        {FEATURES.map((f) => (
          <View key={f.label} style={sb.featureCard}>
            <Text style={sb.featureEmoji}>{f.emoji}</Text>
            <Text style={sb.featureTitle}>{f.label}</Text>
            <Text style={sb.featureSub}>{f.sub}</Text>
          </View>
        ))}
      </View>

      {/* Quick action row */}
      <Text style={sb.sectionLabel}>Quick Actions</Text>
      <View style={sb.qaRow}>
        {QUICK_ACTIONS.map((q) => (
          <TouchableOpacity key={q.label} style={sb.qaItem}>
            <View style={sb.qaCircle}>
              <Text style={sb.qaEmoji}>{q.emoji}</Text>
            </View>
            <Text style={sb.qaLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const sb = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 16, paddingBottom: 80 },
  greetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetHi: { fontSize: 13, color: '#8E8E93' },
  greetName: { fontSize: 26, color: '#000', fontWeight: '700', marginTop: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, color: '#FFF', fontWeight: '700' },
  heroWidget: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTemp: { fontSize: 42, fontWeight: '200', color: '#000' },
  heroWeather: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
  heroTraitBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  heroTraitLabel: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  heroDivider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginVertical: 14,
  },
  heroMsg: { fontSize: 15, color: '#000', fontWeight: '600', marginBottom: 14 },
  heroBarSection: { gap: 8 },
  heroBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroBarLabel: { width: 50, fontSize: 11, color: '#8E8E93', fontWeight: '500' },
  heroBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  heroBarFill: { height: 6, borderRadius: 3 },
  heroBarVal: { width: 26, fontSize: 12, color: '#000', fontWeight: '600', textAlign: 'right' },
  medRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  medWidget: {
    flex: 1,
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  medIcon: { fontSize: 32, marginBottom: 8 },
  medTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  medSub: { fontSize: 12, color: '#8E8E93', marginTop: 2, marginBottom: 12 },
  medBtn: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  medBtnText: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  smRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  smWidget: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  smEmoji: { fontSize: 28, marginBottom: 4 },
  smLabel: { fontSize: 12, fontWeight: '600', color: '#000' },
  smVal: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 10 },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  featureCard: {
    width: (SW - 42) / 2,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  featureEmoji: { fontSize: 28, marginBottom: 6 },
  featureTitle: { fontSize: 14, fontWeight: '600', color: '#000' },
  featureSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  qaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  qaItem: { alignItems: 'center' },
  qaCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  qaEmoji: { fontSize: 22 },
  qaLabel: { fontSize: 10, color: '#8E8E93', marginTop: 6, fontWeight: '500' },
});

/* ═══════════════════════════════════════════
   STYLE C — Timeline Feed
   Twitter / Threads inspired
   ═══════════════════════════════════════════ */

function StyleCTimeline() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpand = (key: string) => {
    setExpanded(expanded === key ? null : key);
  };

  const entries = [
    {
      key: 'weather',
      time: '08:00',
      dateLabel: 'Today',
      title: 'Weather Update',
      summary: '26\°C, Partly Cloudy',
      dot: '#FF9F43',
      expandContent: (
        <View style={sc.expandBox}>
          <Text style={sc.expandTemp}>26\°C</Text>
          <Text style={sc.expandWeather}>Partly Cloudy | Feels 28\°C | 62%</Text>
          <Text style={sc.expandMsg}>Great day for outdoor exploration!</Text>
          <View style={sc.expandTags}>
            {['Nature Walk', 'Water Play', 'Sketching'].map((t) => (
              <View key={t} style={sc.expandTag}>
                <Text style={sc.expandTagText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      key: 'trait',
      time: '09:00',
      dateLabel: 'Today',
      title: 'Trait Question',
      summary: 'How does Seungha react to new things?',
      dot: '#6C5CE7',
      expandContent: (
        <View style={sc.expandBox}>
          <Text style={sc.expandSub}>Seungha | Explorer | Elementary</Text>
          {TRAITS.map((t) => (
            <View key={t.label} style={sc.traitBarRow}>
              <Text style={sc.traitBarLabel}>{t.label}</Text>
              <View style={sc.traitBarTrack}>
                <View
                  style={[
                    sc.traitBarFill,
                    { width: `${t.value}%`, backgroundColor: t.color },
                  ]}
                />
              </View>
              <Text style={sc.traitBarVal}>{t.value}</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      key: 'diary',
      time: '',
      dateLabel: 'Yesterday',
      title: 'Observation Records',
      summary: '3 entries logged for Seungha',
      dot: '#38BDF8',
      expandContent: (
        <View style={sc.expandBox}>
          {['Played with blocks for 40 min', 'Read 2 picture books', 'Drew a family portrait'].map(
            (entry, i) => (
              <View key={i} style={sc.entryItem}>
                <View style={sc.entryBullet} />
                <Text style={sc.entryText}>{entry}</Text>
              </View>
            ),
          )}
        </View>
      ),
    },
    {
      key: 'academy',
      time: '',
      dateLabel: 'This week',
      title: 'Academy Recommendation',
      summary: 'Updated picks based on Explorer traits',
      dot: '#38D9A9',
      expandContent: (
        <View style={sc.expandBox}>
          {FEATURES.map((f) => (
            <View key={f.label} style={sc.featureItem}>
              <Text style={sc.featureItemEmoji}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={sc.featureItemLabel}>{f.label}</Text>
                <Text style={sc.featureItemSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      ),
    },
  ];

  let lastDate = '';

  return (
    <ScrollView style={sc.bg} contentContainerStyle={sc.content}>
      {/* Greeting */}
      <View style={sc.greetRow}>
        <View style={sc.avatar}>
          <Text style={sc.avatarText}>SH</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={sc.greetName}>Seungha</Text>
          <Text style={sc.greetSub}>Explorer | Elementary</Text>
        </View>
        <Text style={sc.greetTemp}>26\°C</Text>
      </View>

      {/* Timeline */}
      <View style={sc.timeline}>
        {/* Vertical line */}
        <View style={sc.timelineLine} />

        {entries.map((entry) => {
          const showDateHeader = entry.dateLabel !== lastDate;
          lastDate = entry.dateLabel;

          return (
            <View key={entry.key}>
              {showDateHeader && (
                <View style={sc.dateHeader}>
                  <Text style={sc.dateText}>{entry.dateLabel}</Text>
                </View>
              )}
              <TouchableOpacity
                style={sc.entryRow}
                onPress={() => toggleExpand(entry.key)}
                activeOpacity={0.7}
              >
                {/* Dot on timeline */}
                <View style={sc.dotCol}>
                  <View style={[sc.dot, { backgroundColor: entry.dot }]} />
                </View>

                {/* Content */}
                <View style={sc.entryContent}>
                  {entry.time ? (
                    <Text style={sc.entryTime}>{entry.time}</Text>
                  ) : null}
                  <Text style={sc.entryTitle}>{entry.title}</Text>
                  <Text style={sc.entrySummary}>{entry.summary}</Text>
                  <Text style={sc.expandHint}>
                    {expanded === entry.key ? 'Tap to collapse' : 'Tap to expand'}
                  </Text>
                  {expanded === entry.key && entry.expandContent}
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Quick actions at bottom */}
      <View style={sc.qaRow}>
        {QUICK_ACTIONS.map((q) => (
          <TouchableOpacity key={q.label} style={sc.qaItem}>
            <Text style={sc.qaEmoji}>{q.emoji}</Text>
            <Text style={sc.qaLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const sc = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { paddingBottom: 80 },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, color: '#FFF', fontWeight: '700' },
  greetName: { fontSize: 18, fontWeight: '700', color: '#111' },
  greetSub: { fontSize: 12, color: '#999', marginTop: 2 },
  greetTemp: { fontSize: 18, fontWeight: '600', color: '#FF9F43' },
  timeline: { position: 'relative', paddingLeft: 40, paddingTop: 12 },
  timelineLine: {
    position: 'absolute',
    left: 27,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#E8E8E8',
  },
  dateHeader: {
    paddingVertical: 8,
    paddingLeft: 4,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  entryRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dotCol: {
    position: 'absolute',
    left: -21,
    top: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  entryContent: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  entryTime: { fontSize: 11, color: '#BBB', fontWeight: '500', marginBottom: 4 },
  entryTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  entrySummary: { fontSize: 13, color: '#666', marginTop: 2 },
  expandHint: {
    fontSize: 11,
    color: '#6C5CE7',
    fontWeight: '600',
    marginTop: 8,
  },
  expandBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  expandTemp: { fontSize: 36, fontWeight: '200', color: '#FF9F43' },
  expandWeather: { fontSize: 12, color: '#999', marginTop: 4 },
  expandMsg: { fontSize: 14, fontWeight: '600', color: '#111', marginTop: 8 },
  expandTags: { flexDirection: 'row', gap: 8, marginTop: 10 },
  expandTag: {
    backgroundColor: '#FFF5EC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expandTagText: { fontSize: 11, color: '#FF9F43', fontWeight: '600' },
  expandSub: { fontSize: 12, color: '#999', marginBottom: 10 },
  traitBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  traitBarLabel: { width: 46, fontSize: 11, color: '#999', fontWeight: '500' },
  traitBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#F4F4F4',
    borderRadius: 3,
    overflow: 'hidden',
  },
  traitBarFill: { height: 6, borderRadius: 3 },
  traitBarVal: { width: 24, fontSize: 12, color: '#111', fontWeight: '600', textAlign: 'right' },
  entryItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  entryBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  entryText: { fontSize: 13, color: '#444' },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
  },
  featureItemEmoji: { fontSize: 24 },
  featureItemLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
  featureItemSub: { fontSize: 11, color: '#999', marginTop: 1 },
  qaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: '#FFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  qaItem: { alignItems: 'center' },
  qaEmoji: { fontSize: 22 },
  qaLabel: { fontSize: 10, color: '#999', marginTop: 4, fontWeight: '500' },
});

/* ═══════════════════════════════════════════
   STYLE D — Tinder-style vertical card stack
   One card at a time, swipe UP
   ═══════════════════════════════════════════ */

function StyleDTinder() {
  const [cardIdx, setCardIdx] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const cards = [
    {
      key: 'weather',
      bg: ['#FF9F43', '#FF6B6B'],
      content: (
        <View style={sd.cardBody}>
          <Text style={sd.cardEmoji}>{'\☀\️'}</Text>
          <Text style={sd.bigLabel}>Weather</Text>
          <Text style={sd.bigTemp}>26\°C</Text>
          <Text style={sd.bigSub}>Partly Cloudy | Feels 28\°C</Text>
          <View style={sd.divider} />
          <Text style={sd.cardMsg}>Perfect day for outdoor exploration!</Text>
          <View style={sd.tagRow}>
            {['Nature Walk', 'Water Play', 'Sketching'].map((t) => (
              <View key={t} style={sd.tag}>
                <Text style={sd.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      key: 'trait',
      bg: ['#6C5CE7', '#A29BFE'],
      content: (
        <View style={sd.cardBody}>
          <Text style={sd.cardEmoji}>{'\🌱'}</Text>
          <Text style={sd.bigLabel}>Trait Profile</Text>
          <Text style={sd.bigName}>Seungha</Text>
          <Text style={sd.bigSub}>Explorer | Elementary</Text>
          <View style={sd.divider} />
          {TRAITS.map((t) => (
            <View key={t.label} style={sd.barRow}>
              <Text style={sd.barLabel}>{t.label}</Text>
              <View style={sd.barTrack}>
                <View
                  style={[
                    sd.barFill,
                    { width: `${t.value}%`, backgroundColor: t.color },
                  ]}
                />
              </View>
              <Text style={sd.barVal}>{t.value}</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      key: 'activity',
      bg: ['#38D9A9', '#20C997'],
      content: (
        <View style={sd.cardBody}>
          <Text style={sd.cardEmoji}>{'\🎯'}</Text>
          <Text style={sd.bigLabel}>Today&apos;s Activity</Text>
          <View style={sd.divider} />
          {FEATURES.map((f) => (
            <View key={f.label} style={sd.actRow}>
              <Text style={sd.actEmoji}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={sd.actLabel}>{f.label}</Text>
                <Text style={sd.actSub}>{f.sub}</Text>
              </View>
              <View style={sd.actArrow}>
                <Text style={sd.actArrowText}>{'\→'}</Text>
              </View>
            </View>
          ))}
        </View>
      ),
    },
    {
      key: 'diary',
      bg: ['#38BDF8', '#0EA5E9'],
      content: (
        <View style={sd.cardBody}>
          <Text style={sd.cardEmoji}>{'\📔'}</Text>
          <Text style={sd.bigLabel}>Diary</Text>
          <Text style={sd.bigSub}>What did Seungha discover today?</Text>
          <View style={sd.divider} />
          <View style={sd.diaryBox}>
            <Text style={sd.diaryPlaceholder}>Tap to start writing...</Text>
          </View>
          <View style={sd.moodRow}>
            {['\😊', '\🤔', '\😌', '\🤩', '\😢'].map((m) => (
              <View key={m} style={sd.moodCircle}>
                <Text style={sd.moodText}>{m}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      key: 'academy',
      bg: ['#FFC078', '#FF9F43'],
      content: (
        <View style={sd.cardBody}>
          <Text style={sd.cardEmoji}>{'\🏫'}</Text>
          <Text style={sd.bigLabel}>Academy</Text>
          <Text style={sd.bigSub}>Recommendations for Seungha</Text>
          <View style={sd.divider} />
          <Text style={sd.acaHighlight}>2 academies within 5km</Text>
          <Text style={sd.acaDetail}>
            Based on Explorer traits, creative and nature-focused programs are best.
          </Text>
        </View>
      ),
    },
  ];

  const bgColor = cards[cardIdx]?.bg[0] ?? '#333';

  const onVerticalScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const cardH = SH - 200;
    const idx = Math.round(e.nativeEvent.contentOffset.y / cardH);
    if (idx >= 0 && idx < cards.length) {
      setCardIdx(idx);
    }
  };

  return (
    <View style={[sd.bg, { backgroundColor: bgColor }]}>
      {/* Greeting bar */}
      <View style={sd.topBar}>
        <View>
          <Text style={sd.topGreet}>Good morning</Text>
          <Text style={sd.topName}>Seungha</Text>
        </View>
        <Text style={sd.topCounter}>
          {cardIdx + 1} / {cards.length}
        </Text>
      </View>

      {/* Vertical scrolling cards */}
      <FlatList
        ref={flatRef}
        data={cards}
        pagingEnabled={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={SH - 200}
        decelerationRate="fast"
        onScroll={onVerticalScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={sd.card}>
            {item.content}
          </View>
        )}
      />

      {/* Bottom quick actions */}
      <View style={sd.bottomBar}>
        {QUICK_ACTIONS.map((q) => (
          <TouchableOpacity key={q.label} style={sd.bottomBtn}>
            <Text style={sd.bottomEmoji}>{q.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const sd = StyleSheet.create({
  bg: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  topGreet: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  topName: { fontSize: 22, color: '#FFF', fontWeight: '700' },
  topCounter: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  card: {
    height: SH - 200,
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 32,
    overflow: 'hidden',
  },
  cardBody: { flex: 1, padding: 28, justifyContent: 'center' },
  cardEmoji: { fontSize: 48, marginBottom: 8 },
  bigLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2 },
  bigTemp: { fontSize: 64, color: '#FFF', fontWeight: '100', marginTop: 4 },
  bigName: { fontSize: 36, color: '#FFF', fontWeight: '700', marginTop: 4 },
  bigSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 20 },
  cardMsg: { fontSize: 18, color: '#FFF', fontWeight: '600', lineHeight: 26 },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagText: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  barLabel: { width: 52, fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  barVal: { width: 28, fontSize: 14, color: '#FFF', fontWeight: '700', textAlign: 'right' },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
  },
  actEmoji: { fontSize: 28 },
  actLabel: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  actSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  actArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actArrowText: { fontSize: 16, color: '#FFF' },
  diaryBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    minHeight: 100,
  },
  diaryPlaceholder: { fontSize: 15, color: 'rgba(255,255,255,0.3)' },
  moodRow: { flexDirection: 'row', gap: 12, marginTop: 20, justifyContent: 'center' },
  moodCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodText: { fontSize: 24 },
  acaHighlight: {
    fontSize: 22,
    color: '#FFF',
    fontWeight: '700',
    marginBottom: 10,
  },
  acaDetail: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24 },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  bottomBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomEmoji: { fontSize: 22 },
});

/* ═══════════════════════════════════════════
   STYLE E — Magazine / Pinterest Layout
   Masonry grid with varying heights
   ═══════════════════════════════════════════ */

function StyleEMagazine() {
  return (
    <ScrollView style={se.bg} contentContainerStyle={se.content}>
      {/* Hero illustration area */}
      <View style={se.hero}>
        <View style={se.heroOverlay}>
          <Text style={se.heroGreet}>Good morning</Text>
          <Text style={se.heroName}>Seungha</Text>
          <View style={se.heroChip}>
            <Text style={se.heroChipText}>Explorer | Elementary</Text>
          </View>
        </View>
        <View style={se.heroGraphic}>
          <Text style={se.heroEmoji}>{'\🌏'}</Text>
          <Text style={se.heroTemp}>26\°C</Text>
        </View>
      </View>

      {/* Wide weather card (full width) */}
      <View style={se.wideCard}>
        <View style={se.wideCardInner}>
          <View style={se.wideLeft}>
            <Text style={se.wideIcon}>{'\⛅'}</Text>
            <View>
              <Text style={se.wideTemp}>26\°C</Text>
              <Text style={se.wideSub}>Partly Cloudy</Text>
            </View>
          </View>
          <View style={se.wideRight}>
            {['Nature Walk', 'Water Play'].map((t) => (
              <View key={t} style={se.wideTag}>
                <Text style={se.wideTagText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Masonry: 2-column with different heights */}
      <View style={se.masonry}>
        {/* Left column */}
        <View style={se.masonryCol}>
          {/* Tall: Trait profile */}
          <View style={[se.mCard, se.mCardTall, { backgroundColor: '#F3EAFF' }]}>
            <Text style={se.mCardTag}>TRAIT PROFILE</Text>
            <Text style={se.mCardTitle}>Seungha</Text>
            {TRAITS.map((t) => (
              <View key={t.label} style={se.mBarRow}>
                <Text style={se.mBarLabel}>{t.label}</Text>
                <View style={se.mBarTrack}>
                  <View
                    style={[
                      se.mBarFill,
                      { width: `${t.value}%`, backgroundColor: t.color },
                    ]}
                  />
                </View>
                <Text style={se.mBarVal}>{t.value}</Text>
              </View>
            ))}
          </View>

          {/* Short: Timer */}
          <View style={[se.mCard, se.mCardShort, { backgroundColor: '#E0F7FA' }]}>
            <Text style={se.mShortEmoji}>{'\⏱'}</Text>
            <Text style={se.mShortLabel}>Timer</Text>
            <Text style={se.mShortVal}>45 min</Text>
          </View>

          {/* Medium: Nutrition */}
          <View style={[se.mCard, se.mCardMed, { backgroundColor: '#FFF8E1' }]}>
            <Text style={se.mMedEmoji}>{'\🥗'}</Text>
            <Text style={se.mMedTitle}>Nutrition</Text>
            <Text style={se.mMedSub}>Brain foods for Explorer types</Text>
            <View style={se.mMedBtn}>
              <Text style={se.mMedBtnText}>See tips</Text>
            </View>
          </View>
        </View>

        {/* Right column */}
        <View style={se.masonryCol}>
          {/* Medium: Diary */}
          <View style={[se.mCard, se.mCardMed, { backgroundColor: '#FFEBEE' }]}>
            <Text style={se.mMedEmoji}>{'\📔'}</Text>
            <Text style={se.mMedTitle}>Diary</Text>
            <Text style={se.mMedSub}>What happened today?</Text>
            <View style={[se.mMedBtn, { backgroundColor: '#EF5350' }]}>
              <Text style={se.mMedBtnText}>Write</Text>
            </View>
          </View>

          {/* Medium: Academy */}
          <View style={[se.mCard, se.mCardMed, { backgroundColor: '#E8F5E9' }]}>
            <Text style={se.mMedEmoji}>{'\🏫'}</Text>
            <Text style={se.mMedTitle}>Academy</Text>
            <Text style={se.mMedSub}>2 nearby matches</Text>
            <View style={[se.mMedBtn, { backgroundColor: '#43A047' }]}>
              <Text style={se.mMedBtnText}>Explore</Text>
            </View>
          </View>

          {/* Short: Album */}
          <View style={[se.mCard, se.mCardShort, { backgroundColor: '#FCE4EC' }]}>
            <Text style={se.mShortEmoji}>{'\📸'}</Text>
            <Text style={se.mShortLabel}>Album</Text>
            <Text style={se.mShortVal}>12 photos</Text>
          </View>

          {/* Tall-ish: Feature cards stacked */}
          <View style={[se.mCard, { backgroundColor: '#EDE7F6', padding: 14 }]}>
            <Text style={se.mCardTag}>TODAY&apos;S PICKS</Text>
            {FEATURES.map((f) => (
              <View key={f.label} style={se.mPickRow}>
                <Text style={se.mPickEmoji}>{f.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={se.mPickLabel}>{f.label}</Text>
                  <Text style={se.mPickSub}>{f.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={se.qaBar}>
        {QUICK_ACTIONS.map((q) => (
          <TouchableOpacity key={q.label} style={se.qaItem}>
            <View style={se.qaCircle}>
              <Text style={se.qaEmoji}>{q.emoji}</Text>
            </View>
            <Text style={se.qaLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const se = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#FFF' },
  content: { paddingBottom: 80 },
  hero: {
    height: SH * 0.28,
    backgroundColor: '#1A1A2E',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroOverlay: { flex: 1 },
  heroGreet: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  heroName: { fontSize: 32, color: '#FFF', fontWeight: '800', marginTop: 4 },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  heroChipText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  heroGraphic: { alignItems: 'center' },
  heroEmoji: { fontSize: 56 },
  heroTemp: { fontSize: 18, color: '#FFF', fontWeight: '600', marginTop: 4 },
  wideCard: {
    marginHorizontal: 12,
    marginTop: -16,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  wideCardInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wideLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wideIcon: { fontSize: 36 },
  wideTemp: { fontSize: 22, fontWeight: '700', color: '#111' },
  wideSub: { fontSize: 12, color: '#999' },
  wideRight: { flexDirection: 'row', gap: 6 },
  wideTag: {
    backgroundColor: '#FFF5EC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  wideTagText: { fontSize: 11, color: '#FF9F43', fontWeight: '600' },
  masonry: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 12,
    gap: 8,
  },
  masonryCol: { flex: 1, gap: 8 },
  mCard: { borderRadius: 20, padding: 16, overflow: 'hidden' },
  mCardTall: { minHeight: 240 },
  mCardMed: { minHeight: 170 },
  mCardShort: { minHeight: 110, alignItems: 'center', justifyContent: 'center' },
  mCardTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  mCardTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 10 },
  mBarRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  mBarLabel: { width: 42, fontSize: 10, color: '#888', fontWeight: '500' },
  mBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  mBarFill: { height: 5, borderRadius: 2.5 },
  mBarVal: { width: 22, fontSize: 11, color: '#333', fontWeight: '600', textAlign: 'right' },
  mShortEmoji: { fontSize: 32, marginBottom: 4 },
  mShortLabel: { fontSize: 14, fontWeight: '700', color: '#111' },
  mShortVal: { fontSize: 12, color: '#888', marginTop: 2 },
  mMedEmoji: { fontSize: 32, marginBottom: 6 },
  mMedTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  mMedSub: { fontSize: 12, color: '#888', marginTop: 2, marginBottom: 12 },
  mMedBtn: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  mMedBtnText: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  mPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    padding: 10,
  },
  mPickEmoji: { fontSize: 22 },
  mPickLabel: { fontSize: 13, fontWeight: '600', color: '#111' },
  mPickSub: { fontSize: 11, color: '#888' },
  qaBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginHorizontal: 12,
    marginTop: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
  },
  qaItem: { alignItems: 'center' },
  qaCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  qaEmoji: { fontSize: 20 },
  qaLabel: { fontSize: 10, color: '#888', marginTop: 5, fontWeight: '500' },
});
