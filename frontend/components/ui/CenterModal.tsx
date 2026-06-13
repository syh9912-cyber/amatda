import { Modal, View, ScrollView, StyleSheet, ViewStyle, StyleProp, TouchableWithoutFeedback } from 'react-native';
import { ReactNode } from 'react';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

/**
 * CenterModal
 *
 * 중앙 정렬된 카드형 모달 래퍼.
 * - transparent + animationType="fade" 기본
 * - Android 뒤로가기 대응을 위해 onRequestClose 필수 (CLAUDE.md 규칙)
 * - backdrop 탭으로 닫을지 여부는 dismissOnBackdrop 으로 제어 (기본 false: 실수 방지)
 */
export interface CenterModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  animationType?: 'none' | 'fade' | 'slide';
  dismissOnBackdrop?: boolean;
  /** 카드에 추가로 덮어쓸 스타일 (너비, padding 조정용) */
  cardStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
}

export function CenterModal({
  visible,
  onRequestClose,
  children,
  animationType = 'fade',
  dismissOnBackdrop = false,
  cardStyle,
  overlayStyle,
}: CenterModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onRequestClose}
    >
      <TouchableWithoutFeedback
        onPress={dismissOnBackdrop ? onRequestClose : undefined}
      >
        <View style={[styles.overlay, overlayStyle]}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, cardStyle]}>
              {/* 내용이 카드 maxHeight(85%)를 넘으면 잘리는 대신 스크롤 (iPad 호환모드 등 세로 공간 부족 대비) */}
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {children}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxHeight: '85%',
  },
  scroll: {
    alignSelf: 'stretch',
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
});
