import AsyncStorage from '@react-native-async-storage/async-storage';

export type AnalysisType = 'pattern' | 'poop' | 'cry';

export interface AnalysisMetric {
  title: string;
  value: string;
  comment?: string;
  advice?: string;
  emoji?: string;
  level?: string;
  standardRange?: string;
}

export interface AnalysisHistoryItem {
  id: string;
  type: AnalysisType;
  createdAt: number; // epoch ms
  summary: string;
  details?: string;
  childId?: string;
  childName?: string;
  thumbnailUri?: string;
  // 상세 팝업용 추가 필드
  metrics?: AnalysisMetric[];
  fullText?: string; // 종합 분석 본문(긴 텍스트)
  recommendations?: string[];
}

const MAX_PER_TYPE = 10;

function storageKey(type: AnalysisType): string {
  return `ai_analysis_history_${type}`;
}

export async function loadAnalysisHistory(
  type: AnalysisType,
): Promise<AnalysisHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(type));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as AnalysisHistoryItem[])
      .filter((x) => x && typeof x.id === 'string')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_PER_TYPE);
  } catch {
    return [];
  }
}

export async function saveAnalysisHistory(
  item: Omit<AnalysisHistoryItem, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: number;
  },
): Promise<void> {
  try {
    const current = await loadAnalysisHistory(item.type);
    const entry: AnalysisHistoryItem = {
      id: item.id ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: item.createdAt ?? Date.now(),
      type: item.type,
      summary: item.summary,
      details: item.details,
      childId: item.childId,
      childName: item.childName,
      thumbnailUri: item.thumbnailUri,
      metrics: item.metrics,
      fullText: item.fullText,
      recommendations: item.recommendations,
    };
    const next = [entry, ...current].slice(0, MAX_PER_TYPE);
    await AsyncStorage.setItem(storageKey(item.type), JSON.stringify(next));
  } catch {
    // 저장 실패는 조용히 무시 (분석 결과 자체는 화면에 표시됨)
  }
}

export async function deleteAnalysisHistoryItem(
  type: AnalysisType,
  id: string,
): Promise<void> {
  try {
    const current = await loadAnalysisHistory(type);
    const next = current.filter((x) => x.id !== id);
    await AsyncStorage.setItem(storageKey(type), JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function clearAnalysisHistory(type: AnalysisType): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(type));
  } catch {
    // ignore
  }
}
