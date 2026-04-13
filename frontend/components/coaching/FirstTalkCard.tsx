import { useState, useEffect } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COACHING_COLORS } from './types';
import { coachingApi } from '../../services/api';

/* eslint-disable @typescript-eslint/no-require-imports */
const IC_COACH = require('../../assets/coach-avatar.png') as number;
const IC_SEND = require('../../assets/icon-send.png') as number;
/* eslint-enable @typescript-eslint/no-require-imports */

interface FirstTalkData {
  intro: string;
  traitSummary: string;
  suggestedQuestion: string;
  quickOptions: string[];
}

interface Props {
  childId: string;
  onSelect: (message: string) => void;
}

export function FirstTalkCard({ childId, onSelect }: Props) {
  const [data, setData] = useState<FirstTalkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    coachingApi
      .firstTalk(childId)
      .then((res) => {
        if (cancelled) return;
        const raw = res.data?.data;
        if (raw && typeof raw === 'object') {
          const rawObj = raw as Record<string, unknown>;
          setData({
            intro: typeof rawObj.intro === 'string' ? rawObj.intro : '',
            traitSummary: typeof rawObj.traitSummary === 'string' ? rawObj.traitSummary : '',
            suggestedQuestion: typeof rawObj.suggestedQuestion === 'string' ? rawObj.suggestedQuestion : '',
            quickOptions: Array.isArray(rawObj.quickOptions)
              ? (rawObj.quickOptions as string[])
              : [],
          });
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [childId]);

  const handleSubmit = () => {
    const trimmed = answer.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    // 원래 질문 컨텍스트를 포함하여 AI가 맥락을 이해하도록
    const contextMsg = data?.suggestedQuestion
      ? `[코치 질문: ${data.suggestedQuestion}] ${trimmed}`
      : trimmed;
    onSelect(contextMsg);
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#FFB088', '#FF8C5A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>상담이모가 준비 중이에요...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (error || !data) {
    return (
      <LinearGradient
        colors={['#FFB088', '#FF8C5A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.avatarRow}>
          <Image source={IC_COACH} style={styles.avatarImg} resizeMode="cover" />
          <Text style={styles.coachLabel}>상담이모</Text>
        </View>
        <Text style={styles.intro}>
          안녕하세요! 아이에 대해 가장 궁금한 점을 알려주세요.
        </Text>
        {/* Input even on error fallback */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="고민이나 궁금한 점을 적어주세요..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={answer}
            onChangeText={setAnswer}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !answer.trim() && styles.sendBtnDisabled]}
            onPress={handleSubmit}
            disabled={!answer.trim() || submitting}
            activeOpacity={0.7}
          >
            <Image source={IC_SEND} style={styles.sendIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#FFB088', '#FF8C5A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Coach avatar */}
      <View style={styles.avatarRow}>
        <Image source={IC_COACH} style={styles.avatarImg} resizeMode="cover" />
        <Text style={styles.coachLabel}>상담이모</Text>
      </View>

      {/* Intro greeting */}
      {data.intro ? (
        <Text style={styles.intro}>{data.intro}</Text>
      ) : null}

      {/* Trait summary */}
      {data.traitSummary ? (
        <View style={styles.traitBox}>
          <Text style={styles.traitText}>{data.traitSummary}</Text>
        </View>
      ) : null}

      {/* Suggested question */}
      {data.suggestedQuestion ? (
        <Text style={styles.question}>{data.suggestedQuestion}</Text>
      ) : null}

      {/* Quick option buttons */}
      {data.quickOptions.length > 0 && (
        <View style={styles.optionsWrap}>
          {data.quickOptions.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={styles.optionBtn}
              onPress={() => {
                setSubmitting(true);
                // 원래 질문 컨텍스트를 포함하여 AI가 맥락을 이해하도록
                onSelect(`[코치 질문: ${data.suggestedQuestion}] ${opt}`);
              }}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Or type freely */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder="직접 입력해도 돼요..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={answer}
          onChangeText={setAnswer}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !answer.trim() && styles.sendBtnDisabled]}
          onPress={handleSubmit}
          disabled={!answer.trim() || submitting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FF8C5A" />
          ) : (
            <Image source={IC_SEND} style={styles.sendIcon} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  coachLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  intro: {
    fontSize: 15,
    fontWeight: '600',
    color: COACHING_COLORS.white,
    lineHeight: 24,
    marginBottom: 10,
  },
  traitBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  traitText: {
    fontSize: 13,
    color: COACHING_COLORS.white,
    lineHeight: 20,
  },
  question: {
    fontSize: 17,
    fontWeight: '700',
    color: COACHING_COLORS.white,
    lineHeight: 26,
    marginBottom: 16,
  },
  /* Quick option buttons */
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  optionBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8C5A',
  },
  /* Text input area */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    minHeight: 40,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    width: 18,
    height: 18,
    tintColor: '#FF8C5A',
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
});
