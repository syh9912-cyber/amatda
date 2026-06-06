import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  // 전 화면 헤더 숨김 — 라우트 이름(consent/notification-permission 등) 상단 노출 방지.
  // 각 화면이 필요 시 자체 헤더 렌더.
  return <Stack screenOptions={{ headerShown: false }} />;
}
