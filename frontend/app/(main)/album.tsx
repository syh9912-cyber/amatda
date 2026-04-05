import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { PhotoGrid, AlbumPhoto } from '../../components/album/PhotoGrid';
import { PhotoViewer } from '../../components/album/PhotoViewer';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export default function AlbumScreen() {
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const selectedChild = useChildStore((s) => s.selectedChild);

  const pickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newPhoto: AlbumPhoto = {
        uri: result.assets[0].uri,
        date: formatDate(new Date()),
      };
      setPhotos((prev) => [newPhoto, ...prev]);
    }
  }, []);

  const viewerPhoto = viewerIndex !== null ? photos[viewerIndex] : null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '성장앨범', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        {selectedChild && (
          <Text style={styles.childLabel}>
            {selectedChild.name}의 성장앨범
          </Text>
        )}
        {photos.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Image
              source={require('../../assets/empty-album.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>아직 사진이 없습니다</Text>
            <Text style={styles.emptyHint}>+ 버튼을 눌러 사진을 추가해보세요</Text>
          </View>
        ) : (
          <>
            <Text style={styles.countText}>{photos.length}장의 사진</Text>
            <PhotoGrid photos={photos} onPhotoPress={setViewerIndex} />
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={pickImage} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Full-screen viewer */}
      {viewerPhoto && (
        <PhotoViewer
          visible={viewerIndex !== null}
          uri={viewerPhoto.uri}
          date={viewerPhoto.date}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 120 },
  childLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  countText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.elevated,
  },
  fabText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 30,
  },
  emptyWrap: {
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyImage: {
    width: 160,
    height: 160,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  emptyHint: {
    color: COLORS.textLight,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
});
