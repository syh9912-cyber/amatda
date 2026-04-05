import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

type StyleTab = 'A' | 'B' | 'C';

export default function UIPreviewScreen() {
  const [tab, setTab] = useState<StyleTab>('A');

  return (
    <View style={root.container}>
      <View style={root.tabBar}>
        {(['A', 'B', 'C'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[root.tab, tab === t && root.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[root.tabText, tab === t && root.tabTextActive]}>
              {t === 'A' && 'A: Glass Morphism'}
              {t === 'B' && 'B: Minimal Clean'}
              {t === 'C' && 'C: Warm Organic'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={root.body} contentContainerStyle={root.bodyContent}>
        {tab === 'A' && <StyleAMockup />}
        {tab === 'B' && <StyleBMockup />}
        {tab === 'C' && <StyleCMockup />}
      </ScrollView>
    </View>
  );
}

const root = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0EBF8' },
  tabBar: {
    flexDirection: 'row',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#1E1E2E' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#FFF' },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 80 },
});

/* ────────────────────────────────────────────
   STYLE A: Glass Morphism + Depth
   ──────────────────────────────────────────── */

function StyleAMockup() {
  return (
    <View style={a.bg}>
      <View style={a.headerGradient}>
        <View style={a.headerRow}>
          <View>
            <Text style={a.greeting}>Good morning</Text>
            <Text style={a.childName}>Seungha</Text>
          </View>
          <View style={a.avatar}>
            <Text style={a.avatarText}>SH</Text>
          </View>
        </View>
      </View>

      <View style={a.content}>
        {/* Weather Hero */}
        <View style={a.weatherCard}>
          <View style={a.weatherGrad}>
            <View style={a.weatherTop}>
              <Text style={a.weatherIcon}>26</Text>
              <Text style={a.weatherDeg}>°C</Text>
              <View style={a.weatherMeta}>
                <Text style={a.weatherDesc}>Partly Cloudy</Text>
                <Text style={a.weatherSub}>Feels 28°C  |  62%</Text>
              </View>
            </View>
            <Text style={a.weatherMsg}>
              Today is great for outdoor exploration!
            </Text>
            <View style={a.pillRow}>
              {['Nature Walk', 'Water Play', 'Sketching'].map((p) => (
                <View key={p} style={a.pill}>
                  <Text style={a.pillText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Trait Summary */}
        <View style={a.glassCard}>
          <Text style={a.sectionLabel}>Trait Profile</Text>
          <View style={a.traitRow}>
            <Text style={a.traitName}>Seungha  |  Explorer  |  Elementary</Text>
            <Text style={a.traitLink}>Details</Text>
          </View>
          {renderBarsA()}
        </View>

        {/* Action Cards */}
        <Text style={a.sectionTitle}>Today's Picks</Text>
        <View style={a.cardGrid}>
          {[
            { emoji: '📖', label: 'Learning', sub: 'Creative writing' },
            { emoji: '🏫', label: 'Academy', sub: '2 nearby' },
            { emoji: '🥗', label: 'Nutrition', sub: 'Brain foods' },
            { emoji: '📦', label: 'Kits', sub: 'New arrivals' },
          ].map((c) => (
            <View key={c.label} style={a.actionCard}>
              <Text style={a.actionEmoji}>{c.emoji}</Text>
              <Text style={a.actionLabel}>{c.label}</Text>
              <Text style={a.actionSub}>{c.sub}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={a.sectionTitle}>Quick Actions</Text>
        <View style={a.quickGrid}>
          {[
            { emoji: '📊', label: 'Report' },
            { emoji: '💕', label: 'Sibling' },
            { emoji: '📸', label: 'Album' },
            { emoji: '⏱️', label: 'Timer' },
            { emoji: '👫', label: 'Mates' },
            { emoji: '📔', label: 'Diary' },
          ].map((q) => (
            <View key={q.label} style={a.quickItem}>
              <Text style={a.quickEmoji}>{q.emoji}</Text>
              <Text style={a.quickLabel}>{q.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function renderBarsA() {
  const bars = [
    { label: 'Explore', value: 85, color: '#38D9A9' },
    { label: 'Active', value: 60, color: '#FF6B6B' },
    { label: 'Stable', value: 45, color: '#FFC078' },
    { label: 'Analyze', value: 70, color: '#7C3AED' },
    { label: 'Sense', value: 55, color: '#38BDF8' },
  ];
  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      {bars.map((b) => (
        <View key={b.label} style={a.barRow}>
          <Text style={a.barLabel}>{b.label}</Text>
          <View style={a.barTrack}>
            <View
              style={[a.barFill, { width: `${b.value}%`, backgroundColor: b.color }]}
            />
          </View>
          <Text style={a.barScore}>{b.value}</Text>
        </View>
      ))}
    </View>
  );
}

const a = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F0EBF8' },
  headerGradient: {
    backgroundColor: '#7C3AED',
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '300' },
  childName: { fontSize: 28, color: '#FFF', fontWeight: '700', marginTop: 4 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: 18, color: '#FFF', fontWeight: '700' },
  content: { paddingHorizontal: 20, marginTop: -16 },
  weatherCard: { marginBottom: 16 },
  weatherGrad: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
  },
  weatherTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  weatherIcon: { fontSize: 48, fontWeight: '200', color: '#7C3AED' },
  weatherDeg: { fontSize: 20, fontWeight: '300', color: '#7C3AED', marginTop: 6 },
  weatherMeta: { marginLeft: 16, flex: 1, justifyContent: 'center' },
  weatherDesc: { fontSize: 16, fontWeight: '600', color: '#1E1E2E' },
  weatherSub: { fontSize: 12, color: '#6B6B80', marginTop: 2 },
  weatherMsg: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1E2E',
    marginBottom: 12,
    lineHeight: 22,
  },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  traitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  traitName: { fontSize: 14, fontWeight: '600', color: '#1E1E2E' },
  traitLink: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 48, fontSize: 11, color: '#6B6B80', fontWeight: '500' },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  barScore: {
    width: 28,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1E2E',
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1E2E',
    marginBottom: 14,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionCard: {
    width: (SCREEN_W - 52) / 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  actionEmoji: { fontSize: 32, marginBottom: 8 },
  actionLabel: { fontSize: 15, fontWeight: '700', color: '#1E1E2E' },
  actionSub: { fontSize: 12, color: '#6B6B80', marginTop: 2 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickItem: {
    width: (SCREEN_W - 60) / 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  quickEmoji: { fontSize: 24, marginBottom: 4 },
  quickLabel: { fontSize: 12, fontWeight: '500', color: '#1E1E2E' },
});

/* ────────────────────────────────────────────
   STYLE B: Minimal Clean + Cards
   ──────────────────────────────────────────── */

function StyleBMockup() {
  return (
    <View style={b.bg}>
      {/* Header */}
      <View style={b.header}>
        <View style={b.headerLeft}>
          <Text style={b.greeting}>Good morning</Text>
          <Text style={b.childName}>Seungha</Text>
        </View>
        <View style={b.avatarSmall}>
          <Text style={b.avatarInitial}>S</Text>
        </View>
      </View>

      {/* Weather Bar */}
      <View style={b.weatherBar}>
        <Text style={b.weatherTemp}>26°C</Text>
        <Text style={b.weatherDot}> / </Text>
        <Text style={b.weatherDesc}>Partly Cloudy</Text>
        <Text style={b.weatherDot}> / </Text>
        <Text style={b.weatherHumid}>62%</Text>
        <View style={{ flex: 1 }} />
        <Text style={b.weatherMsg}>Great day outside</Text>
      </View>

      {/* Trait Summary */}
      <View style={b.card}>
        <View style={b.cardHead}>
          <Text style={b.cardTitle}>Trait Profile</Text>
          <Text style={b.cardLink}>View details</Text>
        </View>
        <Text style={b.traitSub}>
          Seungha  |  Explorer  |  Elementary
        </Text>
        {renderBarsB()}
      </View>

      {/* Action Cards 2-col */}
      <Text style={b.sectionTitle}>Today's Picks</Text>
      <View style={b.gridTwo}>
        {[
          { emoji: '📖', label: 'Learning', sub: 'Creative writing' },
          { emoji: '🏫', label: 'Academy', sub: '2 nearby' },
          { emoji: '🥗', label: 'Nutrition', sub: 'Brain foods' },
          { emoji: '📦', label: 'Kits', sub: 'New arrivals' },
        ].map((c) => (
          <View key={c.label} style={b.gridCard}>
            <View style={b.gridCardTop}>
              <Text style={b.gridEmoji}>{c.emoji}</Text>
              <Text style={b.gridLabel}>{c.label}</Text>
            </View>
            <Text style={b.gridSub}>{c.sub}</Text>
          </View>
        ))}
      </View>

      {/* Quick Actions 2-col */}
      <Text style={b.sectionTitle}>Quick Actions</Text>
      <View style={b.gridTwo}>
        {[
          { emoji: '📊', label: 'Report' },
          { emoji: '💕', label: 'Sibling Match' },
          { emoji: '📸', label: 'Album' },
          { emoji: '⏱️', label: 'Quality Time' },
          { emoji: '👫', label: 'Trait Mates' },
          { emoji: '📔', label: 'Diary' },
        ].map((q) => (
          <View key={q.label} style={b.quickCard}>
            <Text style={b.quickEmoji}>{q.emoji}</Text>
            <Text style={b.quickLabel}>{q.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function renderBarsB() {
  const bars = [
    { label: 'Explore', value: 85, color: '#2563EB' },
    { label: 'Active', value: 60, color: '#2563EB' },
    { label: 'Stable', value: 45, color: '#2563EB' },
    { label: 'Analyze', value: 70, color: '#2563EB' },
    { label: 'Sense', value: 55, color: '#2563EB' },
  ];
  return (
    <View style={{ gap: 10, marginTop: 14 }}>
      {bars.map((br) => (
        <View key={br.label} style={b.barRow}>
          <Text style={b.barLabel}>{br.label}</Text>
          <View style={b.barTrack}>
            <View
              style={[
                b.barFill,
                { width: `${br.value}%`, backgroundColor: br.color },
              ]}
            />
          </View>
          <Text style={b.barScore}>{br.value}</Text>
        </View>
      ))}
    </View>
  );
}

const b = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F5F5F5', paddingHorizontal: 20, paddingTop: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {},
  greeting: { fontSize: 13, color: '#999', fontWeight: '400', letterSpacing: 0.5 },
  childName: { fontSize: 24, color: '#111', fontWeight: '600', marginTop: 2 },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 16, color: '#FFF', fontWeight: '600' },
  weatherBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  weatherTemp: { fontSize: 15, fontWeight: '600', color: '#111' },
  weatherDot: { fontSize: 13, color: '#CCC' },
  weatherDesc: { fontSize: 13, color: '#666' },
  weatherHumid: { fontSize: 13, color: '#666' },
  weatherMsg: { fontSize: 12, color: '#2563EB', fontWeight: '500' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  cardLink: { fontSize: 12, color: '#2563EB', fontWeight: '500' },
  traitSub: { fontSize: 12, color: '#888', marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 48, fontSize: 12, color: '#999', fontWeight: '500' },
  barTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: 2 },
  barScore: {
    width: 28,
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  gridCard: {
    width: (SCREEN_W - 50) / 2,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  gridCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gridEmoji: { fontSize: 22 },
  gridLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
  gridSub: { fontSize: 12, color: '#888', marginTop: 6 },
  quickCard: {
    width: (SCREEN_W - 50) / 2,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickEmoji: { fontSize: 20 },
  quickLabel: { fontSize: 13, fontWeight: '500', color: '#111' },
});

/* ────────────────────────────────────────────
   STYLE C: Warm Organic + Illustrations
   ──────────────────────────────────────────── */

function StyleCMockup() {
  return (
    <View style={c.bg}>
      {/* Header */}
      <View style={c.header}>
        <View>
          <Text style={c.greeting}>Good morning</Text>
          <Text style={c.childName}>Seungha</Text>
        </View>
        <View style={c.avatar}>
          <Text style={c.avatarEmoji}>SH</Text>
        </View>
      </View>

      {/* Weather Card */}
      <View style={c.weatherCard}>
        <View style={c.weatherRow}>
          <Text style={c.weatherBigEmoji}>🌤️</Text>
          <View style={c.weatherInfo}>
            <Text style={c.weatherTemp}>26°C</Text>
            <Text style={c.weatherDesc}>Partly cloudy, feels 28°C</Text>
          </View>
        </View>
        <Text style={c.weatherMsg}>Perfect weather for outdoor play!</Text>
        <View style={c.tagRow}>
          {['🌿 Nature Walk', '💧 Water Play', '🎨 Crafts'].map((t) => (
            <View key={t} style={c.tag}>
              <Text style={c.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Trait Summary */}
      <View style={c.traitCard}>
        <View style={c.traitHeader}>
          <Text style={c.traitIcon}>🌱</Text>
          <Text style={c.traitTitle}>Trait Profile</Text>
          <View style={{ flex: 1 }} />
          <Text style={c.traitLink}>Details</Text>
        </View>
        <Text style={c.traitSub}>
          Seungha  |  Explorer  |  Elementary
        </Text>
        {renderBarsC()}
      </View>

      {/* Action Cards */}
      <Text style={c.sectionTitle}>Today's Picks</Text>
      <View style={c.cardGrid}>
        {[
          { icon: '📖', label: 'Learning', sub: 'Creative writing', bg: '#FFEEEE' },
          { icon: '🏫', label: 'Academy', sub: '2 nearby', bg: '#E8F5E8' },
          { icon: '🥗', label: 'Nutrition', sub: 'Brain foods', bg: '#FFF5E0' },
          { icon: '📦', label: 'Kits', sub: 'New arrivals', bg: '#F0E8FF' },
        ].map((c2) => (
          <View key={c2.label} style={[c.actionCard, { backgroundColor: c2.bg }]}>
            <Text style={c.actionIcon}>{c2.icon}</Text>
            <Text style={c.actionLabel}>{c2.label}</Text>
            <Text style={c.actionSub}>{c2.sub}</Text>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <Text style={c.sectionTitle}>Quick Actions</Text>
      <View style={c.quickGrid}>
        {[
          { emoji: '📊', label: 'Report', bg: '#FFEEEE' },
          { emoji: '💕', label: 'Sibling', bg: '#FFE8F0' },
          { emoji: '📸', label: 'Album', bg: '#E8F5E8' },
          { emoji: '⏱️', label: 'Timer', bg: '#FFF5E0' },
          { emoji: '👫', label: 'Mates', bg: '#E8EEFF' },
          { emoji: '📔', label: 'Diary', bg: '#F0E8FF' },
        ].map((q) => (
          <View key={q.label} style={[c.quickItem, { backgroundColor: q.bg }]}>
            <Text style={c.quickEmoji}>{q.emoji}</Text>
            <Text style={c.quickLabel}>{q.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function renderBarsC() {
  const bars = [
    { label: 'Explore', value: 85, color: '#A7C4A0' },
    { label: 'Active', value: 60, color: '#FF6B6B' },
    { label: 'Stable', value: 45, color: '#FFD93D' },
    { label: 'Analyze', value: 70, color: '#A7C4A0' },
    { label: 'Sense', value: 55, color: '#FF6B6B' },
  ];
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      {bars.map((br) => (
        <View key={br.label} style={c.barRow}>
          <Text style={c.barLabel}>{br.label}</Text>
          <View style={c.barTrack}>
            <View
              style={[
                c.barFill,
                { width: `${br.value}%`, backgroundColor: br.color },
              ]}
            />
          </View>
          <Text style={c.barScore}>{br.value}</Text>
        </View>
      ))}
    </View>
  );
}

const c = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#FFF9F0', paddingHorizontal: 20, paddingTop: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { fontSize: 14, color: '#B08968', fontWeight: '500' },
  childName: { fontSize: 26, color: '#3D2C1E', fontWeight: '700', marginTop: 2 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFD93D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFE88A',
  },
  avatarEmoji: { fontSize: 18, color: '#3D2C1E', fontWeight: '700' },
  weatherCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FFE0B2',
  },
  weatherRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  weatherBigEmoji: { fontSize: 44, marginRight: 14 },
  weatherInfo: { flex: 1 },
  weatherTemp: { fontSize: 28, fontWeight: '700', color: '#3D2C1E' },
  weatherDesc: { fontSize: 13, color: '#8B6F47', marginTop: 2 },
  weatherMsg: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3D2C1E',
    marginBottom: 12,
    lineHeight: 22,
  },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.2)',
  },
  tagText: { fontSize: 12, color: '#3D2C1E', fontWeight: '500' },
  traitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#F0EAD6',
    shadowColor: '#B08968',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  traitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  traitIcon: { fontSize: 20 },
  traitTitle: { fontSize: 15, fontWeight: '700', color: '#3D2C1E' },
  traitLink: { fontSize: 12, fontWeight: '600', color: '#FF6B6B' },
  traitSub: { fontSize: 12, color: '#8B6F47', marginTop: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 48, fontSize: 11, color: '#8B6F47', fontWeight: '500' },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F5EFE0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  barScore: {
    width: 28,
    fontSize: 13,
    fontWeight: '700',
    color: '#3D2C1E',
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3D2C1E',
    marginBottom: 14,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionCard: {
    width: (SCREEN_W - 52) / 2,
    borderRadius: 28,
    padding: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  actionIcon: { fontSize: 30, marginBottom: 8 },
  actionLabel: { fontSize: 15, fontWeight: '700', color: '#3D2C1E' },
  actionSub: { fontSize: 12, color: '#8B6F47', marginTop: 4 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickItem: {
    width: (SCREEN_W - 60) / 3,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  quickEmoji: { fontSize: 24, marginBottom: 4 },
  quickLabel: { fontSize: 12, fontWeight: '600', color: '#3D2C1E' },
});
