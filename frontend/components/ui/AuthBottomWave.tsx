import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

export function AuthBottomWave() {
  return (
    <View style={styles.container}>
      <View style={styles.wave1} />
      <View style={styles.wave2} />
      <View style={styles.wave3} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    overflow: 'hidden',
    position: 'relative',
  },
  wave1: {
    position: 'absolute',
    bottom: -40,
    left: '-10%',
    width: '120%',
    height: 80,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    opacity: 0.25,
  },
  wave2: {
    position: 'absolute',
    bottom: -50,
    left: '5%',
    width: '100%',
    height: 80,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    opacity: 0.1,
  },
  wave3: {
    position: 'absolute',
    bottom: -55,
    right: '-5%',
    width: '70%',
    height: 70,
    borderRadius: 999,
    backgroundColor: COLORS.secondary,
    opacity: 0.08,
  },
});
