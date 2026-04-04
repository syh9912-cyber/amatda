import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const WEATHER_LABEL: Record<string, string> = {
  sunny: '맑음',
  cloudy: '흐림',
  rainy: '비',
  stormy: '폭풍',
  windy: '바람',
  snowy: '눈',
  foggy: '안개',
};

function getGradientColors(color: string): [string, string] {
  const base = color || COLORS.primary;
  return [`${base}25`, `${base}08`];
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

  const weatherLabel =
    WEATHER_LABEL[data.weather] ?? data.weather;
  const gradientColors = getGradientColors(data.color);

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <Text style={styles.emoji}>{data.emoji}</Text>
        <View style={styles.weatherBadge}>
          <Text style={styles.weatherBadgeText}>
            {weatherLabel}
          </Text>
        </View>
      </View>
      <Text style={styles.message}>{data.message}</Text>
      <Text style={styles.tip}>{data.tip}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  emoji: {
    fontSize: 48,
  },
  weatherBadge: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.xl,
  },
  weatherBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    lineHeight: 26,
  },
  tip: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
