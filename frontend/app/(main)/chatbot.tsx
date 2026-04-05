import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { chatbotApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { MessageBubble } from '../../components/chatbot/MessageBubble';
import { QuickReplies } from '../../components/chatbot/QuickReplies';
import { TypingIndicator } from '../../components/chatbot/TypingIndicator';

interface ChatMessage {
  id: string;
  message: string;
  isUser: boolean;
  createdAt: string;
}

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await chatbotApi.history();
      setMessages(res.data.data);
    } catch {
      // ignore
    }
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;
    setInput('');
    setSending(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      message: text.trim(),
      isUser: true,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    try {
      const res = await chatbotApi.send(text.trim());
      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        message: res.data.data.reply,
        isUser: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        message: '응답을 가져오지 못했습니다. 다시 시도해주세요.',
        isUser: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }, [sending, scrollToBottom]);

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleQuickReply = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  const isEmpty = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Stack.Screen options={{ title: '육아 상담', headerShown: true }} />

      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        onContentSizeChange={scrollToBottom}
      >
        {isEmpty && !sending && (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeEmoji}>{'👋'}</Text>
            <Text style={styles.welcomeTitle}>육아 상담 챗봇</Text>
            <Text style={styles.welcomeText}>
              안녕하세요! 육아 관련 궁금한 점이나{'\n'}
              교구 배송/구독 문의를 해주세요.
            </Text>
            <QuickReplies onSelect={handleQuickReply} />
          </View>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg.message}
            isUser={msg.isUser}
            createdAt={msg.createdAt}
          />
        ))}
        {sending && <TypingIndicator />}
      </ScrollView>

      {!isEmpty && !sending && (
        <View style={styles.quickReplyBar}>
          <QuickReplies onSelect={handleQuickReply} />
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor={COLORS.textLight}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          <Text style={styles.sendText}>
            {sending ? '...' : '전송'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  messageList: { flex: 1 },
  messageContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
    flexGrow: 1,
  },
  welcomeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  welcomeEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  welcomeTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  welcomeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  quickReplyBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  inputRow: {
    flexDirection: 'row',
    padding: SPACING.sm,
    paddingBottom: SPACING.sm + 34,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  sendBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#FFF', fontWeight: '600' },
});
