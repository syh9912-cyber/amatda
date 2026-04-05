import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PostCategory = '일상' | '학습' | '여행' | '기념일' | '기타';

export interface MomstagramComment {
  id: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface MomstagramPost {
  id: string;
  userName: string;
  childGender: 'M' | 'F';
  childAge: string;
  dominantType: string;
  imageUri: string | null;
  content: string;
  likes: number;
  liked: boolean;
  comments: MomstagramComment[];
  createdAt: string;
  category?: PostCategory;
  isPrivate?: boolean;
}

const PRIVATE_POSTS_KEY = '@amatda_private_posts';

interface MomstagramState {
  posts: MomstagramPost[];
  privatePosts: MomstagramPost[];
  page: number;
  hasMore: boolean;
  addPost: (post: MomstagramPost) => void;
  addPrivatePost: (post: MomstagramPost) => void;
  toggleLike: (postId: string) => void;
  addComment: (postId: string, comment: MomstagramComment) => void;
  loadMore: () => void;
  refresh: () => void;
  loadPrivatePosts: () => Promise<void>;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createSamplePosts(): MomstagramPost[] {
  const now = Date.now();
  return [
    {
      id: generateId(),
      userName: '하늘맘',
      childGender: 'F',
      childAge: '36개월',
      dominantType: '탐구형',
      imageUri: null,
      content: '오늘 하늘이가 처음으로 나비를 잡으려고 했어요. 한참을 쫓아다니더니 결국 포기하고 꽃 냄새를 맡더라구요. 자연에 대한 호기심이 점점 커지는 것 같아요.',
      likes: 12,
      liked: false,
      comments: [
        { id: generateId(), userName: '별이맘', text: '너무 귀여워요!', createdAt: new Date(now - 3600000).toISOString() },
      ],
      createdAt: new Date(now - 7200000).toISOString(),
      category: '일상',
    },
    {
      id: generateId(),
      userName: '도윤아빠',
      childGender: 'M',
      childAge: '48개월',
      dominantType: '활동형',
      imageUri: null,
      content: '도윤이 오늘 자전거 보조바퀴 떼고 처음 혼자 탔습니다! 넘어져도 울지 않고 다시 올라타는 모습이 대견해요.',
      likes: 24,
      liked: false,
      comments: [
        { id: generateId(), userName: '서준맘', text: '대단해요! 우리 서준이도 곧 도전해볼까 해요', createdAt: new Date(now - 1800000).toISOString() },
        { id: generateId(), userName: '하늘맘', text: '멋져요 도윤이!', createdAt: new Date(now - 900000).toISOString() },
      ],
      createdAt: new Date(now - 14400000).toISOString(),
      category: '일상',
    },
    {
      id: generateId(),
      userName: '서준맘',
      childGender: 'M',
      childAge: '60개월',
      dominantType: '사교형',
      imageUri: null,
      content: '어린이집에서 서준이가 새로 온 친구한테 먼저 다가가서 "같이 놀자"라고 했대요. 선생님이 칭찬해주셨어요. 사교성이 좋은 아이라 다행이에요.',
      likes: 18,
      liked: false,
      comments: [],
      createdAt: new Date(now - 28800000).toISOString(),
      category: '학습',
    },
    {
      id: generateId(),
      userName: '지안맘',
      childGender: 'F',
      childAge: '84개월',
      dominantType: '창의형',
      imageUri: null,
      content: '지안이가 그린 그림이 학교 미술대회에서 상을 받았어요! 평소에 색감이 독특하다고 생각했는데 인정받으니 기쁘네요.',
      likes: 32,
      liked: false,
      comments: [
        { id: generateId(), userName: '도윤아빠', text: '축하합니다! 지안이 정말 재능이 있나봐요', createdAt: new Date(now - 43200000).toISOString() },
      ],
      createdAt: new Date(now - 86400000).toISOString(),
      category: '기념일',
    },
  ];
}

async function loadStoredPrivatePosts(): Promise<MomstagramPost[]> {
  try {
    const stored = await AsyncStorage.getItem(PRIVATE_POSTS_KEY);
    if (stored) return JSON.parse(stored) as MomstagramPost[];
  } catch { /* ignore */ }
  return [];
}

async function savePrivatePostsToStorage(posts: MomstagramPost[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PRIVATE_POSTS_KEY, JSON.stringify(posts));
  } catch { /* ignore */ }
}

export const useMomstagramStore = create<MomstagramState>((set, get) => ({
  posts: createSamplePosts(),
  privatePosts: [],
  page: 1,
  hasMore: true,

  addPost: (post) => {
    set((state) => ({ posts: [post, ...state.posts] }));
  },

  addPrivatePost: (post) => {
    const privatePost = { ...post, isPrivate: true };
    set((state) => {
      const updated = [privatePost, ...state.privatePosts];
      savePrivatePostsToStorage(updated);
      return { privatePosts: updated };
    });
  },

  toggleLike: (postId) => {
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p,
      ),
      privatePosts: state.privatePosts.map((p) =>
        p.id === postId
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p,
      ),
    }));
  },

  addComment: (postId, comment) => {
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId
          ? { ...p, comments: [...p.comments, comment] }
          : p,
      ),
      privatePosts: state.privatePosts.map((p) =>
        p.id === postId
          ? { ...p, comments: [...p.comments, comment] }
          : p,
      ),
    }));
  },

  loadMore: () => {
    const state = get();
    if (state.page >= 3) {
      set({ hasMore: false });
      return;
    }
    set({ page: state.page + 1 });
  },

  refresh: () => {
    set({ posts: createSamplePosts(), page: 1, hasMore: true });
  },

  loadPrivatePosts: async () => {
    const stored = await loadStoredPrivatePosts();
    set({ privatePosts: stored });
  },
}));
