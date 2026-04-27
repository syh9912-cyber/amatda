/**
 * AsyncStorage 기반 즉시 캐시 (cache-first SWR 패턴).
 * 큰 객체도 그대로 직렬화. 실패는 조용히 무시.
 */

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let _storage: Storage | null = null;

async function getStorage(): Promise<Storage | null> {
  if (_storage) return _storage;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    _storage = mod.default;
    return _storage;
  } catch {
    return null;
  }
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const s = await getStorage();
    if (!s) return null;
    const raw = await s.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    const s = await getStorage();
    if (!s) return;
    await s.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
