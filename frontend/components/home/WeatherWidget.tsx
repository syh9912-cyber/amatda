import { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { weatherApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  childId: string;
  lat?: number;
  lng?: number;
}

interface RealWeatherData {
  temperature: number;
  description: string;
  humidity: number;
  feelsLike: number;
  icon: string;
}

interface TraitWeatherData {
  weather: string;
  emoji: string;
  message: string;
  tip: string;
  color: string;
}

interface WeatherResponse {
  childName: string;
  dominantType: string;
  realWeather: RealWeatherData | null;
  traitWeather: TraitWeatherData;
  recommendedActivities: string[];
}

export function WeatherWidget({ childId, lat, lng }: Props) {
  const [data, setData] = useState<WeatherResponse | null>(null);

  useEffect(() => {
    loadWeather();
  }, [childId, lat, lng]);

  const loadWeather = async () => {
    try {
      const res = await weatherApi.get(childId, lat, lng);
      setData(res.data.data);
    } catch {
      // ignore
    }
  };

  if (!data) return null;

  const bgColor = (data.traitWeather.color || COLORS.primary) + '12';
  const hasReal = data.realWeather !== null;

  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      {hasReal && data.realWeather ? (
        <RealWeatherSection real={data.realWeather} />
      ) : (
        <Text style={styles.emoji}>{data.traitWeather.emoji}</Text>
      )}
      <Text style={styles.message}>{data.traitWeather.message}</Text>
      <Text style={styles.tip}>{data.traitWeather.tip}</Text>
      {data.recommendedActivities.length > 0 && (
        <ActivityPills activities={data.recommendedActivities} />
      )}
    </View>
  );
}

function getWeatherImage(description: string) {
  if (description.includes('맑') || description.includes('sunny') || description.includes('clear')) {
    return require('../../assets/weather-sunny.png');
  }
  if (description.includes('비') || description.includes('rain') || description.includes('shower')) {
    return require('../../assets/weather-rainy.png');
  }
  return require('../../assets/weather-cloudy.png');
}

function RealWeatherSection({ real }: { real: RealWeatherData }) {
  const weatherImage = getWeatherImage(real.description);
  return (
    <View style={styles.realRow}>
      <Image source={weatherImage} style={styles.weatherImage} />
      <View style={styles.tempBlock}>
        <Text style={styles.tempText}>{real.temperature}°C</Text>
        <Text style={styles.descText}>{real.description}</Text>
      </View>
      <View style={styles.metaBlock}>
        <Text style={styles.metaText}>
          체감 {real.feelsLike}°C
        </Text>
        <Text style={styles.metaText}>
          습도 {real.humidity}%
        </Text>
      </View>
    </View>
  );
}

function ActivityPills({ activities }: { activities: string[] }) {
  const shown = activities.slice(0, 3);
  return (
    <View style={styles.pillRow}>
      {shown.map((act) => (
        <View key={act} style={styles.pill}>
          <Text style={styles.pillText}>{act}</Text>
        </View>
      ))}
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
  realRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  weatherImage: {
    width: 48,
    height: 48,
    marginRight: SPACING.sm,
  },
  tempBlock: {
    flex: 1,
  },
  tempText: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  descText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  metaBlock: {
    alignItems: 'flex-end',
  },
  metaText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  pill: {
    backgroundColor: COLORS.primary + '18',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  pillText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
