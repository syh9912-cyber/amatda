/**
 * 가이드 첫 방문 1회 자동표시 추적 헬퍼.
 * 각 화면은 고유 key("chatbot","coparenting" 등)로 첫 진입 시 1회만 자동 표시하고,
 * 헤더 '?' 버튼으로는 언제든 재열람할 수 있다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'guide_seen_';

/** 아직 본 적 없으면 true (= 자동 표시 대상) */
export async function shouldAutoShowGuide(key: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PREFIX + key);
    return !v;
  } catch {
    return false; // 조회 실패 시 자동표시 안 함(중복 노출 방지)
  }
}

/** 본 것으로 표시 */
export async function markGuideSeen(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, '1');
  } catch {
    /* best-effort */
  }
}
