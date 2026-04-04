import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYS = {
  ACCESS_TOKEN: 'amatda_accessToken',
  REFRESH_TOKEN: 'amatda_refreshToken',
  USER_ID: 'amatda_userId',
  EMAIL: 'amatda_email',
} as const;

// Web에서는 SecureStore 미지원 → localStorage fallback
function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    SecureStore.setItemAsync(key, value).catch(() => {});
  }
}

function getItem(key: string): string | null {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  // Sync하게 가져올 수 없으므로 hydrate에서 async 처리
  return null;
}

function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    SecureStore.deleteItemAsync(key).catch(() => {});
  }
}

export function saveAuth(data: {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
}) {
  setItem(KEYS.ACCESS_TOKEN, data.accessToken);
  setItem(KEYS.REFRESH_TOKEN, data.refreshToken);
  setItem(KEYS.USER_ID, data.userId);
  setItem(KEYS.EMAIL, data.email);
}

export async function loadAuthAsync(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;
}> {
  if (Platform.OS === 'web') {
    return {
      accessToken: localStorage.getItem(KEYS.ACCESS_TOKEN),
      refreshToken: localStorage.getItem(KEYS.REFRESH_TOKEN),
      userId: localStorage.getItem(KEYS.USER_ID),
      email: localStorage.getItem(KEYS.EMAIL),
    };
  }

  const [accessToken, refreshToken, userId, email] = await Promise.all([
    SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
    SecureStore.getItemAsync(KEYS.USER_ID),
    SecureStore.getItemAsync(KEYS.EMAIL),
  ]);

  return { accessToken, refreshToken, userId, email };
}

export function clearAuth() {
  deleteItem(KEYS.ACCESS_TOKEN);
  deleteItem(KEYS.REFRESH_TOKEN);
  deleteItem(KEYS.USER_ID);
  deleteItem(KEYS.EMAIL);
}
