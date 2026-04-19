import axios, { type AxiosInstance } from 'axios';
import { useAuthStore } from '../stores/authStore';

// ─── URL 설정 ───────────────────────────────────────────────
// api: auth, children, food, weather 등 경량 라우트 (Firebase 'api' 함수)
// coachingApi: Gemini AI 코칭 전용 (Firebase 'coachingApi' 함수, 별도 Cloud Run)
//   → 코칭 느려져도 로그인/홈 API 무영향
// 릴리스(프로덕션) 빌드에서 EXPO_PUBLIC_API_URL 누락 시 localhost로 떨어지지 않도록 명시적 경고.
// __DEV__ 일 때만 localhost fallback 허용.
function resolveApiUrl(envValue: string | undefined, name: string): string {
  if (envValue && envValue.length > 0) return envValue;
  if (__DEV__) return 'http://localhost:3001/api';
  console.error(`[api] ${name} 환경변수 누락 — 릴리스 빌드에서 API 호출 실패 예정`);
  return 'https://api-usglfifguq-uc.a.run.app/api';
}

export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL');
export const COACHING_API_URL = process.env.EXPO_PUBLIC_COACHING_API_URL || API_URL;

// ─── 공통 인터셉터 세터 ─────────────────────────────────────
function applyInterceptors(instance: AxiosInstance): void {
  // 토큰 자동 주입
  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // 401 시 토큰 갱신 시도 → 실패하면 logout()만 호출
  // 화면 이동은 (main)/_layout.tsx 의 isAuthenticated 감시가 처리함
  instance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const original = err.config;
      if (err.response?.status === 401 && !original._retry) {
        original._retry = true;
        const refreshToken = useAuthStore.getState().refreshToken;
        if (refreshToken) {
          try {
            const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
            const { accessToken, refreshToken: newRefresh } = res.data.data;
            useAuthStore.getState().setTokens(accessToken, newRefresh);
            original.headers.Authorization = `Bearer ${accessToken}`;
            return instance(original);
          } catch {
            useAuthStore.getState().logout(); // 레이아웃이 로그인 화면으로 보냄
          }
        } else {
          useAuthStore.getState().logout();
        }
      }
      return Promise.reject(err);
    },
  );
}

// ─── 경량 API 인스턴스 (auth, children, food 등) ─────────────
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
applyInterceptors(api);

// ─── 코칭 전용 API 인스턴스 (Gemini AI, 별도 Cloud Run) ──────
// timeout 60초: Gemini 응답 최대 5~10초 + 네트워크 여유
const coachingAxios = axios.create({
  baseURL: COACHING_API_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});
applyInterceptors(coachingAxios);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, parentRole?: string) =>
    api.post('/auth/register', { email, password, parentRole }),
  socialLogin: (provider: string, accessToken: string) =>
    api.post('/auth/social', { provider, accessToken }),
  socialLoginWithCode: (provider: string, code: string, redirectUri: string) =>
    api.post('/auth/social-code', { provider, code, redirectUri }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  setPassword: (newPassword: string) =>
    api.post('/auth/set-password', { newPassword }),
  getProfile: () =>
    api.get('/auth/me'),
  deleteAccount: () =>
    api.delete('/auth/account'),
};

// Children
export const childApi = {
  list: () => api.get('/children'),
  get: (id: string) => api.get(`/children/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/children', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/children/${id}`, data),
  delete: (id: string) => api.delete(`/children/${id}`),
  saveBaseline: (id: string, answers: unknown[]) =>
    api.post(`/children/${id}/baseline`, { answers }),
  analyze: (id: string, answers: { questionId: string; answer: number }[]) =>
    api.post(`/children/${id}/analyze`, { answers }),
  saveDailyTracking: (childId: string, data: Record<string, unknown>) =>
    api.post(`/children/${childId}/daily-tracking`, data),
  getDailyTracking: (childId: string, days = 7) =>
    api.get(`/children/${childId}/daily-tracking`, { params: { days: String(days) } }),
  saveDailyTrait: (childId: string, data: { question: string; answer: string; date: string }) =>
    api.post(`/children/${childId}/daily-trait`, data),
  getDailyTraits: (childId: string) =>
    api.get(`/children/${childId}/daily-traits`),
  // 임신 등록
  registerPregnant: (data: Record<string, unknown>) =>
    api.post('/children/pregnant', data),
  // 출산 전환 (임신→육아)
  birth: (childId: string, data: { birthDate: string; birthTime: string; name?: string; gender?: string; height?: number; weight?: number }) =>
    api.post(`/children/${childId}/birth`, data),
};

// Questions
export const questionApi = {
  list: (ageMonths: number, type?: string) => {
    const params: Record<string, string> = { ageMonths: String(ageMonths) };
    if (type) params.type = type;
    return api.get('/questions', { params });
  },
  onboarding: (ageGroup: string) =>
    api.get('/questions/onboarding', { params: { ageGroup } }),
};

// Food Guide
export const foodApi = {
  list: (ageMonths: number, type?: string) => {
    const params: Record<string, string> = { ageMonths: String(ageMonths) };
    if (type) params.type = type;
    return api.get('/food-guide', { params });
  },
};

// Observations
export const observationApi = {
  create: (childId: string, content: string, type = 'TEXT') =>
    api.post('/observations', { childId, content, type }),
  list: (childId: string) =>
    api.get(`/observations/${childId}`),
  delete: (id: string) =>
    api.delete(`/observations/${id}`),
  report: (childId: string) =>
    api.get(`/observations/report/${childId}`),
};

// Academies
export const academyApi = {
  list: (lat: number, lng: number, ageMonths: number, type?: string, radius = 5) => {
    const params: Record<string, string> = {
      lat: String(lat), lng: String(lng),
      ageMonths: String(ageMonths), radius: String(radius),
    };
    if (type) params.type = type;
    return api.get('/academies', { params });
  },
  recommend: (dominantType: string, ageMonths: number, lat?: number, lng?: number, region?: string) => {
    const params: Record<string, string> = {
      dominantType,
      ageMonths: String(ageMonths),
    };
    if (lat !== undefined) params.lat = String(lat);
    if (lng !== undefined) params.lng = String(lng);
    if (region) params.region = region;
    return api.get('/academies/recommend', { params });
  },
};

// Weather
export const weatherApi = {
  get: (childId: string, lat?: number, lng?: number) => {
    const params: Record<string, string> = {};
    if (lat !== undefined) params.lat = String(lat);
    if (lng !== undefined) params.lng = String(lng);
    return api.get(`/weather/${childId}`, { params });
  },
};

// Subscriptions
export const subscriptionApi = {
  list: (childId: string) => api.get(`/subscriptions/${childId}`),
  create: (childId: string, kitType: string) =>
    api.post('/subscriptions', { childId, kitType }),
  cancel: (id: string) => api.put(`/subscriptions/${id}/cancel`),
};

// Siblings
export const siblingApi = {
  compatibility: () => api.get('/siblings/compatibility'),
};

// Chatbot
export const chatbotApi = {
  send: (message: string) => api.post('/chatbot', { message }),
  history: () => api.get('/chatbot/history'),
};


// Ads
export const adApi = {
  list: (type?: string, limit = 3) => {
    const params: Record<string, string> = { limit: String(limit) };
    if (type) params.type = type;
    return api.get('/ads', { params });
  },
};

// Momstagram (맘스타그램)
export const momstagramApi = {
  getFeed: (page = 0, limit = 20) =>
    api.get('/momstagram/feed', { params: { page: String(page), limit: String(limit) } }),
  createPost: (data: {
    content: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    mediaType?: 'image' | 'video' | 'none';
    sourceType: 'album' | 'diary' | 'manual';
    childAge?: string;
    childGender?: string;
    dominantType?: string;
    milestone?: string;
    milestoneEmoji?: string;
  }) => api.post('/momstagram/posts', data),
  toggleLike: (postId: string) =>
    api.post(`/momstagram/posts/${postId}/like`),
  getComments: (postId: string, page = 0, limit = 20) =>
    api.get(`/momstagram/posts/${postId}/comments`, { params: { page: String(page), limit: String(limit) } }),
  addComment: (postId: string, content: string) =>
    api.post(`/momstagram/posts/${postId}/comments`, { content }),
  deletePost: (postId: string) =>
    api.delete(`/momstagram/posts/${postId}`),
  getMyPosts: (page = 0, limit = 20) =>
    api.get('/momstagram/my-posts', { params: { page: String(page), limit: String(limit) } }),
};

// Memories
export const memoriesApi = {
  yearAgo: (childId: string) =>
    api.get(`/memories/year-ago/${childId}`),
  childCard: (childId: string) =>
    api.get(`/memories/child-card/${childId}`),
  timeline: (childId: string) =>
    api.get(`/memories/timeline/${childId}`),
};

// Coaching (상담이모) — coachingAxios 사용 (별도 Cloud Run 인스턴스)
// 코칭 API가 느려져도 auth/children/food 등 경량 API는 무영향
export const coachingApi = {
  ask: (childId: string, message: string, category?: string, photoUrl?: string) =>
    coachingAxios.post('coaching/ask', { childId, message, category, photoUrl }),
  send: (childId: string, message: string, category?: string) =>
    coachingAxios.post('coaching/ask', { childId, message, category }),
  history: (childId: string) =>
    coachingAxios.get(`coaching/history/${childId}`),
  checkin: (childId: string, mood: string) =>
    coachingAxios.post('coaching/ask', { childId, message: `오늘 아이 컨디션: ${mood}`, category: '체크인' }),
  followups: (childId: string) =>
    coachingAxios.get(`coaching/followups/${childId}`),
  dismissFollowup: (followupId: string) =>
    coachingAxios.post(`coaching/followup/${followupId}/respond`, { answer: '나중에' }),
  respondFollowup: (followupId: string, response: string) =>
    coachingAxios.post(`coaching/followup/${followupId}/respond`, { answer: response }),
  weeklyReport: (childId: string) =>
    coachingAxios.post('coaching/weekly-report', { childId }),
  dailyDiary: (childId: string) =>
    coachingAxios.post('coaching/daily-diary', { childId }),
  analyzeMedia: (childId: string, type: 'cry' | 'poop', description?: string, mediaBase64?: string, mediaMimeType?: string) =>
    coachingAxios.post('coaching/analyze-media', { childId, type, description, mediaBase64, mediaMimeType }),
  firstTalk: (childId: string) =>
    coachingAxios.post('coaching/first-talk', { childId }),
  parentMental: (childId: string) =>
    coachingAxios.post('coaching/parent-mental', { childId }),
  futurePredict: (childId: string) =>
    coachingAxios.post('coaching/future-predict', { childId }),
  nowActivity: (childId: string) =>
    coachingAxios.post('coaching/now-activity', { childId }),
  milestones: (childId: string) =>
    coachingAxios.get(`coaching/milestones/${childId}`),
  saveMilestoneChecks: (childId: string, checks: Record<string, boolean>) =>
    coachingAxios.post(`coaching/milestones/${childId}/check`, { checks }),
  dailyInsight: (childId: string) =>
    coachingAxios.get(`coaching/daily-insight?childId=${childId}`),
  welcome: (childId: string) =>
    coachingAxios.get(`coaching/welcome?childId=${childId}`),
  autoDiary: (childId: string) =>
    coachingAxios.get(`coaching/auto-diary?childId=${childId}`),
  createTimeCapsule: (childId: string, message: string, months: 3 | 6 | 12) =>
    coachingAxios.post('coaching/time-capsule', { childId, message, months }),
  listTimeCapsules: (childId: string) =>
    coachingAxios.get(`coaching/time-capsules?childId=${childId}`),
  openTimeCapsule: (capsuleId: string) =>
    coachingAxios.post(`coaching/time-capsule/${capsuleId}/open`),
  peerComparison: (childId: string) =>
    coachingAxios.get(`coaching/peer-comparison?childId=${childId}`),
  myTier: () =>
    coachingAxios.get('coaching/my-tier'),
  capsuleSuggestion: (childId: string) =>
    coachingAxios.get(`coaching/capsule-suggestion?childId=${childId}`),
  acceptCapsuleSuggestion: (childId: string, diaryDate: string) =>
    coachingAxios.post('coaching/capsule-suggestion/accept', { childId, diaryDate }),
};

// Retention (growth countdown, daily tip, streak)
export const retentionApi = {
  countdown: (childId: string) =>
    api.get(`/retention/countdown/${childId}`),
  dailyCard: (childId: string) =>
    api.get(`/retention/daily-card/${childId}`),
  streak: (childId: string) =>
    api.get(`/retention/streak/${childId}`),
  pushSchedule: (data: Record<string, unknown>) =>
    api.post('/retention/push-schedule', data),
  pushContent: (childId: string) =>
    api.get(`/retention/push-content/${childId}`),
};

// Growth Analysis (성장 분석)
export const growthApi = {
  analysis: (childId: string, tracker?: { diaper?: number; feeding?: number; sleep?: number }) => {
    const params = new URLSearchParams();
    if (tracker?.diaper != null) params.set('diaper', String(tracker.diaper));
    if (tracker?.feeding != null) params.set('feeding', String(tracker.feeding));
    if (tracker?.sleep != null) params.set('sleep', String(tracker.sleep));
    const qs = params.toString();
    return api.get(`/growth/analysis/${childId}${qs ? `?${qs}` : ''}`);
  },
  update: (childId: string, data: { date?: string; height?: number; weight?: number }) =>
    api.post(`/growth/update/${childId}`, data),
};

// Clinic (소아과 리뷰)
export const clinicApi = {
  search: (lat: number, lng: number, radius?: number, keyword?: string) => {
    const params: Record<string, string> = { lat: String(lat), lng: String(lng) };
    if (radius) params.radius = String(radius);
    if (keyword) params.keyword = keyword;
    return api.get('/clinics/search', { params });
  },
  nearby: (lat: number, lng: number, radius?: number) =>
    api.get(`/clinics/nearby?lat=${lat}&lng=${lng}&radius=${radius || 5}`),
  postReview: (data: Record<string, unknown>) =>
    api.post('/clinics/review', data),
  reviews: (clinicId: string) =>
    api.get(`/clinics/${clinicId}/reviews`),
  myReviews: () =>
    api.get('/clinics/my-reviews'),
};

// Premium (프리미엄 구독)
export const premiumApi = {
  plans: () =>
    api.get('/subscriptions/premium/plans'),
  status: () =>
    api.get('/subscriptions/premium/status'),
  startTrial: () =>
    api.post('/subscriptions/premium/start-trial', {}),
  subscribe: (planId: string, paymentMethod: string) =>
    api.post('/subscriptions/premium/subscribe', { planId, paymentMethod }),
};

// Recommendations (DB캐시 + AI 폴백)
export const recommendationApi = {
  get: (title: string, ageGroup: string, temperament: string, childId: string, category?: string) =>
    api.get('/recommendations', {
      params: { title, ageGroup, temperament, childId, category: category ?? '' },
    }),
  list: (category: string, ageGroup: string, temperament: string) =>
    api.get('/recommendations/list', {
      params: { category, ageGroup, temperament },
    }),
  seed: () =>
    api.post('/recommendations/seed'),
};

// Sleep Prediction (수면 예측)
export const sleepApi = {
  predict: (childId: string) =>
    api.post('/sleep/predict', { childId }),
  history: (childId: string) =>
    api.get('/sleep/history', { params: { childId } }),
  pattern: (months: number) =>
    api.get('/sleep/pattern', { params: { months } }),
};

// Coparenting (공동육아)
export const coparentingApi = {
  invite: (childId: string, role: string, nickname: string, permissions: string[], phone?: string) =>
    api.post('/coparenting/invite', { childId, role, nickname, permissions, phone }),
  accept: (inviteCode: string) =>
    api.post('/coparenting/accept', { inviteCode }),
  members: (childId: string) =>
    api.get(`/coparenting/members/${childId}`),
  updatePermissions: (memberId: string, permissions: string[]) =>
    api.put(`/coparenting/permissions/${memberId}`, { permissions }),
  removeMember: (memberId: string) =>
    api.delete(`/coparenting/members/${memberId}`),
  myPermissions: (childId: string) =>
    api.get(`/coparenting/my-permissions/${childId}`),
  presets: () =>
    api.get('/coparenting/presets'),
};

// Upload (이미지/영상 → Firebase Storage)
export const uploadApi = {
  /**
   * 파일을 Firebase Storage에 업로드하고 공개 URL 반환
   * @param fileUri 로컬 파일 URI (file:///...)
   * @param folder  저장 폴더 (default: "pregnancy")
   * @returns { url, mediaType, storagePath }
   */
  upload: async (fileUri: string, folder = 'pregnancy'): Promise<{ url: string; mediaType: 'photo' | 'video' | 'audio'; storagePath: string }> => {
    const token = useAuthStore.getState().accessToken;
    const filename = fileUri.split('/').pop() || 'file';
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
      mp4: 'video/mp4', mov: 'video/quicktime',
      // 오디오
      m4a: 'audio/mp4', caf: 'audio/x-caf', '3gp': 'audio/3gpp',
      wav: 'audio/wav', aac: 'audio/aac', mp3: 'audio/mpeg',
    };
    const mimeType = mimeMap[ext] || 'image/jpeg';

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
    formData.append('folder', folder);

    const res = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((body as Record<string, string>).error || '업로드 실패');
    }
    const json = await res.json().catch(() => null) as { success?: boolean; data?: { url: string; mediaType: 'photo' | 'video' | 'audio'; storagePath: string }; error?: string } | null;
    if (!json || !json.data) throw new Error(json?.error || '업로드 응답 파싱 실패');
    return json.data;
  },
};

// Album (마일스톤 앨범)
export const albumApi = {
  // ─── 사진 CRUD ───────────────────────────────────────────────
  /** 사진 메타데이터 저장 (thumbUrl + printUrl 포함) */
  save: (data: {
    childId: string;
    uri: string;        // thumbUrl (표시용)
    printUrl?: string;  // 1800px 인쇄용
    milestone?: string;
    milestoneEmoji?: string;
    milestoneColor?: string; // 카테고리 색상 (#RRGGBB) — PDF 배지용
    memo?: string;
    date?: string;
  }) => api.post('/album/photos', data),
  list: (childId: string) => api.get(`/album/photos/${childId}`),
  remove: (id: string) => api.delete(`/album/photos/${id}`),

  // ─── 앨범 PDF 생성 ───────────────────────────────────────────
  /**
   * 앨범 생성 시작 → 즉시 { albumId, status: 'generating' } 반환
   * dateFrom/dateTo: "YYYY-MM" 형식
   */
  generateAlbum: (data: {
    childId: string;
    title?: string;
    dateFrom: string;
    dateTo: string;
  }) => api.post('/album/generate', data),

  /** 생성된 앨범 목록 */
  listAlbums: (childId: string) => api.get(`/album/albums/${childId}`),

  /** 앨범 생성 상태 폴링 (3~5초마다 호출) */
  albumStatus: (albumId: string) => api.get(`/album/albums/${albumId}/status`),

  /** 앨범 삭제 */
  deleteAlbum: (albumId: string) => api.delete(`/album/albums/${albumId}`),
};

// Pregnancy (임신 기록)
export const pregnancyApi = {
  createRecord: (data: {
    childId: string;
    type: 'ultrasound' | 'heartbeat' | 'doctor_note' | 'milestone' | 'memo';
    title?: string;
    content?: string;
    mediaUri?: string;
    mediaType?: 'photo' | 'video';
    milestoneType?: string;
    week?: number;
  }) => api.post('/pregnancy/records', data),
  getRecords: (childId: string) =>
    api.get('/pregnancy/records', { params: { childId } }),
  deleteRecord: (id: string) =>
    api.delete(`/pregnancy/records/${id}`),
  getSymptomPresets: () =>
    api.get('/pregnancy/mom-symptoms/presets'),
  saveMomHealth: (data: {
    childId: string;
    symptoms: string[];
    severity: number;
    memo?: string;
  }) => api.post('/pregnancy/mom-health', data),
  getMomHealth: (childId: string) =>
    api.get('/pregnancy/mom-health', { params: { childId } }),
  getWeeklyDevelopment: (week?: number) =>
    api.get('/pregnancy/weekly-development', { params: week ? { week: String(week) } : {} }),
  getTimeline: (childId: string) =>
    api.get('/pregnancy/timeline', { params: { childId } }),
  // 임당관리 (GDM)
  saveGdm: (data: {
    childId: string;
    glucoseLevel: number;
    mealType: 'fasting' | 'before_meal' | 'after_meal_1h' | 'after_meal_2h' | 'bedtime';
    memo?: string;
    measuredAt?: string;
  }) => api.post('/pregnancy/gdm', data),
  getGdm: (childId: string, days = 30) =>
    api.get('/pregnancy/gdm', { params: { childId, days: String(days) } }),
  deleteGdm: (id: string) =>
    api.delete(`/pregnancy/gdm/${id}`),
  // 임당 식단 기록
  saveFoodLog: (data: {
    childId: string;
    foodName: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    eatenAt?: string;
    carbs?: number;
    calories?: number;
    photoUrl?: string;
    memo?: string;
    linkedGlucoseId?: string;
  }) => api.post('/pregnancy/gdm/food', data),
  getFoodLogs: (childId: string, days = 7) =>
    api.get('/pregnancy/gdm/food', { params: { childId, days: String(days) } }),
  deleteFoodLog: (id: string) =>
    api.delete(`/pregnancy/gdm/food/${id}`),
  analyzeFoodPhoto: (mediaBase64: string, mediaMimeType: string) =>
    api.post('/pregnancy/gdm/food/analyze', { mediaBase64, mediaMimeType }),
  gdmWeeklyReport: (childId: string) =>
    api.post('/pregnancy/gdm/weekly-report', { childId }),
};

// Vaccination (예방접종)
export const vaccinationApi = {
  schedule: (childId: string) =>
    api.get('/vaccination/schedule', { params: { childId } }),
  upcoming: (childId: string, limit = 5) =>
    api.get('/vaccination/upcoming', { params: { childId, limit: String(limit) } }),
  complete: (childId: string, vaccineId: string, completedAt?: string, hospitalName?: string) =>
    api.post('/vaccination/complete', { childId, vaccineId, completedAt, hospitalName }),
  undoComplete: (id: string) =>
    api.delete(`/vaccination/complete/${id}`),
  scheduleAlerts: (childId: string) =>
    api.post('/vaccination/schedule-alerts', { childId }),
};

// Tracker (음성 기록 + 엑셀 가져오기)
export const trackerApi = {
  voiceParse: (text: string) =>
    api.post('/tracker/voice-parse', { text }),
  importExcel: async (fileUri: string) => {
    const token = useAuthStore.getState().accessToken;
    const filename = fileUri.split('/').pop() || 'data.xlsx';
    const ext = filename.split('.').pop()?.toLowerCase() || 'xlsx';
    const mimeMap: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      csv: 'text/csv',
    };
    const mimeType = mimeMap[ext] || mimeMap.xlsx;

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);

    const res = await fetch(`${API_URL}/tracker/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '가져오기 실패');
    return json.data;
  },
};

// SOS Fast Track (긴급 증상 체크)
export const sosApi = {
  checkSymptom: (childId: string, symptoms: string[], temperature?: number) =>
    api.post('/sos/check-symptom', { childId, symptoms, temperature }),
  feverCalculator: (childId: string, temperature?: number) =>
    api.get('/sos/fever-calculator', { params: { childId, temperature: temperature ? String(temperature) : undefined } }),
  notifyFamily: (childId: string, situation: string, temperature?: number) =>
    api.post('/sos/notify-family', { childId, situation, temperature }),
};

export default api;
