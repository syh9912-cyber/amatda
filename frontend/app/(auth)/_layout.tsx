import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (isHydrated && isAuthenticated) {
    return <Redirect href="/(main)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
