import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { weatherApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  childId: string;
}

interface WeatherData {
  weather: string;
  emoji: string;
  message: string;
  tip: string;
  color: string;
}

export function WeatherWidget({ childId }: Props) {
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    loadWeather();
  }, [childId]);

  const loadWeather = async () => {
    try {
      const res = await weatherApi.get(childId);
      setData(res.data.data);
    } catch {
      // ignore
    }
  };

  if (!data) return null;

  return (
    <View style={[styles.card, { backgroundColor: data.color + '30' }]}>
      <Text style={styles.emoji}>{data.emoji}</Text>
      <View style={styles.textCol}>
        <Text style={styles.message}>{data.message}</Text>
        <Text style={styles.tip}>{data.tip}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  emoji: { fontSize: 36 },
  textCol: { flex: 1 },
  message: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  tip: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
