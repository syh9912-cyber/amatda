import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - SPACING.lg * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export interface AlbumPhoto {
  uri: string;
  date: string;
}

interface PhotoGridProps {
  photos: AlbumPhoto[];
  onPhotoPress: (index: number) => void;
}

export function PhotoGrid({ photos, onPhotoPress }: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}>{'📷'}</Text>
        <Text style={styles.emptyText}>아직 사진이 없습니다</Text>
        <Text style={styles.emptyHint}>
          아래 버튼을 눌러 아이의 성장 사진을 추가해보세요
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {photos.map((photo, index) => (
        <TouchableOpacity
          key={`${photo.uri}-${index}`}
          style={styles.item}
          onPress={() => onPhotoPress(index)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: photo.uri }} style={styles.image} />
          <Text style={styles.dateLabel} numberOfLines={1}>
            {photo.date}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  item: {
    width: ITEM_SIZE,
    marginBottom: SPACING.xs,
  },
  image: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.border,
  },
  dateLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  emptyWrap: {
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  emptyHint: {
    color: COLORS.textLight,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});
