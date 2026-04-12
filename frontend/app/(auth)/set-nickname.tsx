import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import apiInstance from '../../services/api';

export default function SetNicknameScreen() {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const setUser = useAuthStore((s) => s.setUser);

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      Alert.alert('알림', '별명을 입력해주세요');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 10) {
      Alert.alert('알림', '별명은 2~10자로 입력해주세요');
      return;
    }

    setLoading(true);
    try {
      await apiInstance.put('/auth/nickname', { nickname: trimmed });
      setUser(userId ?? '', trimmed);
      router.replace('/onboarding/child-info');
    } catch {
      Alert.alert('오류', '별명 설정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.emoji}>{'👋'}</Text>
        <Text style={styles.title}>환영합니다!</Text>
        <Text style={styles.subtitle}>앱에서 사용할 별명을 정해주세요</Text>

        <TextInput
          style={styles.input}
          placeholder="별명 (2~10자)"
          placeholderTextColor="#B0A090"
          value={nickname}
          onChangeText={setNickname}
          maxLength={10}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, (!nickname.trim() || loading) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!nickname.trim() || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? '설정 중...' : '시작하기'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5EC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D2016',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#8B7B6B',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: '#2D2016',
    borderWidth: 1,
    borderColor: '#E8D8C8',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#FF8C5A',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
