/**
 * BatchPhotoReview — 성장앨범 "여러 장 추가" 확인 화면.
 *
 * 갤러리에서 다중선택한 사진들을 한 화면에서 검토 → 일괄 앨범 저장.
 * 사진마다 개별로 "가족피드 공유" 토글 + 한 줄 메모(선택) 지정 가능.
 * (가족피드를 따로 올리지 않고, 성장앨범에서 공유할 사진만 고르는 통합 방식)
 *
 * 이 컴포넌트는 UI 전용 — 실제 업로드/저장은 onConfirm 콜백(부모 album.tsx)이 처리.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';

export interface BatchSelection {
  uri: string;
  share: boolean;
  memo: string;
}

interface Props {
  visible: boolean;
  uris: string[];
  saving: boolean;
  progress: { done: number; total: number } | null;
  onCancel: () => void;
  onConfirm: (selections: BatchSelection[]) => void;
}

const COLOR = {
  bg: '#FFFFFF',
  text: '#1C1C1E',
  textSub: '#636366',
  border: '#E5E5EA',
  accent: '#FF8C5A',
  feed: '#E91E63',
};

export function BatchPhotoReview({ visible, uris, saving, progress, onCancel, onConfirm }: Props) {
  const [items, setItems] = useState<BatchSelection[]>([]);

  // uris 가 바뀔 때(새로 선택) 상태 초기화
  useEffect(() => {
    if (visible) {
      setItems(uris.map((uri) => ({ uri, share: false, memo: '' })));
    }
  }, [visible, uris]);

  const sharedCount = items.filter((i) => i.share).length;
  const allShared = items.length > 0 && sharedCount === items.length;

  const toggleShare = (idx: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, share: !it.share } : it)));
  };
  const setMemo = (idx: number, memo: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, memo } : it)));
  };
  const toggleAllShare = () => {
    const next = !allShared;
    setItems((prev) => prev.map((it) => ({ ...it, share: next })));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={saving ? undefined : onCancel}>
      {/* 안전영역: New Arch 에서 RN Modal 내 safe-area-context 측정이 불안정 →
          iOS 노치/다이내믹아일랜드(최대 ~59pt)를 덮는 고정 상단 패딩으로 확실히 처리 */}
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 24) }]}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} disabled={saving} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.headerCancel, saving && { opacity: 0.4 }]}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{`사진 ${uris.length}장 추가`}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* 안내 + 전체 공유 */}
        <View style={styles.subBar}>
          <Text style={styles.subText}>
            모두 성장앨범에 저장돼요. <Text style={{ color: COLOR.feed, fontWeight: '700' }}>공유할 사진만</Text> 가족피드 토글을 켜세요.
          </Text>
          <TouchableOpacity onPress={toggleAllShare} disabled={saving} style={styles.allShareBtn} activeOpacity={0.7}>
            <Text style={styles.allShareText}>{allShared ? '전체 공유 해제' : '전체 피드 공유'}</Text>
          </TouchableOpacity>
        </View>

        {/* 사진 리스트 */}
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {items.map((it, idx) => (
            <View key={it.uri} style={styles.row}>
              <Image source={{ uri: it.uri }} style={styles.thumb} contentFit="cover" />
              <View style={styles.rowBody}>
                <TextInput
                  style={styles.memoInput}
                  placeholder="한 줄 메모 (선택)"
                  placeholderTextColor={COLOR.textSub}
                  value={it.memo}
                  onChangeText={(t) => setMemo(idx, t)}
                  editable={!saving}
                  maxLength={60}
                />
                <View style={styles.shareRow}>
                  <Text style={[styles.shareLabel, it.share && { color: COLOR.feed, fontWeight: '700' }]}>
                    {it.share ? '💛 가족피드 공유' : '가족피드 공유'}
                  </Text>
                  <Switch
                    value={it.share}
                    onValueChange={() => toggleShare(idx)}
                    disabled={saving}
                    trackColor={{ false: '#E5E5EA', true: '#F8BBD0' }}
                    thumbColor={it.share ? COLOR.feed : '#FFFFFF'}
                  />
                </View>
              </View>
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* 저장 버튼 */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={() => onConfirm(items)}
            disabled={saving || items.length === 0}
            activeOpacity={0.8}
          >
            {saving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.saveBtnText}>
                  {progress ? `저장 중 ${progress.done}/${progress.total}` : '저장 중...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.saveBtnText}>
                {sharedCount > 0 ? `${uris.length}장 저장 · ${sharedCount}장 피드 공유` : `${uris.length}장 저장`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
  },
  headerCancel: { fontSize: 15, color: COLOR.textSub, width: 36 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLOR.text },
  subBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  subText: { fontSize: 13, color: COLOR.textSub, lineHeight: 18 },
  allShareBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F8BBD0',
    backgroundColor: '#FFF0F5',
  },
  allShareText: { fontSize: 12.5, fontWeight: '700', color: COLOR.feed },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
  },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F2F2F7' },
  rowBody: { flex: 1, justifyContent: 'space-between' },
  memoInput: {
    fontSize: 14,
    color: COLOR.text,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  shareLabel: { fontSize: 13, color: COLOR.textSub },
  footer: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.border,
  },
  saveBtn: {
    backgroundColor: COLOR.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
