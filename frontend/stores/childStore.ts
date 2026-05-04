import { create } from 'zustand';

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
  setChildren: (children: Child[]) => void;
  selectChild: (id: string) => void;
  addChild: (child: Child) => void;
  removeChild: (id: string) => void;
  updateChild: (child: Child) => void;
}

export const useChildStore = create<ChildState>((set, get) => ({
  children: [],
  selectedChildId: null,
  selectedChild: null,
  setChildren: (children) => {
    const current = get().selectedChildId;
    const selected = current
      ? children.find((c) => c.id === current) ?? children[0] ?? null
      : children[0] ?? null;
    set({ children, selectedChild: selected, selectedChildId: selected?.id ?? null });
  },
  selectChild: (id) => {
    const child = get().children.find((c) => c.id === id) ?? null;
    set({ selectedChildId: id, selectedChild: child });
  },
  addChild: (child) => {
    const updated = [...get().children, child];
    set({ children: updated, selectedChild: child, selectedChildId: child.id });
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
}));
