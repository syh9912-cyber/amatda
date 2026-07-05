import axios, { type AxiosInstance } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { checkOtaOnApiError } from './otaCheck';

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

// ─── Refresh 뮤텍스 ─────────────────────────────────────────
// 동시 401 → 동시 refresh 시도 → 토큰 재사용 감지(reuse detection) → 패밀리 전체 revoke 방지.
// 첫 번째 요청만 refresh 실행, 나머지는 같은 Promise를 대기(같은 새 토큰 사용).
let _refreshPromise: Promise<string> | null = null;

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
            // 뮤텍스: 이미 refresh 중이면 같은 Promise 대기 → 토큰 재사용 방지
            if (!_refreshPromise) {
              _refreshPromise = (async () => {
                try {
                  const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
                  const { accessToken, refreshToken: newRefresh } = res.data.data;
                  await useAuthStore.getState().setTokens(accessToken, newRefresh);
                  return accessToken as string;
                } finally {
                  _refreshPromise = null;
                }
              })();
            }
            const newAccessToken = await _refreshPromise;
            original.headers.Authorization = `Bearer ${newAccessToken}`;
            return instance(original);
          } catch {
            _refreshPromise = null;
            useAuthStore.getState().logout(); // 레이아웃이 로그인 화면으로 보냄
          }
        } else {
          useAuthStore.getState().logout();
        }
      }

      // 구버전 앱이 새 서버와 불일치하는 징후(404/400/405/네트워크 오류) 시 OTA 체크
      const status = err.response?.status;
      const shouldCheckOta =
        !err.response ||
        status === 404 ||
        status === 400 ||
        status === 405 ||
        (typeof status === 'number' && status >= 500);
      if (shouldCheckOta) {
        checkOtaOnApiError();
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
  register: (
    email: string,
    password: string,
    parentRole?: string,
    consent?: {
      terms: boolean;
      privacy: boolean;
      community: boolean;
      ageOver14: boolean;
      marketing: boolean;
      marketingDataUse: boolean;
      nightAd: boolean;
      version: string;
    },
  ) =>
    api.post('/auth/register', { email, password, parentRole, consent }),
  socialLogin: (provider: string, accessToken: string) =>
    api.post('/auth/social', { provider, accessToken }),
  socialLoginWithCode: (provider: string, code: string, redirectUri: string) =>
    api.post('/auth/social-code', { provider, code, redirectUri }),
  // 약관 동의 저장 (소셜 가입 신규 사용자 전용 — PIPA 15·22조, 정보통신망법 50조)
  saveConsent: (consent: {
    terms: boolean;
    privacy: boolean;
    community: boolean;
    ageOver14: boolean;
    marketing: boolean;
    marketingDataUse: boolean;
    nightAd: boolean;
    version: string;
  }) => api.put('/auth/consent', consent),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  setPassword: (newPassword: string) =>
    api.post('/auth/set-password', { newPassword }),
  getProfile: () =>
    api.get('/auth/me'),
  deleteAccount: () =>
    api.delete('/auth/account'),
  // 서버측 refresh token 패밀리 무효화 (#5 보안). best-effort — 실패해도 로컬 logout 진행.
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
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
  analyze: (id: string, answers: { questionId: string; answer: number }[], locale?: string) =>
    api.post(`/children/${id}/analyze`, { answers, locale }),
  // 예측 알람 설정 (수유/수면/기상)
  getAlarmSettings: (id: string) => api.get(`/children/${id}/alarm-settings`),
  updateAlarmSettings: (id: string, data: Record<string, unknown>) =>
    api.put(`/children/${id}/alarm-settings`, data),
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
  birth: (childId: string, data: { birthDate: string; birthTime: string; name?: string; gender?: string; height?: number; weight?: number; locale?: string }) =>
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

// Observations
export const observationApi = {
  create: (childId: string, content: string, type = 'TEXT') =>
    api.post('/observations', { childId, content, type }),
  list: (childId: string) =>
    api.get(`/observations/${childId}`),
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
    /** 임신/성장앨범 record id — record 삭제 시 cascade 정리에 사용 */
    linkedAlbumId?: string;
  }) => api.post('/momstagram/posts', data),
  toggleLike: (postId: string) =>
    api.post(`/momstagram/posts/${postId}/like`),
  getComments: (postId: string, page = 0, limit = 20) =>
    api.get(`/momstagram/posts/${postId}/comments`, { params: { page: String(page), limit: String(limit) } }),
  addComment: (postId: string, content: string) =>
    api.post(`/momstagram/posts/${postId}/comments`, { content }),
  deletePost: (postId: string) =>
    api.delete(`/momstagram/posts/${postId}`),
  updatePost: (
    postId: string,
    data: { content?: string; category?: string; imageUrl?: string | null },
  ) => api.patch(`/momstagram/posts/${postId}`, data),
  getMyPosts: (page = 0, limit = 20) =>
    api.get('/momstagram/my-posts', { params: { page: String(page), limit: String(limit) } }),
  // UGC 모더레이션 (Apple 1.2 / Google UGC 정책)
  reportPost: (postId: string, reason: 'abuse' | 'ad' | 'privacy' | 'spam' | 'sexual' | 'other') =>
    api.post(`/momstagram/posts/${postId}/report`, { reason }),
  blockUser: (userId: string) =>
    api.post(`/momstagram/users/${userId}/block`),
  unblockUser: (userId: string) =>
    api.delete(`/momstagram/users/${userId}/block`),
  getBlockedUsers: () =>
    api.get('/momstagram/users/blocked'),
};

// Memories
export const memoriesApi = {
  yearAgo: (childId: string) =>
    api.get(`/memories/year-ago/${childId}`),
  childCard: (childId: string) =>
    api.get(`/memories/child-card/${childId}`),
};

// Coaching (상담이모) — coachingAxios 사용 (별도 Cloud Run 인스턴스)
// 코칭 API가 느려져도 auth/children/food 등 경량 API는 무영향
export const coachingApi = {
  send: (childId: string, message: string, category?: string, locale?: string) =>
    coachingAxios.post('coaching/ask', { childId, message, category, locale }),
  history: (childId: string) =>
    coachingAxios.get(`coaching/history/${childId}`),
  followups: (childId: string) =>
    coachingAxios.get(`coaching/followups/${childId}`),
  dismissFollowup: (followupId: string, locale?: string) =>
    coachingAxios.post(`coaching/followup/${followupId}/respond`, { answer: '나중에', locale }),
  respondFollowup: (followupId: string, response: string, locale?: string) =>
    coachingAxios.post(`coaching/followup/${followupId}/respond`, { answer: response, locale }),
  dailyDiary: (childId: string, locale?: string) =>
    coachingAxios.post('coaching/daily-diary', { childId, locale }),
  analyzeMedia: (childId: string, type: 'cry' | 'poop', description?: string, mediaBase64?: string, mediaMimeType?: string, locale?: string) =>
    coachingAxios.post('coaching/analyze-media', { childId, type, description, mediaBase64, mediaMimeType, locale }),
  firstTalk: (childId: string, locale?: string) =>
    coachingAxios.post('coaching/first-talk', { childId, locale }),
  milestones: (childId: string) =>
    coachingAxios.get(`coaching/milestones/${childId}`),
  saveMilestoneChecks: (childId: string, checks: Record<string, boolean>) =>
    coachingAxios.post(`coaching/milestones/${childId}/check`, { checks }),
};

// Retention (FCM 푸시 스케줄 등록만 유지 — 다른 라우트는 parent-level 시스템과 함께 정리됨)
export const retentionApi = {
  pushSchedule: (data: Record<string, unknown>) =>
    api.post('/retention/push-schedule', data),
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
};

// ─── 결제 (Phase 1 백엔드) ───
// IAP(Google/Apple) + PortOne 외부결제 모두 처리
export const paymentApi = {
  /** PortOne 1회성 결제 검증 — 사용자가 결제창에서 결제 완료 후 paymentId 전달 */
  verifyPortOne: (paymentId: string, productId: string) =>
    api.post('/payment/portone/verify', { paymentId, productId }),

  /** PortOne 빌링키 등록 + 첫 결제 (자동결제 시작) */
  registerBillingKey: (billingKey: string, productId: string, channelKey?: string) =>
    api.post('/payment/portone/billing-key', { billingKey, productId, channelKey }),

  /** Google/Apple 인앱결제 영수증 검증 */
  verifyIAP: (params: {
    platform: 'google' | 'apple';
    productId: string;
    purchaseToken?: string;          // Google
    originalTransactionId?: string;  // Apple
  }) => api.post('/payment/iap/verify', params),

  /** 자동결제 해지 (PortOne 빌링키 삭제) */
  cancel: () => api.post('/payment/cancel', {}),

  /** 내 결제 내역 */
  history: () => api.get('/payment/history'),

  /** 결제 시스템 가용 상태 (디버그용) */
  status: () => api.get('/payment/status'),
};

// Recommendations (DB캐시 + AI 폴백)
export const recommendationApi = {
  get: (title: string, ageGroup: string, temperament: string, childId: string, category?: string, locale?: string) =>
    api.get('/recommendations', {
      params: { title, ageGroup, temperament, childId, category: category ?? '', ...(locale ? { locale } : {}) },
    }),
  list: (category: string, ageGroup: string, temperament: string, locale?: string) =>
    api.get('/recommendations/list', {
      params: { category, ageGroup, temperament, ...(locale ? { locale } : {}) },
    }),
};

// Coparenting (가족육아)
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

// 앱 시작 공지 팝업
export const announcementApi = {
  /** 현재 노출할 공지 1건 (없으면 data: null) */
  active: () => api.get('/announcement/active'),
};

// Upload (이미지/영상 → Firebase Storage)
export const uploadApi = {
  /**
   * 파일을 Firebase Storage에 업로드하고 공개 URL 반환
   * @param fileUri 로컬 파일 URI (file:///...)
   * @param folder  저장 폴더 (default: "pregnancy")
   * @returns { url, mediaType, storagePath }
   *
   * ⚠️ 프라이버시: 이미지는 ImageManipulator로 재인코딩 → EXIF(위치/디바이스/촬영시각) 자동 제거.
   *               비디오/오디오는 변환 없이 원본 업로드 (EXIF 없음).
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
    const isImage = mimeType.startsWith('image/');

    // 이미지면 리사이즈(1280px) + 압축(85%) + EXIF 제거 한 번에 처리.
    //   - 폰 카메라 원본(보통 4–8MB) → 약 200–400KB 로 감소 (속도 5–20× 빠름)
    //   - Storage 비용 95% 절감 (월 17,000장+ 무료 한도 가능)
    //   - EXIF (위치/디바이스/촬영시각) 자동 제거
    let uploadUri = fileUri;
    let uploadFilename = filename;
    let uploadMimeType = mimeType;
    if (isImage) {
      try {
        const ImageManipulator = await import('expo-image-manipulator');
        const result = await ImageManipulator.manipulateAsync(
          fileUri,
          [{ resize: { width: 1280 } }], // 비율 유지하며 가로 1280px 로 다운샘플
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );
        uploadUri = result.uri;
        uploadFilename = filename.replace(/\.[^.]+$/, '.jpg');
        uploadMimeType = 'image/jpeg';
      } catch (e) {
        // 재인코딩 실패 시 원본 업로드 (예: HEIC 디코딩 미지원 디바이스)
        console.warn('[uploadApi] resize/compress failed, using original:', e);
      }
    }

    // 전송: 일시적 네트워크/5xx 실패에 지수 백오프 재시도 (모바일 플레이키 네트워크 대응).
    // FormData 는 시도마다 새로 구성 (RN 에서 body 재사용 안전성 확보).
    const buildBody = (): FormData => {
      const fd = new FormData();
      fd.append('file', {
        uri: uploadUri,
        name: uploadFilename,
        type: uploadMimeType,
      } as unknown as Blob);
      fd.append('folder', folder);
      return fd;
    };
    const UPLOAD_ATTEMPTS = 3;
    let res: Awaited<ReturnType<typeof fetch>> | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < UPLOAD_ATTEMPTS; attempt++) {
      try {
        res = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: buildBody(),
        });
        // 5xx(일시적 서버 오류)는 재시도, 4xx(인증/검증 실패)는 즉시 중단(재시도 무의미)
        if (res.status >= 500 && attempt < UPLOAD_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        break;
      } catch (e) {
        lastErr = e; // 네트워크 예외 → 백오프 후 재시도
        if (attempt < UPLOAD_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    if (!res) throw lastErr instanceof Error ? lastErr : new Error('업로드 실패');

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
  update: (id: string, data: { memo?: string; milestone?: string; milestoneEmoji?: string; uri?: string; printUrl?: string }) =>
    api.patch(`/album/photos/${id}`, data),

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
    milestoneEmoji?: string;
    week?: number;
    shareToFamily?: boolean;
  }) => api.post('/pregnancy/records', data),
  getRecords: (childId: string) =>
    api.get('/pregnancy/records', { params: { childId } }),
  deleteRecord: (id: string) =>
    api.delete(`/pregnancy/records/${id}`),
  updateRecord: (id: string, data: { title?: string; content?: string; milestoneEmoji?: string; uri?: string }) =>
    api.patch(`/pregnancy/records/${id}`, data),
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
  analyzeFoodPhoto: (mediaBase64: string, mediaMimeType: string, locale?: string) =>
    api.post('/pregnancy/gdm/food/analyze', { mediaBase64, mediaMimeType, locale }),
  gdmWeeklyReport: (childId: string, locale?: string) =>
    api.post('/pregnancy/gdm/weekly-report', { childId, locale }),
  saveKickSession: (data: { childId: string; count: number; durationSec: number; week?: number }) =>
    api.post('/pregnancy/kick-session', data),
  getKickSessions: (childId: string) =>
    api.get('/pregnancy/kick-session', { params: { childId } }),
  deleteKickSession: (id: string) =>
    api.delete(`/pregnancy/kick-session/${id}`),
  deleteMomHealth: (id: string) =>
    api.delete(`/pregnancy/mom-health/${id}`),

  // 데일리 미션 (물/영양제)
  getDailyMission: (childId: string) =>
    api.get('/pregnancy/daily-mission/today', { params: { childId } }),
  addWater: (childId: string, delta = 1) =>
    api.post('/pregnancy/daily-mission/water', { childId, delta }),
  toggleSupplements: (childId: string, value?: boolean) =>
    api.post('/pregnancy/daily-mission/supplements', { childId, value }),
  weeklySummary: (childId: string) =>
    api.post('/pregnancy/weekly-summary', { childId }),
  safetyCheck: (query: string, week?: number) =>
    api.post('/pregnancy/safety-check', { query, week }),
  mentalCheckQuestions: (stage?: string, locale?: string) =>
    api.get('/pregnancy/mental-check/questions', { params: { ...(stage ? { stage } : {}), ...(locale ? { locale } : {}) } }),
  saveMentalCheck: (data: {
    childId: string;
    answers: number[];
    shareWithPartner: boolean;
    extraAnswers?: number[];
    stage?: string;
    locale?: string;
  }) =>
    api.post('/pregnancy/mental-check', data),
  getMentalChecks: (childId: string) =>
    api.get('/pregnancy/mental-check', { params: { childId } }),
  mentalCheckAnalysis: (childId: string, locale?: string) =>
    api.get('/pregnancy/mental-check/analysis', { params: { childId, ...(locale ? { locale } : {}) } }),
};

// Mom Group (예정월별 출산맘방)
export type MomGroupCategory = 'question' | 'chat' | 'info' | 'worry' | 'celebration';
export type MomGroupSort = 'recent' | 'popular';

export const momGroupApi = {
  listPosts: (
    groupKey: string,
    opts?: {
      category?: MomGroupCategory;
      sort?: MomGroupSort;
      page?: number;
      pageSize?: number;
      q?: string;
      qField?: 'all' | 'title' | 'content' | 'nickname';
      mine?: boolean;
    },
  ) =>
    api.get('/mom-group/posts', {
      params: {
        ...(opts?.mine ? {} : { groupKey }),
        ...(opts?.category ? { category: opts.category } : {}),
        ...(opts?.sort ? { sort: opts.sort } : {}),
        ...(opts?.page !== undefined ? { page: opts.page } : {}),
        ...(opts?.pageSize !== undefined ? { pageSize: opts.pageSize } : {}),
        ...(opts?.q ? { q: opts.q } : {}),
        ...(opts?.qField && opts.qField !== 'all' ? { qField: opts.qField } : {}),
        ...(opts?.mine ? { mine: 'true' } : {}),
      },
    }),
  createPost: (
    groupKey: string,
    title: string,
    content: string,
    category: MomGroupCategory,
    anonymous: boolean,
    imageUrl?: string | null,
    isPinned?: boolean,
  ) =>
    api.post('/mom-group/posts', {
      groupKey, title, content, category, anonymous,
      imageUrl: imageUrl ?? undefined,
      ...(isPinned ? { isPinned: true } : {}),
    }),
  updatePost: (
    id: string,
    data: { title?: string; content?: string; category?: MomGroupCategory; imageUrl?: string | null; isPinned?: boolean },
  ) => api.put(`/mom-group/posts/${id}`, data),
  deletePost: (id: string) =>
    api.delete(`/mom-group/posts/${id}`),
  toggleLike: (id: string) =>
    api.post(`/mom-group/posts/${id}/like`),
  listComments: (postId: string) =>
    api.get(`/mom-group/posts/${postId}/comments`),
  createComment: (postId: string, content: string, anonymous = false) =>
    api.post(`/mom-group/posts/${postId}/comments`, { content, anonymous }),
  deleteComment: (id: string) =>
    api.delete(`/mom-group/comments/${id}`),
  reportPost: (id: string, reason: 'abuse' | 'ad' | 'privacy' | 'spam' | 'other' = 'other') =>
    api.post(`/mom-group/posts/${id}/report`, { reason }),
  // UGC 정책(Apple 1.2) — 사용자 차단. postId 함께 보내면 해당 글 자동 신고(개발자 통지).
  blockUser: (userId: string, postId?: string) =>
    api.post(`/mom-group/users/${userId}/block`, postId ? { postId } : {}),
  unblockUser: (userId: string) =>
    api.delete(`/mom-group/users/${userId}/block`),
  getBlockedUsers: () =>
    api.get('/mom-group/users/blocked'),
  toggleBookmark: (id: string) =>
    api.post(`/mom-group/posts/${id}/bookmark`),
  listBookmarks: () =>
    api.get('/mom-group/bookmarks'),
  /** 각 반경(5/10/50/100km/전국) 활동 글 카운트. birthYears 는 동갑(±N) 매칭용 */
  radiusCounts: (birthYears?: number[]) =>
    api.get('/mom-group/posts/radius/counts', {
      params: birthYears && birthYears.length > 0 ? { birthYears: birthYears.join(',') } : {},
    }),
  /** 일회용: 옛 region: 글 모두 삭제 (테스트 데이터 정리용) */
  adminDeleteRegionPosts: (dryRun = false) =>
    api.post('/mom-group/admin/delete-region-posts', { dryRun }),
  /** 반경 기반 검색 (radius=0 → 전국). birthYears는 동갑(±N) 매칭용 배열 */
  listPostsByRadius: (opts: {
    radius: 0 | 5 | 10 | 50 | 100;
    birthYears?: number[];
    category?: MomGroupCategory;
    sort?: MomGroupSort;
    page?: number;
    pageSize?: number;
    q?: string;
  }) =>
    api.get('/mom-group/posts/radius', {
      params: {
        radius: opts.radius,
        ...(opts.birthYears && opts.birthYears.length > 0 ? { birthYears: opts.birthYears.join(',') } : {}),
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.sort ? { sort: opts.sort } : {}),
        ...(opts.page !== undefined ? { page: opts.page } : {}),
        ...(opts.pageSize !== undefined ? { pageSize: opts.pageSize } : {}),
        ...(opts.q ? { q: opts.q } : {}),
      },
    }),
};

// Mom Location (위치 등록 — 반경 매칭용)
export const momLocationApi = {
  get: () => api.get('/mom-location'),
  put: (data: { lat: number; lng: number; locationLabel?: string; babyBirthYear?: number }) =>
    api.put('/mom-location', data),
  remove: () => api.delete('/mom-location'),
};

// 출산가방 공유 — 카카오톡/링크/문자로 가족 공유
export const birthBagShareApi = {
  create: (payload: {
    ownerLabel?: string;
    birthType?: 'natural' | 'csection';
    postpartumPlan?: 'sanhujowon' | 'home';
    lang?: string; // 'ko' | 'ja' | 'zh-Hant' — 공유 웹페이지 렌더 언어
    items: Array<{
      id: string;
      label: string;
      hint?: string;
      category: 'mom' | 'baby' | 'docs';
      owner?: 'mom' | 'dad' | 'both' | null;
      status?: 'need' | 'ready' | 'packed' | 'na' | null;
      checked?: boolean;
    }>;
  }) => api.post('/birthbag-share', payload),
};

// Vaccination (예방접종)
export const vaccinationApi = {
  schedule: (childId: string) =>
    api.get('/vaccination/schedule', { params: { childId } }),
  complete: (childId: string, vaccineId: string, completedAt?: string, hospitalName?: string) =>
    api.post('/vaccination/complete', { childId, vaccineId, completedAt, hospitalName }),
  undoComplete: (id: string) =>
    api.delete(`/vaccination/complete/${id}`),
  scheduleAlerts: (childId: string) =>
    api.post('/vaccination/schedule-alerts', { childId }),
};

// Tracker (음성 기록 + 엑셀 가져오기)
/**
 * Baby-tracker 서버 sync API (2026-05-08).
 * AsyncStorage 만 쓰던 기존 구조에서 server-as-source-of-truth + 로컬 캐시 패턴으로 전환.
 */
export const babyTrackerApi = {
  // 단일 날짜 records 조회
  getDay: (childId: string, date: string) =>
    api.get(`/baby-tracker/${childId}/days/${date}`),
  // 범위 조회 — 마운트 시 최근 N일 일괄 fetch
  getDaysRange: (childId: string, from: string, to: string) =>
    api.get(`/baby-tracker/${childId}/days`, { params: { from, to } }),
  // 단일 날짜 records 덮어쓰기 (last-write-wins)
  putDay: (childId: string, date: string, records: unknown[]) =>
    api.put(`/baby-tracker/${childId}/days/${date}`, { records }),
  // 진행 중 sleep/breast 세션 조회 + 저장
  getSessions: (childId: string) =>
    api.get(`/baby-tracker/${childId}/sessions`),
  putSessions: (
    childId: string,
    body: { sleepSession?: unknown; breastSession?: unknown },
  ) => api.put(`/baby-tracker/${childId}/sessions`, body),
};

export const trackerApi = {
  voiceParse: (text: string, locale?: string) => {
    // 서버(UTC) 시각 오류 방지 — 클라이언트 로컬 시각 + 날짜 전송
    // 날짜는 '어제/오늘/그저께' 상대 표현 정확 해석에 필수
    const now = new Date();
    const clientTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const clientDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return api.post('/tracker/voice-parse', { text, clientTime, clientDate, locale });
  },
  // 어린이집 알림장/기록지 사진 → 기록 추출 (Gemini 비전)
  photoParse: (imageBase64: string, mimeType?: string, locale?: string) => {
    const now = new Date();
    const clientTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const clientDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return api.post('/tracker/photo-parse', { imageBase64, mimeType, clientTime, clientDate, locale });
  },
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
