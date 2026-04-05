import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { foodApi } from '../../services/api';
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  ageMonths: number;
}

interface FoodItem {
  id: string;
  name: string;
  category: string;
  benefit: string;
  emoji?: string;
}

export function NutritionContent({ ageMonths }: Props) {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFoods();
  }, [ageMonths]);

  const loadFoods = async () => {
    setLoading(true);
    try {
      const res = await foodApi.list(ageMonths);
      const all: FoodItem[] = res.data.data ?? [];
      setFoods(all.slice(0, 3));
    } catch {
      setFoods([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color="#6366F1" />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>
          {'\uD83E\uDD57'} \uC624\uB298\uC758 \uCD94\uCC9C \uC601\uC591
        </Text>
        {foods.length > 0 ? (
          foods.map((food, i) => (
            <View key={food.id ?? i} style={styles.foodRow}>
              <Text style={styles.foodEmoji}>
                {food.emoji || '\uD83C\uDF4E'}
              </Text>
              <View style={styles.foodInfo}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodBenefit} numberOfLines={1}>
                  {food.benefit || food.category}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>
            \uCD94\uCC9C \uC601\uC591 \uC815\uBCF4\uAC00 \uC5C6\uC5B4\uC694
          </Text>
        )}
        <TouchableOpacity
          style={styles.recipeBtn}
          onPress={() => router.push('/(main)/nutrition')}
        >
          <Text style={styles.recipeBtnText}>
            \uB808\uC2DC\uD53C \uBCF4\uAE30
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#1E1E2E',
    marginBottom: SPACING.md,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: SPACING.sm,
  },
  foodEmoji: {
    fontSize: 28,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: '#1E1E2E',
  },
  foodBenefit: {
    fontSize: FONT_SIZE.xs,
    color: '#6B6B80',
    marginTop: 2,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: '#A0A0B0',
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  recipeBtn: {
    marginTop: SPACING.md,
    backgroundColor: '#4338CA',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  recipeBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
