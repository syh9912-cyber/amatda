import { create } from 'zustand';
import { useAuthStore } from './authStore';

/* ────────────────────────────────────────────────────────────
 * 로컬 캐시 (stale-while-revalidate)
 * 콜드스타트 시 서버 응답 전에 마지막 자녀 목록을 즉시 렌더 → 홈 전체화면
 * 스피너 대기 제거. 사용자별 키로 저장해 계정 전환 시 교차 노출 방지.
 * 네이티브 모듈은 동적 import + 인메모리 폴백(부팅 안전).
 * ──────────────────────────────────────────────────────────── */
type MiniStorage = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
};
let _storage: MiniStorage | null = null;
async function getStorage(): Promise<MiniStorage> {
  if (_storage) return _storage;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    _storage = mod.default as unknown as MiniStorage;
  } catch {
    const mem: Record<string, string> = {};
    _storage = {
      getItem: async (k) => mem[k] ?? null,
      setItem: async (k, v) => { mem[k] = v; },
    };
  }
  return _storage;
}
function childrenCacheKey(userId: string): string {
  return `amatda_children_cache_${userId}`;
}
async function saveChildrenCache(children: Child[], selectedChildId: string | null, ownerUserId: string | null): Promise<void> {
  const userId = useAuthStore.getState().userId;
  // 미로그인 or 소유자 불일치(계정 전환 잔존 데이터)면 저장 안 함 — 교차 오염 방지
  if (!userId || ownerUserId !== userId) return;
  try {
    const s = await getStorage();
    await s.setItem(childrenCacheKey(userId), JSON.stringify({ children, selectedChildId }));
  } catch { /* best-effort */ }
}

// 로그아웃 시 모든 사용자 자녀 캐시 제거 (at-rest 프라이버시). userId 소실 후 호출되어
// 특정 키를 못 짚으므로 amatda_children_cache_* 전체 정리. best-effort.
async function clearChildrenCaches(): Promise<void> {
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    const AS = mod.default as unknown as {
      getAllKeys: () => Promise<readonly string[]>;
      multiRemove: (keys: string[]) => Promise<void>;
    };
    const keys = await AS.getAllKeys();
    const mine = keys.filter((k) => k.startsWith('amatda_children_cache_'));
    if (mine.length) await AS.multiRemove([...mine]);
  } catch { /* best-effort */ }
}

interface AgeInfo {
  months: number;
  group: 'pregnant' | 'infant' | 'toddler' | 'elementary';
  label: string;
}

interface InnateDataPublic {
  fiveElements: { wood: number; fire: number; earth: number; metal: number; water: number };
  dominantType: string;
  label: string;
}

export interface ReportReasons {
  personality: string;
  studyStyle: string;
  bestSubjects: string;
  futureFields: string;
  sportsMatch: string;
  academyStyle: string;
  foods: string;
}

export interface DetailItem {
  item: string;
  reason: string;
}

export interface AnalysisReport {
  summary: string;
  personality: string[];
  studyStyle: string;
  bestSubjects: string[];
  weakAreas: string[];
  futureFields: string[];
  sportsMatch: string[];
  academyStyle: string;
  goodFoods: string[];
  badFoods: string[];
  educationDirection: string;
  specialTalent: string;
  parentingTip: string;
  reasons?: ReportReasons;
  strengthsDetail?: DetailItem[];
  weaknessesDetail?: DetailItem[];
  doList?: string[];
  dontList?: string[];
  dailyRoutineTip?: string;
  socialTip?: string;
  emotionalTip?: string;
}

export interface Child {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'U';
  birthDate: string | null;
  birthTime: string | null;
  photoUri: string | null;
  innateData: InnateDataPublic | null;
  baseline: Record<string, unknown> | null;
  observedTraits: Record<string, unknown> | null;
  analysisReport: AnalysisReport | null;
  ageInfo: AgeInfo;
  height?: number | null;
  weight?: number | null;
  /** 등록일(ISO) — 성장기록 첫 기록 날짜 기준(생일 아님) */
  createdAt?: string | null;
  bloodType?: string | null;
  specialNotes?: string | null;
  // 임산부 전용
  isPregnant?: boolean;
  dueDate?: string | null;
  pregnancyWeeks?: number | null;
  pregnancyNotes?: string | null;
  momHeight?: number | null;
  momWeight?: number | null;
  momBloodType?: string | null;
  momSpecialNotes?: string | null;
  /**
   * 고위험 임신 여부 — 다태/임신성고혈압/GDM/조산기/35세 이상 등.
   * 사용자가 child-edit.tsx 에서 직접 체크. 옛 문서는 undefined → false 처리.
   */
  isHighRiskPregnancy?: boolean;
}

interface ChildState {
  children: Child[];
  selectedChildId: string | null;
  selectedChild: Child | null;
  /** 현재 인메모리 데이터의 소유 사용자 — 계정 전환 시 스테일 데이터 교차노출 방지용. */
  ownerUserId: string | null;
  setChildren: (children: Child[]) => void;
  selectChild: (id: string) => void;
  addChild: (child: Child) => void;
  removeChild: (id: string) => void;
  updateChild: (child: Child) => void;
  /** 로컬 캐시에서 자녀 목록 복원 (콜드스타트 즉시 렌더용). 캐시가 있으면 true. */
  hydrateFromCache: () => Promise<boolean>;
  /** 로그아웃 시 인메모리 + 영속 캐시 초기화 (계정 전환 교차노출 방지). */
  reset: () => void;
}

export const useChildStore = create<ChildState>((set, get) => ({
  children: [],
  selectedChildId: null,
  selectedChild: null,
  ownerUserId: null,
  setChildren: (children) => {
    const current = get().selectedChildId;
    const selected = current
      ? children.find((c) => c.id === current) ?? children[0] ?? null
      : children[0] ?? null;
    set({ children, selectedChild: selected, selectedChildId: selected?.id ?? null, ownerUserId: useAuthStore.getState().userId });
  },
  selectChild: (id) => {
    const child = get().children.find((c) => c.id === id) ?? null;
    set({ selectedChildId: id, selectedChild: child });
  },
  addChild: (child) => {
    const updated = [...get().children, child];
    set({ children: updated, selectedChild: child, selectedChildId: child.id, ownerUserId: useAuthStore.getState().userId });
  },
  removeChild: (id) => {
    const updated = get().children.filter((c) => c.id !== id);
    const selected = updated[0] ?? null;
    set({ children: updated, selectedChild: selected, selectedChildId: selected?.id ?? null });
  },
  updateChild: (child) => {
    const updated = get().children.map((c) => (c.id === child.id ? child : c));
    const sel = get().selectedChildId === child.id ? child : get().selectedChild;
    set({ children: updated, selectedChild: sel });
  },
  hydrateFromCache: async () => {
    const userId = useAuthStore.getState().userId;
    if (!userId) return false;
    // 현재 사용자 소유의 최신 데이터가 이미 있으면 그대로 사용
    if (get().children.length > 0 && get().ownerUserId === userId) return true;
    // 소유자 불일치(계정 전환 잔존) → 스테일 인메모리 즉시 제거 (교차노출 방지)
    if (get().ownerUserId !== userId && get().children.length > 0) {
      set({ children: [], selectedChild: null, selectedChildId: null, ownerUserId: null });
    }
    try {
      const s = await getStorage();
      const raw = await s.getItem(childrenCacheKey(userId));
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { children?: Child[]; selectedChildId?: string | null };
      const cached = parsed.children;
      if (!Array.isArray(cached) || cached.length === 0) return false;
      if (get().children.length > 0 && get().ownerUserId === userId) return true; // 로드 경합 방어
      const sel = parsed.selectedChildId
        ? cached.find((c) => c.id === parsed.selectedChildId) ?? cached[0]
        : cached[0];
      set({ children: cached, selectedChild: sel ?? null, selectedChildId: sel?.id ?? null, ownerUserId: userId });
      return true;
    } catch {
      return false;
    }
  },
  reset: () => {
    set({ children: [], selectedChildId: null, selectedChild: null, ownerUserId: null });
    void clearChildrenCaches();
  },
}));

// 자녀 상태 변경 시 로컬 캐시에 저장 (stale-while-revalidate) — fire-and-forget.
// ownerUserId 가 현재 로그인 유저와 일치할 때만 저장(교차 오염 방지).
useChildStore.subscribe((state) => {
  void saveChildrenCache(state.children, state.selectedChildId, state.ownerUserId);
});
