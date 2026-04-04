import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { foodApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface FoodItem {
  name: string;
  benefit: string;
  caution?: string;
}

interface FoodGuide {
  id: string;
  suitableType: string;
  foods: FoodItem[];
}

export default function NutritionScreen() {
  const [guides, setGuides] = useState<FoodGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedChild = useChildStore((s) => s.selectedChild);

  useEffect(() => {
    if (selectedChild) loadGuides();
  }, [selectedChild?.id]);

  const loadGuides = async () => {
    if (!selectedChild) return;
    try {
      const res = await foodApi.list(
        selectedChild.ageInfo.months,
        selectedChild.innateData.dominantType
      );
      setGuides(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '영양 가이드', headerShown: true }} />

      {selectedChild && (
        <Text style={styles.heading}>
          {selectedChild.name}의 {selectedChild.innateData.dominantType} 맞춤 영양
        </Text>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : guides.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            해당 연령/기질에 맞는 영양 가이드가 아직 준비 중입니다
          </Text>
        </View>
      ) : (
        guides.map((guide) =>
          guide.foods.map((food, idx) => (
            <View key={`${guide.id}-${idx}`} style={styles.foodCard}>
              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.foodBenefit}>{food.benefit}</Text>
              {food.caution && (
                <View style={styles.cautionRow}>
                  <Text style={styles.cautionLabel}>주의</Text>
                  <Text style={styles.cautionText}>{food.caution}</Text>
                </View>
              )}
            </View>
          ))
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },
  heading: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center' },
  foodCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  foodName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  foodBenefit: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  cautionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    backgroundColor: '#FFF3E0',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  cautionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.secondary,
    marginRight: SPACING.sm,
  },
  cautionText: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.text },
});
