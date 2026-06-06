/**
 * ScreenHeader — 앱 전역 통일 화면 헤더 (뒤로가기 + 제목 + 우측 슬롯).
 *
 * 스타일: 고정 높이 52px 바, 흰 배경, 제목 중앙 정렬, 좌측 BackButton.
 * 전제: 부모가 SafeAreaView(edges top) 등으로 상단 노치 여백을 이미 처리한다고 가정
 *       (insets.top 을 여기서 더하지 않음 → 중복 패딩 방지).
 *
 * 사용:
 *   <ScreenHeader title="성장 기록" />
 *   <ScreenHeader title="맘스톡" right={<검색버튼 />} />
 *   <ScreenHeader title="..." onBack={() => 커스텀동작()} />
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { BackButton } from './BackButton';

interface Props {
  title?: string;
  /** 우측 액션 슬롯 (검색·설정 등) */
  right?: React.ReactNode;
  /** 뒤로가기 커스텀 동작 (미지정 시 router.back) */
  onBack?: () => void;
  /** 바 배경 등 override */
  style?: ViewStyle;
}

export function ScreenHeader({ title, right, onBack, style }: Props) {
  return (
    <View style={[styles.bar, style]}>
      <View style={styles.side}>
        <BackButton onPress={onBack} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const SIDE = 40;

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  side: {
    width: SIDE,
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    marginHorizontal: 4,
  },
});
