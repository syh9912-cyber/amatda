import { useState, useEffect, useRef } from 'react';
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

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // 즉시 유저 메시지 표시
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      message: text,
      isUser: true,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await chatbotApi.send(text);
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
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: '육아 상담', headerShown: true }} />

      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeEmoji}>👋</Text>
            <Text style={styles.welcomeText}>
              안녕하세요! 육아 관련 궁금한 점이나{'\n'}교구 배송/구독 문의를 해주세요.
            </Text>
          </View>
        )}
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[styles.bubble, msg.isUser ? styles.userBubble : styles.botBubble]}
          >
            <Text style={[styles.bubbleText, msg.isUser && styles.userText]}>
              {msg.message}
            </Text>
          </View>
        ))}
      </ScrollView>

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
          <Text style={styles.sendText}>{sending ? '...' : '전송'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  messageList: { flex: 1 },
  messageContent: { padding: SPACING.md, paddingBottom: SPACING.lg },
  welcomeCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.lg,
  },
  welcomeEmoji: { fontSize: 36, marginBottom: SPACING.md },
  welcomeText: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  bubble: {
    maxWidth: '80%', borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  userBubble: {
    backgroundColor: COLORS.primary, alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: COLORS.surface, alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
  userText: { color: '#FFF' },
  inputRow: {
    flexDirection: 'row', padding: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface, gap: SPACING.sm,
  },
  input: {
    flex: 1, backgroundColor: COLORS.background,
    borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text,
  },
  sendBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#FFF', fontWeight: '600' },
});
