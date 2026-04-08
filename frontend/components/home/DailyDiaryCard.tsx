import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  diary: string;
}

export function DailyDiaryCard({ diary }: Props) {
  return (
    <LinearGradient
      colors={['#FFF8E1', '#FFF0CC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.title}>오늘의 육아일기</Text>
      <Text style={styles.diaryText}>{diary}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C77C00',
    marginBottom: 10,
  },
  diaryText: {
    fontSize: 14,
    color: '#2D2016',
    lineHeight: 22,
  },
});
