import { create } from 'zustand';

interface AgeInfo {
  months: number;
  group: 'infant' | 'toddler' | 'elementary';
  label: string;
}

interface InnateDataPublic {
  fiveElements: { wood: number; fire: number; earth: number; metal: number; water: number };
  dominantType: string;
  label: string;
}

export interface Child {
  id: string;
  name: string;
  gender: 'M' | 'F';
  birthDate: string;
  birthTime: string;
  innateData: InnateDataPublic;
  baseline: Record<string, unknown> | null;
  observedTraits: Record<string, unknown> | null;
  ageInfo: AgeInfo;
}

interface ChildState {
  children: Child[];
  selectedChildId: string | null;
  selectedChild: Child | null;
  setChildren: (children: Child[]) => void;
  selectChild: (id: string) => void;
  addChild: (child: Child) => void;
  removeChild: (id: string) => void;
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
}));
