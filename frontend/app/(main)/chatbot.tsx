import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { coachingApi, memoriesApi, authApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { scheduleCoachingFollowup } from '../../services/pushNotifications';
import { CoachMessage } from '../../components/coaching/CoachMessage';
import { ParentMessage } from '../../components/coaching/ParentMessage';
import { FirstTalkCard } from '../../components/coaching/FirstTalkCard';
import { CategoryBar } from '../../components/coaching/CategoryBar';
import { FollowupCard } from '../../components/coaching/FollowupCard';
import { CoachingInput } from '../../components/coaching/CoachingInput';
import { YearAgoBanner } from '../../components/coaching/YearAgoBanner';
import {
  CoachingMessage,
  FollowupItem,
  COACHING_COLORS,
} from '../../components/coaching/types';
import { useChildPermissions } from '../../features/coparenting/permissions';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { getChatbotGuide } from '../../features/guide/chatbotGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';

// 의료/건강 정보 출처 (App Store Guideline 1.4.1) — 신뢰 가능한 공신력 있는 기관.
function getMedicalSources(t: TFunction): { label: string; url: string }[] {
  return [
    { label: t('chatbot.medicalSource.kdca'), url: 'https://health.kdca.go.kr' },
    { label: t('chatbot.medicalSource.pediatrics'), url: 'https://www.pediatrics.or.kr' },
  ];
}

/** 부모 역할별 호칭 접미사 (아이 이름 + 접미사). 아버지면 "아빠", 어머니면 "맘" 등 */
function parentGreetingSuffix(t: TFunction, role?: string): string {
  switch (role) {
    case '아빠': return t('chatbot.parentSuffix.dad');
    case '엄마': return t('chatbot.parentSuffix.mom');
    case '할머니': return t('chatbot.parentSuffix.grandma');
    case '할아버지': return t('chatbot.parentSuffix.grandpa');
    case '고모이모': return t('chatbot.parentSuffix.auntie');
    case '삼촌': return t('chatbot.parentSuffix.uncle');
    default: return t('chatbot.parentSuffix.mom');
  }
}

export default function CoachingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { firstMessage } = useLocalSearchParams<{ firstMessage?: string }>();
  const child = useChildStore((s) => s.selectedChild);
  // 공동육아: useCoaching 권한 없는 멤버는 AI 상담 사용 불가 (열람 전용)
  const { can } = useChildPermissions(child?.id);
  const canUseCoaching = can('useCoaching');
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [firstTalkDone, setFirstTalkDone] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => { shouldAutoShowGuide('chatbot').then((sh) => { if (sh) setGuideVisible(true); }); }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('chatbot'); };
  // 부모 역할(아빠/엄마/조부모…)로 첫 인사 호칭을 맞춤 — "OO맘/OO아빠"
  const [parentRole, setParentRole] = useState<string | undefined>(undefined);
  useEffect(() => {
    authApi.getProfile()
      .then((res) => {
        const role = (res.data?.data as { parentRole?: string } | undefined)?.parentRole;
        if (role) setParentRole(role);
      })
      .catch(() => {});
  }, []);
  const [yearAgoMemory, setYearAgoMemory] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const firstMessageHandled = useRef(false);

  useEffect(() => {
    // 아이 전환 시 기존 상태 초기화
    setMessages([]);
    setFollowups([]);
    setYearAgoMemory(null);
    setFirstTalkDone(false);
    firstMessageHandled.current = false;
    if (child) {
      loadHistory();
      loadFollowups();
      loadYearAgoMemory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.id]);

  const loadHistory = async () => {
    if (!child) return;
    try {
      const res = await coachingApi.history(child.id);
      const data = res.data?.data;
      if (Array.isArray(data) && data.length > 0) {
        // Backend returns sessions desc; reverse for chronological order
        const sessions = [...data].reverse();
        const mapped: CoachingMessage[] = [];
        for (const s of sessions) {
          const session = s as Record<string, unknown>;
          const ts = (session.createdAt as string) ?? new Date().toISOString();
          // Parent message
          const parentText = (session.message as string | undefined) ?? '';
          if (parentText) {
            mapped.push({
              id: `h-p-${session.id as string}`,
              isCoach: false,
              text: parentText,
              createdAt: ts,
            });
          }
          // Coach response
          const coachText =
            (session.answer as string | undefined) ??
            (session.text as string | undefined) ??
            (session.reply as string | undefined) ??
            '';
          if (coachText) {
            // followup from history can be { days, question } object or string
            const histFollowup = session.followup;
            let histFollowupText: string | undefined;
            if (typeof histFollowup === 'string') {
              histFollowupText = histFollowup;
            } else if (histFollowup && typeof histFollowup === 'object' && 'question' in (histFollowup as Record<string, unknown>)) {
              histFollowupText = String((histFollowup as { question: unknown }).question);
            } else if (typeof session.followupQuestion === 'string') {
              histFollowupText = session.followupQuestion;
            }

            mapped.push({
              id: `h-c-${session.id as string}`,
              isCoach: true,
              text: coachText,
              reason: (session.reason as string | undefined) ?? undefined,
              solutions: Array.isArray(session.solutions)
                ? (session.solutions as string[])
                : undefined,
              source: (session.source as CoachingMessage['source']) ?? 'ai',
              redFlag: (session.redFlag as string | undefined) ?? undefined,
              reasons: Array.isArray(session.reasons)
                ? (session.reasons as string[])
                : undefined,
              medical: (session.medical as string | undefined) ?? undefined,
              followup: histFollowupText,
              createdAt: ts,
            });
          }
        }
        if (mapped.length > 0) {
          setMessages(mapped);
          setFirstTalkDone(true);
        }
      }
    } catch {
      // offline or first visit
    }
  };

  const loadFollowups = async () => {
    if (!child) return;
    try {
      const res = await coachingApi.followups(child.id);
      const data = res.data?.data;
      if (Array.isArray(data)) {
        setFollowups(data);
      }
    } catch {
      // ignore
    }
  };

  const loadYearAgoMemory = async () => {
    if (!child) return;
    try {
      const res = await memoriesApi.yearAgo(child.id);
      const data = res.data?.data;
      if (data?.hasMemory && data?.memory) {
        setYearAgoMemory(data.memory as string);
      }
    } catch {
      // no memory or endpoint not available
    }
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      120
    );
  }, []);

  const sendMessage = useCallback(
    async (text: string, category?: string) => {
      if (!text.trim() || sending) return;
      if (!child) {
        const noChildMsg: CoachingMessage = {
          id: `e-${Date.now()}`,
          isCoach: true,
          text: t('chatbot.childInfoLoading'),
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, noChildMsg]);
        return;
      }
      // 공동육아 권한 게이팅: useCoaching 없는 멤버는 차단 (서버도 차단하지만 UX상 미리 안내)
      if (!canUseCoaching) {
        setMessages((prev) => [...prev, {
          id: `e-${Date.now()}`,
          isCoach: true,
          text: t('chatbot.noPermissionMessage'),
          createdAt: new Date().toISOString(),
        }]);
        return;
      }
      setInput('');
      setSending(true);

      const userMsg: CoachingMessage = {
        id: `u-${Date.now()}`,
        isCoach: false,
        text: text.trim(),
        imageUri: photoUri ?? undefined,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setPhotoUri(null);
      scrollToBottom();

      try {
        const res = await coachingApi.send(child.id, text.trim(), category, i18n.language);
        const reply = res.data?.data as Record<string, unknown> | undefined;
        // followup from API can be { days, question } object or string
        const rawFollowup = reply?.followup;
        let followupText: string | undefined;
        if (typeof rawFollowup === 'string') {
          followupText = rawFollowup;
        } else if (rawFollowup && typeof rawFollowup === 'object' && 'question' in rawFollowup) {
          followupText = String((rawFollowup as { question: unknown }).question);
        }

        const coachMsg: CoachingMessage = {
          id: `c-${Date.now()}`,
          isCoach: true,
          text: (reply?.answer as string | undefined) ?? (reply?.text as string | undefined) ?? (reply?.reply as string | undefined) ?? t('chatbot.answerPreparing'),
          reason: reply?.reason as string | undefined,
          solutions: Array.isArray(reply?.solutions) ? (reply.solutions as string[]) : undefined,
          source: (reply?.source as CoachingMessage['source']) ?? 'ai',
          redFlag: (reply?.redFlag as string | undefined) ?? undefined,
          reasons: Array.isArray(reply?.reasons) ? (reply.reasons as string[]) : undefined,
          medical: (reply?.medical as string | undefined) ?? undefined,
          followup: followupText,
          followups: Array.isArray(reply?.followups)
            ? (reply.followups as unknown[]).filter((q): q is string => typeof q === 'string')
            : undefined,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, coachMsg]);

        // Schedule coaching follow-up notification for next day
        scheduleCoachingFollowup(child.id, child.name).catch(() => { /* silent */ });
      } catch (err: unknown) {
        // axios 에러에서 서버 메시지 추출
        let errDetail = '';
        if (err && typeof err === 'object' && 'response' in err) {
          const axErr = err as { response?: { status?: number; data?: { error?: string } } };
          const status = axErr.response?.status;
          const serverMsg = axErr.response?.data?.error;
          errDetail = serverMsg ? ` (${serverMsg})` : status ? ` (HTTP ${status})` : '';
        } else if (err instanceof Error) {
          errDetail = ` (${err.message})`;
        }
        const errMsg: CoachingMessage = {
          id: `e-${Date.now()}`,
          isCoach: true,
          text: `${t('chatbot.responseFailed')}${errDetail}`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setSending(false);
        scrollToBottom();
      }
    },
    [sending, child, photoUri, scrollToBottom, canUseCoaching, t, i18n.language]
  );

  const handleFirstTalkSelect = useCallback(
    (option: string) => {
      setFirstTalkDone(true);
      sendMessage(option);
    },
    [sendMessage]
  );

  const [showCategories, setShowCategories] = useState(false);

  const isPregnant = child?.isPregnant === true;

  const handleCategorySelect = useCallback(
    (key: string, label: string) => {
      const text = isPregnant
        ? t('chatbot.categoryPromptPregnant', { label })
        : t('chatbot.categoryPromptChild', { label });
      setInput(text);
      setShowCategories(false);
    },
    [isPregnant, t]
  );

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handlePhoto = useCallback((uri: string) => {
    setPhotoUri(uri);
  }, []);

  const handleFollowupRespond = useCallback(
    async (id: string, response: string) => {
      try {
        await coachingApi.respondFollowup(id, response);
      } catch {
        // ignore
      }
      setFollowups((prev) => prev.filter((f) => f.id !== id));
      sendMessage(response);
    },
    [sendMessage]
  );

  const handleFollowupDismiss = useCallback(
    async (id: string) => {
      try {
        await coachingApi.dismissFollowup(id);
      } catch {
        // ignore
      }
      setFollowups((prev) => prev.filter((f) => f.id !== id));
    },
    []
  );

  // Auto-send firstMessage from analysis report navigation
  useEffect(() => {
    if (!firstMessage || firstMessageHandled.current) return;
    if (!child) return; // child 로드 대기
    firstMessageHandled.current = true;
    setFirstTalkDone(true);
    const messageToSend = firstMessage;
    const timer = setTimeout(async () => {
      try {
        await sendMessage(messageToSend);
      } catch (e) {
        // 자동 전송 실패 시 사용자에게 명확히 안내 + 재시도 옵션 제공
        // (CLAUDE.md: 에러를 조용히 삼키지 말 것)
        const reason = e instanceof Error ? e.message : t('chatbot.unknownError');
        Alert.alert(
          t('chatbot.autoSendFailTitle'),
          t('chatbot.autoSendFailDesc', { reason }),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => firstMessageHandled.current = false },
            {
              text: t('common.retry'),
              onPress: () => {
                sendMessage(messageToSend).catch(() => {
                  // 두 번째 실패는 입력창에 채워 사용자가 직접 보낼 수 있도록
                  setInput(messageToSend);
                });
              },
            },
          ],
        );
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [firstMessage, child?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const childName = child?.name ?? t('chatbot.defaultChildName');
  const isEmpty = messages.length === 0;
  const showFirstTalk = isEmpty && !firstTalkDone && !!child && !firstMessage;
  const medicalSources = getMedicalSources(t);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.headerTitle}>
            {t('tabs.coach')}
          </Text>
          <GuideButton onPress={() => setGuideVisible(true)} />
        </View>
        <View style={styles.headerChild}>
          {child?.photoUri ? (
            <Image
              source={{ uri: child.photoUri }}
              style={styles.headerPhoto}
            />
          ) : (
            <Image
              source={child?.gender === 'F' ? require('../../assets/avatar-girl.png') : require('../../assets/avatar-boy.png')}
              style={styles.headerPhotoPlaceholder}
              resizeMode="cover"
            />
          )}
          <Text style={styles.headerName}>{childName}</Text>
        </View>
      </View>

      {/* 의료 면책 고지 + 정보 출처 — Apple Guideline 1.4.1 (의료 정보 출처 표기) */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          {`⚠️ ${t('chatbot.disclaimer')}`}
        </Text>
        <View style={styles.citationRow}>
          <Text style={styles.citationLabel}>{t('chatbot.sourceLabel')}</Text>
          {medicalSources.map((src, i) => (
            <TouchableOpacity
              key={src.url}
              onPress={() => Linking.openURL(src.url).catch(() => {})}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel={t('chatbot.openSource', { label: src.label })}
            >
              <Text style={styles.citationLink}>
                {src.label}{i < medicalSources.length - 1 ? ' · ' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Category toggle (hidden during first talk) */}
      {!showFirstTalk && (
        <View>
          <TouchableOpacity
            style={styles.categoryToggle}
            onPress={() => setShowCategories((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: showCategories }}
            accessibilityLabel={showCategories ? t('chatbot.categoryClose') : t('chatbot.categorySelect')}
          >
            <Text style={styles.categoryToggleText}>
              {showCategories ? t('chatbot.categoryClose') : t('chatbot.categorySelect')}
            </Text>
          </TouchableOpacity>
          {showCategories && <CategoryBar onSelect={handleCategorySelect} ageGroup={child?.ageInfo?.group} />}
        </View>
      )}

      {/* Chat Area */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={scrollToBottom}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* 상담이모 첫 인사 — 대화 시작 시 항상 노출 */}
        {child ? (
          <CoachMessage
            message={{
              id: 'greeting',
              isCoach: true,
              text: t('chatbot.greeting', { name: `${childName}${parentGreetingSuffix(t, parentRole)}` }),
              createdAt: new Date().toISOString(),
              source: 'ai',
            }}
          />
        ) : null}

        {/* Year Ago Memory Banner */}
        {yearAgoMemory ? (
          <YearAgoBanner memory={yearAgoMemory} />
        ) : null}

        {/* Follow-up Cards */}
        {followups.map((fu) => (
          <FollowupCard
            key={fu.id}
            followup={fu}
            onRespond={handleFollowupRespond}
            onDismiss={handleFollowupDismiss}
          />
        ))}

        {/* First Talk Card */}
        {showFirstTalk ? (
          <FirstTalkCard childId={child.id} onSelect={handleFirstTalkSelect} />
        ) : null}

        {/* Messages */}
        {messages.map((msg, idx) =>
          msg.isCoach ? (
            <CoachMessage
              key={msg.id}
              message={msg}
              onPickFollowup={sendMessage}
              isLatest={idx === messages.length - 1 && !sending}
            />
          ) : (
            <ParentMessage key={msg.id} message={msg} />
          )
        )}

        {/* Sending indicator */}
        {sending ? (
          <View style={styles.typingRow}>
            <Image source={require('../../assets/coach-avatar.png')} style={styles.typingAvatarImg} resizeMode="cover" />
            <View style={styles.typingBubble}>
              <ActivityIndicator
                size="small"
                color={COACHING_COLORS.accent}
              />
              <Text style={styles.typingText}>
                {t('chatbot.answerPreparingLoading')}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Photo preview */}
      {photoUri ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photoUri }} style={styles.photoThumb} />
          <Text style={styles.photoLabel}>
            {t('chatbot.photoAttached')}
          </Text>
        </View>
      ) : null}

      {/* Analyzer shortcuts (hidden during first talk and for pregnant users) */}
      {!showFirstTalk && !isPregnant && (
        <View style={styles.analyzerRow}>
          <TouchableOpacity
            style={styles.analyzerPill}
            onPress={() => router.push('/(main)/poop-analyzer')}
            accessibilityRole="button"
            accessibilityLabel={t('chatbot.poopAnalysis')}
            activeOpacity={0.7}
          >
            <Image source={require('../../assets/trait-analyst-small.png')} style={styles.analyzerPillIcon} resizeMode="contain" />
            <Text style={styles.analyzerPillText}>{t('chatbot.poopAnalysis')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.analyzerPill}
            onPress={() => router.push('/(main)/cry-analyzer')}
            accessibilityRole="button"
            accessibilityLabel={t('chatbot.cryAnalysis')}
            activeOpacity={0.7}
          >
            <Image source={require('../../assets/trait-analyst-small.png')} style={styles.analyzerPillIcon} resizeMode="contain" />
            <Text style={styles.analyzerPillText}>{t('chatbot.cryAnalysis')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Area (hidden during first talk - input is inside FirstTalkCard) */}
      {!showFirstTalk && (
        <CoachingInput
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          onPhoto={handlePhoto}
          disabled={sending || !canUseCoaching}
          placeholder={!canUseCoaching ? t('chatbot.noPermissionPlaceholder') : undefined}
        />
      )}

      <GuideCarousel visible={guideVisible} pages={getChatbotGuide(t)} onClose={closeGuide} onComplete={closeGuide} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COACHING_COLORS.bg,
  },
  disclaimer: {
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF1',
  },
  disclaimerText: {
    fontSize: 10,
    color: '#7A7A82',
    lineHeight: 14,
    textAlign: 'center',
  },
  citationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 3,
  },
  citationLabel: {
    fontSize: 10,
    color: '#9A9AA2',
    lineHeight: 14,
  },
  citationLink: {
    fontSize: 10,
    color: '#5B8DEF',
    lineHeight: 14,
    textDecorationLine: 'underline',
  },
  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: COACHING_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COACHING_COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COACHING_COLORS.text,
  },
  headerChild: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COACHING_COLORS.accent,
  },
  headerPhotoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COACHING_COLORS.accent,
  },
  headerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COACHING_COLORS.text,
  },
  /* Chat */
  chatArea: { flex: 1 },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  /* Typing */
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  typingAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COACHING_COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingText: {
    fontSize: 13,
    color: COACHING_COLORS.textLight,
  },
  /* Photo preview */
  photoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COACHING_COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COACHING_COLORS.border,
  },
  photoThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  photoLabel: {
    fontSize: 12,
    color: COACHING_COLORS.textSub,
  },
  /* Analyzer shortcuts */
  analyzerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COACHING_COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COACHING_COLORS.border,
  },
  analyzerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: COACHING_COLORS.accent,
  },
  analyzerPillIcon: {
    width: 14,
    height: 14,
  },
  analyzerPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COACHING_COLORS.accent,
  },
  categoryToggle: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COACHING_COLORS.accent,
    marginVertical: 6,
  },
  categoryToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COACHING_COLORS.accent,
  },
});
