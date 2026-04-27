import { Modal, View, Image, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { FONT_SIZE, SPACING } from '../../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface PhotoViewerProps {
  visible: boolean;
  uri: string;
  date: string;
  onClose: () => void;
}

export function PhotoViewer({ visible, uri, date, onClose }: PhotoViewerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>X</Text>
        </TouchableOpacity>
        <Image source={{ uri }} style={styles.fullImage} resizeMode="contain" />
        <Text style={styles.dateText}>{date}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: SPACING.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#FFF',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.65,
  },
  dateText: {
    color: '#FFF',
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.md,
    opacity: 0.8,
  },
});
