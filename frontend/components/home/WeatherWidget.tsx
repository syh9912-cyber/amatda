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

  const bgColor = (data.color || COLORS.primary) + '12';

  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      <Text style={styles.emoji}>{data.emoji}</Text>
      <Text style={styles.message}>{data.message}</Text>
      <Text style={styles.tip}>{data.tip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  emoji: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    lineHeight: 26,
  },
  tip: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
