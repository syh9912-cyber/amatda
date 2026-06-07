/**
 * AnnouncementPopup — 앱 시작 공지 팝업.
 * 이미지(선택) + 제목 + 본문 + "오늘/일주일 보지 않기" 체크박스 + 닫기.
 * 노출/날짜 제어는 서버(announcements 컬렉션), 다시 보지 않기는 로컬(AsyncStorage)에서 처리.
 */
import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { CenterModal } from '../ui/CenterModal';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  /** 있으면 본문 아래 '이동' 버튼 표시 (구글폼 등) */
  linkUrl?: string | null;
  linkLabel?: string | null;
}

export type DismissChoice = 'today' | 'week' | 'none';

interface Props {
  visible: boolean;
  announcement: Announcement | null;
  onClose: (choice: DismissChoice) => void;
}

export function AnnouncementPopup({ visible, announcement, onClose }: Props) {
  const [choice, setChoice] = useState<'today' | 'week' | null>(null);
  if (!announcement) return null;

  const close = () => {
    onClose(choice ?? 'none');
    setChoice(null);
  };

  const openLink = () => {
    if (announcement.linkUrl) {
      Linking.openURL(announcement.linkUrl).catch(() => { /* ignore */ });
    }
    close();
  };

  return (
    <CenterModal visible={visible} onRequestClose={close} cardStyle={s.card}>
      {announcement.imageUrl ? (
        <Image source={{ uri: announcement.imageUrl }} style={s.image} resizeMode="cover" />
      ) : null}

      <View style={s.body}>
        {!!announcement.title && <Text style={s.title}>{announcement.title}</Text>}
        {!!announcement.body && <Text style={s.text}>{announcement.body}</Text>}

        <View style={s.checks}>
          <CheckRow
            label="오늘 하루 보지 않기"
            on={choice === 'today'}
            onPress={() => setChoice(choice === 'today' ? null : 'today')}
          />
          <CheckRow
            label="일주일 동안 보지 않기"
            on={choice === 'week'}
            onPress={() => setChoice(choice === 'week' ? null : 'week')}
          />
        </View>

        {announcement.linkUrl ? (
          <>
            <TouchableOpacity style={s.linkBtn} onPress={openLink} activeOpacity={0.85}>
              <Text style={s.linkText}>{announcement.linkLabel || '자세히 보기'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.closeTextBtn} onPress={close} activeOpacity={0.7}>
              <Text style={s.closeTextOnly}>닫기</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={s.closeBtn} onPress={close} activeOpacity={0.85}>
            <Text style={s.closeText}>닫기</Text>
          </TouchableOpacity>
        )}
      </View>
    </CenterModal>
  );
}

function CheckRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.checkRow} onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
      <View style={[s.checkbox, on && s.checkboxOn]}>{on ? <Text style={s.checkMark}>✓</Text> : null}</View>
      <Text style={s.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const ACCENT = '#F4A98C';

const s = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden', width: '88%' },
  image: { width: '100%', height: 168, backgroundColor: '#F2F2F7' },
  body: { padding: 22, alignItems: 'stretch' },
  title: { fontSize: 17, fontWeight: '800', color: '#2D2D33', textAlign: 'center', marginBottom: 8 },
  text: { fontSize: 14, lineHeight: 21, color: '#555', textAlign: 'center', marginBottom: 16 },
  checks: { gap: 10, marginBottom: 18, alignSelf: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#C7C7CC',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF',
  },
  checkboxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkMark: { color: '#FFF', fontSize: 13, fontWeight: '900', marginTop: -1 },
  checkLabel: { fontSize: 13.5, color: '#444', fontWeight: '600' },
  closeBtn: { backgroundColor: ACCENT, borderRadius: 24, paddingVertical: 13, alignItems: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  linkBtn: { backgroundColor: ACCENT, borderRadius: 24, paddingVertical: 13, alignItems: 'center' },
  linkText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  closeTextBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  closeTextOnly: { color: '#9E9E9E', fontSize: 14, fontWeight: '600' },
});
