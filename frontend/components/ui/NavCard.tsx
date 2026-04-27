import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageSourcePropType,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

/**
 * NavCard
 *
 * 홈/더보기/추천 화면에서 반복되는 패턴:
 *   [아이콘] [제목 + 부제] [화살표]
 *
 * 시각적으로는 두 가지 변형을 지원한다.
 *  - variant="card": 독립된 카드 (홈 추천 리스트 같은 케이스)
 *  - variant="row":  하나의 카드 내부 row (ProfileMenuList 같은 케이스)
 *
 * 비즈니스 로직(라우팅)은 onPress 콜백으로 호출자가 담당.
 */
export interface NavCardProps {
  icon: ImageSourcePropType;
  title: string;
  description?: string;
  onPress: () => void;
  variant?: 'card' | 'row';
  iconBgColor?: string;
  chevronColor?: string;
  showBottomBorder?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function NavCard({
  icon,
  title,
  description,
  onPress,
  variant = 'card',
  iconBgColor,
  chevronColor,
  showBottomBorder = false,
  style,
  testID,
}: NavCardProps) {
  const isRow = variant === 'row';
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        isRow ? styles.row : styles.card,
        showBottomBorder && styles.rowBorder,
        style,
      ]}
    >
      <View
        style={[
          isRow ? styles.iconWrapRow : styles.iconWrapCard,
          iconBgColor ? { backgroundColor: iconBgColor } : null,
        ]}
      >
        <Image source={icon} style={isRow ? styles.iconRow : styles.iconCard} resizeMode="contain" />
      </View>
      <View style={styles.textCol}>
        <Text style={isRow ? styles.titleRow : styles.titleCard}>{title}</Text>
        {description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.chevron, chevronColor ? { color: chevronColor } : null]}>{'>'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  /* variant: card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  iconWrapCard: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconCard: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  titleCard: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* variant: row (inside a shared card) */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5EDE4',
  },
  iconWrapRow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRow: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  titleRow: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },

  /* shared */
  textCol: {
    flex: 1,
    gap: 2,
    marginLeft: SPACING.sm,
  },
  desc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.textLight,
    marginLeft: 8,
    fontWeight: '300',
  },
});
