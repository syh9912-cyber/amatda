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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { coachingApi, memoriesApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { CoachMessage } from '../../components/coaching/CoachMessage';
import { ParentMessage } from '../../components/coaching/ParentMessage';
import { CheckinCard } from '../../components/coaching/CheckinCard';
import { CategoryBar } from '../../components/coaching/CategoryBar';
import { FollowupCard } from '../../components/coaching/FollowupCard';
import { CoachingInput } from '../../components/coaching/CoachingInput';
import { YearAgoBanner } from '../../components/coaching/YearAgoBanner';
import {
  CoachingMessage,
  FollowupItem,
  COACHING_COLORS,
} from '../../components/coaching/types';

export default function CoachingScreen() {
  const router = useRouter();
  const child = useChildStore((s) => s.selectedChild);
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [yearAgoMemory, setYearAgoMemory] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (child) {
      loadHistory();
      loadFollowups();
      loadYearAgoMemory();
    }
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
              followup: (session.followup as string | undefined) ??
                (session.followupQuestion as string | undefined) ?? undefined,
              createdAt: ts,
            });
          }
        }
        if (mapped.length > 0) {
          setMessages(mapped);
          setCheckedIn(true);
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
      if (!text.trim() || sending || !child) return;
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
        const res = await coachingApi.send(child.id, text.trim(), category);
        const reply = res.data?.data;
        const coachMsg: CoachingMessage = {
          id: `c-${Date.now()}`,
          isCoach: true,
          text: reply?.answer ?? reply?.text ?? reply?.reply ?? '답변을 준비하고 있어요.',
          reason: reply?.reason,
          solutions: reply?.solutions,
          source: reply?.source ?? 'ai',
          redFlag: reply?.redFlag ?? undefined,
          reasons: reply?.reasons ?? undefined,
          medical: reply?.medical ?? undefined,
          followup: reply?.followup ?? undefined,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, coachMsg]);
      } catch {
        const errMsg: CoachingMessage = {
          id: `e-${Date.now()}`,
          isCoach: true,
          text: '응답을 가져오지 못했어요. 다시 시도해주세요.',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setSending(false);
        scrollToBottom();
      }
    },
    [sending, child, photoUri, scrollToBottom]
  );

  const handleCheckin = useCallback(
    async (mood: string) => {
      if (!child) return;
      setCheckedIn(true);
      try {
        await coachingApi.checkin(child.id, mood);
      } catch {
        // ignore
      }
      const moodLabel =
        mood === 'good'
          ? '좋아요'
          : mood === 'normal'
            ? '보통이에요'
            : '안 좋아요';
      sendMessage(
        `오늘 아이 컨디션: ${moodLabel}`
      );
    },
    [child, sendMessage]
  );

  const handleCategorySelect = useCallback(
    (key: string, label: string) => {
      const text = `아이가 ${label} 관련해서 고민이 있어요`;
      setInput(text);
    },
    []
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

  const childName = child?.name ?? '아이';
  const isEmpty = messages.length === 0;
  const showCheckin = isEmpty && !checkedIn;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          AI {'육아 코칭'}
        </Text>
        <View style={styles.headerChild}>
          {child?.photoUri ? (
            <Image
              source={{ uri: child.photoUri }}
              style={styles.headerPhoto}
            />
          ) : (
            <View style={styles.headerPhotoPlaceholder}>
              <Text style={styles.headerPhotoEmoji}>
                {child?.gender === 'F' ? '👧' : '👦'}
              </Text>
            </View>
          )}
          <Text style={styles.headerName}>{childName}</Text>
        </View>
      </View>

      {/* Category Quick Buttons */}
      <CategoryBar onSelect={handleCategorySelect} />

      {/* Chat Area */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={scrollToBottom}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Check-in Card */}
        {showCheckin ? (
          <CheckinCard onSelect={handleCheckin} />
        ) : null}

        {/* Messages */}
        {messages.map((msg) =>
          msg.isCoach ? (
            <CoachMessage key={msg.id} message={msg} />
          ) : (
            <ParentMessage key={msg.id} message={msg} />
          )
        )}

        {/* Sending indicator */}
        {sending ? (
          <View style={styles.typingRow}>
            <View style={styles.typingAvatar}>
              <Text style={styles.typingAvatarText}>{'🤖'}</Text>
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator
                size="small"
                color={COACHING_COLORS.accent}
              />
              <Text style={styles.typingText}>
                {'답변 준비 중...'}
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
            {'사진 첨부됨'}
          </Text>
        </View>
      ) : null}

      {/* Analyzer shortcuts */}
      <View style={styles.analyzerRow}>
        <TouchableOpacity
          style={styles.analyzerPill}
          onPress={() => router.push('/(main)/poop-analyzer')}
          activeOpacity={0.7}
        >
          <Text style={styles.analyzerPillText}>
            {'🔍 대변 분석'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.analyzerPill}
          onPress={() => router.push('/(main)/cry-analyzer')}
          activeOpacity={0.7}
        >
          <Text style={styles.analyzerPillText}>
            {'🔍 울음 분석'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Input Area */}
      <CoachingInput
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        onPhoto={handlePhoto}
        disabled={sending}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COACHING_COLORS.bg,
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
    backgroundColor: COACHING_COLORS.coachAvatar,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COACHING_COLORS.accent,
  },
  headerPhotoEmoji: { fontSize: 16 },
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
  typingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COACHING_COLORS.coachAvatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingAvatarText: { fontSize: 18 },
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFF5EC',
    borderWidth: 1,
    borderColor: COACHING_COLORS.accent,
  },
  analyzerPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COACHING_COLORS.accent,
  },
});
