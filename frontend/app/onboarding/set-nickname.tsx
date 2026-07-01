import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import apiInstance from '../../services/api';

export default function OnboardingSetNicknameScreen() {
  const { t } = useTranslation();
  useEffect(() => {
    console.log('[OnboardingSetNickname] mounted');
    return () => console.log('[OnboardingSetNickname] unmounted');
  }, []);
  const [nickname, setNickname] = useState('');
  const [parentRole, setParentRole] = useState<string>('엄마');
  const [loading, setLoading] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const setUser = useAuthStore((s) => s.setUser);

  const parentRoles: { value: string; labelKey: string }[] = [
    { value: '엄마', labelKey: 'onboardingSetNickname.roleMom' },
    { value: '아빠', labelKey: 'onboardingSetNickname.roleDad' },
    { value: '할머니', labelKey: 'onboardingSetNickname.roleGrandma' },
    { value: '할아버지', labelKey: 'onboardingSetNickname.roleGrandpa' },
    { value: '고모/이모', labelKey: 'onboardingSetNickname.roleAunt' },
    { value: '삼촌', labelKey: 'onboardingSetNickname.roleUncle' },
    { value: '기타', labelKey: 'onboardingSetNickname.roleOther' },
  ];

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      Alert.alert(t('common.notice'), t('onboardingSetNickname.enterNickname'));
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 10) {
      Alert.alert(t('common.notice'), t('onboardingSetNickname.nicknameLength'));
      return;
    }

    setLoading(true);
    try {
      await apiInstance.put('/auth/nickname', { nickname: trimmed, parentRole });
      await setUser(userId ?? '', trimmed);
      // 자녀 등록은 선택사항 — 홈에서 둘러보다가 등록 유도. EmptyState 가 자녀 없음 케이스 처리.
      router.replace('/(main)/home');
    } catch {
      Alert.alert(t('common.error'), t('onboardingSetNickname.setNicknameFailed'));
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
        <Image source={require('../../assets/mascot-waving.png')} style={styles.emojiImg} resizeMode="contain" />
        <Text style={styles.title}>{t('onboardingSetNickname.welcome')}</Text>
        <Text style={styles.subtitle}>{t('onboardingSetNickname.subtitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('onboardingSetNickname.nicknamePlaceholder')}
          placeholderTextColor="#B0A090"
          value={nickname}
          onChangeText={setNickname}
          maxLength={10}
          autoFocus
        />

        <Text style={styles.roleLabel}>{t('onboardingSetNickname.roleQuestion')}</Text>
        <View style={styles.roleWrap}>
          {parentRoles.map(({ value, labelKey }) => (
            <TouchableOpacity
              key={value}
              style={[styles.roleBtn, parentRole === value && styles.roleBtnActive]}
              onPress={() => setParentRole(value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.roleBtnText, parentRole === value && styles.roleBtnTextActive]}>
                {t(labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, (!nickname.trim() || loading) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!nickname.trim() || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? t('onboardingSetNickname.settingUp') : t('onboardingSetNickname.startButton')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  emojiImg: { width: 56, height: 56, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8B7B6B', marginBottom: 32 },
  input: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, fontSize: 16,
    color: '#1C1C1E', borderWidth: 1, borderColor: '#E8D8C8', marginBottom: 24, textAlign: 'center',
  },
  button: { width: '100%', backgroundColor: '#FF8C5A', borderRadius: 14, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  roleLabel: { fontSize: 14, fontWeight: '600', color: '#8B7B6B', marginBottom: 10 },
  roleWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginBottom: 24, justifyContent: 'center',
  },
  roleBtn: {
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5,
    borderColor: '#E8D8C8', backgroundColor: '#FFFFFF', alignItems: 'center', minWidth: '28%',
  },
  roleBtnActive: { borderColor: '#FF8C5A', backgroundColor: '#FFF5F0' },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: '#B0A090' },
  roleBtnTextActive: { color: '#FF8C5A' },
});
