import { create } from 'zustand';
import { momstagramApi } from '../services/api';

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
  videoUrl: string | null;
  mediaType: 'image' | 'video' | 'none';
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
  loading: boolean;
  error: string | null;
  fetchFeed: () => Promise<void>;
  loadMoreFeed: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleLike: (postId: string) => void;
  addComment: (postId: string, comment: MomstagramComment) => void;
  addCommentViaApi: (postId: string, content: string) => Promise<void>;
  addPost: (post: MomstagramPost) => void;
  addPrivatePost: (post: MomstagramPost) => void;
  loadPrivatePosts: () => Promise<void>;
  loadMore: () => void;
}

function getAsyncStorage(): typeof import('@react-native-async-storage/async-storage').default | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

async function loadStoredPrivatePosts(): Promise<MomstagramPost[]> {
  try {
    const storage = getAsyncStorage();
    if (!storage) return [];
    const stored = await storage.getItem(PRIVATE_POSTS_KEY);
    if (stored) return JSON.parse(stored) as MomstagramPost[];
  } catch { /* ignore */ }
  return [];
}

async function savePrivatePostsToStorage(posts: MomstagramPost[]): Promise<void> {
  try {
    const storage = getAsyncStorage();
    if (!storage) return;
    await storage.setItem(PRIVATE_POSTS_KEY, JSON.stringify(posts));
  } catch { /* ignore */ }
}

interface ApiFeedPost {
  id: string;
  userName?: string;
  authorName?: string;
  childGender?: string;
  childAge?: string;
  dominantType?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  mediaType?: string;
  content: string;
  likeCount?: number;
  likes?: number;
  liked?: boolean;
  isLiked?: boolean;
  comments?: ApiComment[];
  commentCount?: number;
  createdAt: string;
  category?: string;
  sourceType?: string;
}

interface ApiComment {
  id: string;
  userName?: string;
  authorName?: string;
  content?: string;
  text?: string;
  createdAt: string;
}

function mapApiPostToStore(p: ApiFeedPost): MomstagramPost {
  const hasVideo = !!p.videoUrl || p.mediaType === 'video';
  const hasImage = !!p.imageUrl || !!p.thumbnailUrl;
  return {
    id: p.id,
    userName: p.userName ?? p.authorName ?? '익명',
    childGender: (p.childGender === 'F' ? 'F' : 'M') as 'M' | 'F',
    childAge: p.childAge ?? '',
    dominantType: p.dominantType ?? '',
    imageUri: p.imageUrl ?? p.thumbnailUrl ?? null,
    videoUrl: p.videoUrl ?? null,
    mediaType: hasVideo ? 'video' : hasImage ? 'image' : 'none',
    content: p.content,
    likes: p.likeCount ?? p.likes ?? 0,
    liked: p.liked ?? p.isLiked ?? false,
    comments: (p.comments ?? []).map((c) => ({
      id: c.id,
      userName: c.userName ?? c.authorName ?? '익명',
      text: c.content ?? c.text ?? '',
      createdAt: c.createdAt,
    })),
    createdAt: p.createdAt,
    category: (p.category as PostCategory) ?? undefined,
    isPrivate: false,
  };
}

export const useMomstagramStore = create<MomstagramState>((set, get) => ({
  posts: [],
  privatePosts: [],
  page: 0,
  hasMore: true,
  loading: false,
  error: null,

  fetchFeed: async () => {
    set({ loading: true, error: null });
    try {
      const res = await momstagramApi.getFeed(0, 20);
      const raw = res.data;
      // API returns { success, data: { posts: [...] } }
      const inner = raw?.data ?? raw;
      const feedPosts: ApiFeedPost[] = inner?.posts ?? (Array.isArray(inner) ? inner : []);
      const mapped = feedPosts.map(mapApiPostToStore);

      // 최근 로컬에서 추가된 게시물이 서버 응답에 없으면 보존
      const currentPosts = get().posts;
      const serverIds = new Set(mapped.map((p) => p.id));
      const recentLocal = currentPosts.filter(
        (p) => !serverIds.has(p.id) && Date.now() - new Date(p.createdAt).getTime() < 60000,
      );
      const merged = [...recentLocal, ...mapped];

      set({
        posts: merged,
        page: 0,
        hasMore: mapped.length >= 20,
        loading: false,
        error: null,
      });
    } catch {
      set({ posts: [], loading: false, error: 'feed_error', hasMore: false });
    }
  },

  loadMoreFeed: async () => {
    const state = get();
    if (state.loading || !state.hasMore) return;
    const nextPage = state.page + 1;
    set({ loading: true });
    try {
      const res = await momstagramApi.getFeed(nextPage, 20);
      const raw = res.data;
      const inner = raw?.data ?? raw;
      const feedPosts: ApiFeedPost[] = inner?.posts ?? (Array.isArray(inner) ? inner : []);
      const mapped = feedPosts.map(mapApiPostToStore);
      set((s) => ({
        posts: [...s.posts, ...mapped],
        page: nextPage,
        hasMore: mapped.length >= 20,
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  refresh: async () => {
    await get().fetchFeed();
  },

  toggleLike: (postId) => {
    // Optimistic update
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
    // Fire API call (no await needed for optimistic)
    momstagramApi.toggleLike(postId).catch(() => {
      // Revert on failure
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId
            ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
            : p,
        ),
      }));
    });
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

  addCommentViaApi: async (postId, content) => {
    try {
      const res = await momstagramApi.addComment(postId, content);
      const data = res.data;
      const apiComment = data.data ?? data.comment ?? data;
      const comment: MomstagramComment = {
        id: apiComment?.id ?? Date.now().toString(36),
        userName: apiComment?.userName ?? apiComment?.authorName ?? '나',
        text: apiComment?.content ?? apiComment?.text ?? content,
        createdAt: apiComment?.createdAt ?? new Date().toISOString(),
      };
      get().addComment(postId, comment);
    } catch {
      // Fallback: add locally even if API fails
      const comment: MomstagramComment = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        userName: '나',
        text: content,
        createdAt: new Date().toISOString(),
      };
      get().addComment(postId, comment);
    }
  },

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

  loadPrivatePosts: async () => {
    const stored = await loadStoredPrivatePosts();
    set({ privatePosts: stored });
  },

  // Legacy compat (FlatList onEndReached)
  loadMore: () => {
    get().loadMoreFeed();
  },
}));
