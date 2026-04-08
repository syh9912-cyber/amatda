import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CHECKIN_OPTIONS, COACHING_COLORS } from './types';

interface Props {
  onSelect: (mood: string) => void;
}

export function CheckinCard({ onSelect }: Props) {
  return (
    <LinearGradient
      colors={['#FFB088', '#FF8C5A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{'🤖'}</Text>
        </View>
        <Text style={styles.coachLabel}>AI {'코치'}</Text>
      </View>
      <Text style={styles.question}>
        {'오늘 아이의 컨디션은 어떤가요?'}
      </Text>
      <View style={styles.btnRow}>
        {CHECKIN_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.mood}
            style={styles.moodBtn}
            onPress={() => onSelect(opt.mood)}
            activeOpacity={0.7}
          >
            <Text style={styles.moodEmoji}>{opt.emoji}</Text>
            <Text style={styles.moodLabel}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16 },
  coachLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  question: {
    fontSize: 17,
    fontWeight: '700',
    color: COACHING_COLORS.white,
    lineHeight: 26,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  moodBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  moodEmoji: { fontSize: 24, marginBottom: 4 },
  moodLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COACHING_COLORS.white,
  },
});
