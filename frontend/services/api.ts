import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// 토큰 자동 주입
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 시 토큰 갱신 시도
api.interceptors.response.use(
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
          return api(original);
        } catch {
          useAuthStore.getState().logout();
        }
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  socialLogin: (provider: string, accessToken: string) =>
    api.post('/auth/social', { provider, accessToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  deleteAccount: () =>
    api.delete('/auth/account'),
};

// Children
export const childApi = {
  list: () => api.get('/children'),
  get: (id: string) => api.get(`/children/${id}`),
  create: (data: { name: string; gender: string; birthDate: string; birthTime: string }) =>
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
    sourceType: 'album' | 'diary' | 'manual';
    childAge?: string;
    childGender?: string;
    dominantType?: string;
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

// Coaching (AI 육아 코칭)
export const coachingApi = {
  ask: (childId: string, message: string, category?: string, photoUrl?: string) =>
    api.post('/coaching/ask', { childId, message, category, photoUrl }),
  send: (childId: string, message: string, category?: string) =>
    api.post('/coaching/ask', { childId, message, category }),
  history: (childId: string) =>
    api.get(`/coaching/history/${childId}`),
  checkin: (childId: string, mood: string) =>
    api.post('/coaching/ask', { childId, message: `오늘 아이 컨디션: ${mood}`, category: '체크인' }),
  followups: (childId: string) =>
    api.get(`/coaching/followups/${childId}`),
  dismissFollowup: (followupId: string) =>
    api.post(`/coaching/followup/${followupId}/respond`, { answer: '나중에' }),
  respondFollowup: (followupId: string, response: string) =>
    api.post(`/coaching/followup/${followupId}/respond`, { answer: response }),
  weeklyReport: (childId: string) =>
    api.post('/coaching/weekly-report', { childId }),
  dailyDiary: (childId: string) =>
    api.post('/coaching/daily-diary', { childId }),
  analyzeMedia: (childId: string, type: 'cry' | 'poop', description: string) =>
    api.post('/coaching/analyze-media', { childId, type, description }),
  firstTalk: (childId: string) =>
    api.post('/coaching/first-talk', { childId }),
  parentMental: (childId: string) =>
    api.post('/coaching/parent-mental', { childId }),
  futurePredict: (childId: string) =>
    api.post('/coaching/future-predict', { childId }),
  nowActivity: (childId: string) =>
    api.post('/coaching/now-activity', { childId }),
  milestones: (childId: string) =>
    api.get(`/coaching/milestones/${childId}`),
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

// Clinic (소아과 리뷰)
export const clinicApi = {
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

export default api;
