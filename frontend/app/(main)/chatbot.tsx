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
} from 'react-native';
import { Stack } from 'expo-router';
import { coachingApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { CoachMessage } from '../../components/coaching/CoachMessage';
import { ParentMessage } from '../../components/coaching/ParentMessage';
import { CheckinCard } from '../../components/coaching/CheckinCard';
import { CategoryBar } from '../../components/coaching/CategoryBar';
import { FollowupCard } from '../../components/coaching/FollowupCard';
import { CoachingInput } from '../../components/coaching/CoachingInput';
import {
  CoachingMessage,
  FollowupItem,
  COACHING_COLORS,
} from '../../components/coaching/types';

export default function CoachingScreen() {
  const child = useChildStore((s) => s.selectedChild);
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (child) {
      loadHistory();
      loadFollowups();
    }
  }, [child?.id]);

  const loadHistory = async () => {
    if (!child) return;
    try {
      const res = await coachingApi.history(child.id);
      const data = res.data?.data;
      if (Array.isArray(data) && data.length > 0) {
        setMessages(data);
        setCheckedIn(true);
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
          text: reply?.text ?? reply?.reply ?? '\uB2F5\uBCC0\uC744 \uC900\uBE44\uD558\uACE0 \uC788\uC5B4\uC694.',
          reason: reply?.reason,
          solutions: reply?.solutions,
          source: reply?.source ?? 'ai',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, coachMsg]);
      } catch {
        const errMsg: CoachingMessage = {
          id: `e-${Date.now()}`,
          isCoach: true,
          text: '\uC751\uB2F5\uC744 \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.',
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
          ? '\uC88B\uC544\uC694'
          : mood === 'normal'
            ? '\uBCF4\uD1B5\uC774\uC5D0\uC694'
            : '\uC548 \uC88B\uC544\uC694';
      sendMessage(
        `\uC624\uB298 \uC544\uC774 \uCEE8\uB514\uC158: ${moodLabel}`
      );
    },
    [child, sendMessage]
  );

  const handleCategorySelect = useCallback(
    (key: string, label: string) => {
      const text = `\uC544\uC774\uAC00 ${label} \uAD00\uB828\uD574\uC11C \uACE0\uBBFC\uC774 \uC788\uC5B4\uC694`;
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

  const childName = child?.name ?? '\uC544\uC774';
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
          AI {'\uC721\uC544 \uCF54\uCE6D'}
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
                {child?.gender === 'F' ? '\uD83D\uDC67' : '\uD83D\uDC66'}
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
              <Text style={styles.typingAvatarText}>{'\uD83E\uDD16'}</Text>
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator
                size="small"
                color={COACHING_COLORS.accent}
              />
              <Text style={styles.typingText}>
                {'\uB2F5\uBCC0 \uC900\uBE44 \uC911...'}
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
            {'\uC0AC\uC9C4 \uCCA8\uBD80\uB428'}
          </Text>
        </View>
      ) : null}

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
});
