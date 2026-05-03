import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Switch,
  ActionSheetIOS,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { momGroupApi, momLocationApi, uploadApi, type MomGroupCategory, type MomGroupSort } from '../../services/api';
import { AdSlot } from '../../components/ads/AdSlot';
import { pickImageFromLibrary } from '../../utils/imagePicker';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const IC_HEART = require('../../assets/icon-heart.png');
const IC_COMMENT = require('../../assets/icon-comment.png');
const IC_CAMERA = require('../../assets/icon-camera.png');
const IC_BOOKMARK = require('../../assets/icon-bell.png'); // no dedicated bookmark icon yet

interface Post {
  id: string;
  groupKey: string;
  userId: string;
  nickname: string;
  category: MomGroupCategory;
  anonymous: boolean;
  title: string;
  content: string;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  isMine: boolean;
  isOfficial?: boolean;
  isFallback?: boolean;
}

const REPORT_REASON_OPTIONS: { key: 'abuse' | 'ad' | 'privacy' | 'spam' | 'other'; label: string }[] = [
  { key: 'abuse', label: '욕설·비방' },
  { key: 'ad', label: '광고·홍보' },
  { key: 'privacy', label: '개인정보 노출' },
  { key: 'spam', label: '도배·스팸' },
  { key: 'other', label: '기타' },
];

interface Comment {
  id: string;
  postId: string;
  nickname: string;
  anonymous: boolean;
  content: string;
  createdAt: string;
  isMine: boolean;
  isOfficial?: boolean;
}

const CATEGORY_META: Record<MomGroupCategory, { label: string; emoji: string; color: string; bg: string }> = {
  question: { label: '질문', emoji: '❓', color: '#1565C0', bg: '#E3F2FD' },
  chat: { label: '수다', emoji: '💬', color: '#AD1457', bg: '#FCE4EC' },
  info: { label: '정보', emoji: '📚', color: '#2E7D32', bg: '#E8F5E9' },
  worry: { label: '고민', emoji: '😔', color: '#E65100', bg: '#FFF3E0' },
  celebration: { label: '축하', emoji: '🎉', color: '#6A1B9A', bg: '#F3E5F5' },
};
const CATEGORY_KEYS: MomGroupCategory[] = ['question', 'chat', 'info', 'worry', 'celebration'];

const PAGE_SIZE = 20;

function deriveGroupKey(isoDate?: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatGroupLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${y}년 ${parseInt(m, 10)}월 맘스톡`;
}

function shiftGroupKey(key: string, deltaMonths: number): string {
  const [yStr, mStr] = key.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const total = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map((v) => parseInt(v, 10));
  const [by, bm] = b.split('-').map((v) => parseInt(v, 10));
  return (ay - by) * 12 + (am - bm);
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

// 클래식 게시판용 짧은 날짜 (오늘이면 HH:MM, 아니면 MM/DD, 작년이면 YY.MM.DD)
function compactDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (d.getFullYear() !== now.getFullYear()) {
    return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_WINDOW = 3; // 내 예정월 ±3개월까지 이동 허용

type RoomType = 'month' | 'region' | 'radius';
type ViewMode = 'feed' | 'bookmarks' | 'mine';

type RadiusKey = 5 | 10 | 50 | 100 | 0; // 0 = 전국
const RADIUS_TABS: { key: RadiusKey; label: string; sub: string }[] = [
  { key: 5,   label: '5km',  sub: '바로 옆' },
  { key: 10,  label: '10km', sub: '우리 동네' },
  { key: 50,  label: '50km', sub: '우리 도시' },
  { key: 100, label: '100km', sub: '근교' },
  { key: 0,   label: '전국', sub: '나이별' },
];

const REGIONS: { key: string; label: string }[] = [
  { key: 'seoul', label: '서울' }, { key: 'busan', label: '부산' },
  { key: 'daegu', label: '대구' }, { key: 'incheon', label: '인천' },
  { key: 'gwangju', label: '광주' }, { key: 'daejeon', label: '대전' },
  { key: 'ulsan', label: '울산' }, { key: 'sejong', label: '세종' },
  { key: 'gyeonggi', label: '경기' }, { key: 'gangwon', label: '강원' },
  { key: 'chungbuk', label: '충북' }, { key: 'chungnam', label: '충남' },
  { key: 'jeonbuk', label: '전북' }, { key: 'jeonnam', label: '전남' },
  { key: 'gyeongbuk', label: '경북' }, { key: 'gyeongnam', label: '경남' },
  { key: 'jeju', label: '제주' },
];

function roomLabel(roomType: RoomType, groupKey: string, radiusKey?: number, ageRange?: number): string {
  if (roomType === 'month') return formatGroupLabel(groupKey);
  if (roomType === 'radius') {
    const meta = RADIUS_TABS.find((r) => r.key === (radiusKey ?? 10));
    const ageLabel = ageRange === 0 ? '동갑' : ageRange ? `±${ageRange}살` : '';
    return `내 동네 · ${meta?.label ?? ''}${ageLabel ? ` · ${ageLabel}` : ''}`;
  }
  const r = REGIONS.find((x) => `region:${x.key}` === groupKey);
  return `${r?.label ?? ''} 지역방`;
}

function writePlaceholder(roomType: RoomType): string {
  if (roomType === 'radius') return '내 동네 맘들과 나누고 싶은 이야기를 적어주세요...';
  if (roomType === 'month') return '같은 달 출산 맘들과 나누고 싶은 이야기를 적어주세요...';
  return '같은 지역 맘들과 나누고 싶은 이야기를 적어주세요...';
}

function displayTitle(p: Post): string {
  if (p.title) return p.title;
  // legacy fallback: derive from content
  const trimmed = p.content.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '(내용 없음)';
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 40) + '…';
}

export default function MomGroupScreen() {
  const insets = useSafeAreaInsets();
  const { selectedChild } = useChildStore();
  const myGroupKey = deriveGroupKey(selectedChild?.dueDate ?? selectedChild?.birthDate);

  const [roomType, setRoomType] = useState<RoomType>('month');
  const [groupKey, setGroupKey] = useState<string | null>(myGroupKey);
  // radius 모드 선택값 (기본 우리 동네 10km, 동갑 매칭 기본)
  const [radiusKey, setRadiusKey] = useState<RadiusKey>(10);
  const [ageRange, setAgeRange] = useState<0 | 1 | 2>(0); // ±N 살
  const [hasLocation, setHasLocation] = useState<boolean | null>(null); // null=미체크
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [radiusCounts, setRadiusCounts] = useState<Record<string, number>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<MomGroupCategory | null>(null);
  const [sortMode, setSortMode] = useState<MomGroupSort>('recent');

  // 검색 / 페이지네이션
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'title' | 'content' | 'nickname'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 글쓰기 / 수정
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeCategory, setWriteCategory] = useState<MomGroupCategory>('chat');
  const [writeAnonymous, setWriteAnonymous] = useState(false);
  const [writing, setWriting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const [activePost, setActivePost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkPosts, setBookmarkPosts] = useState<Post[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [minePosts, setMinePosts] = useState<Post[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [postImage, setPostImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canGoPrev = useMemo(
    () => roomType === 'month' && !!groupKey && !!myGroupKey && monthsBetween(groupKey, myGroupKey) > -MONTH_WINDOW,
    [roomType, groupKey, myGroupKey],
  );
  const canGoNext = useMemo(
    () => roomType === 'month' && !!groupKey && !!myGroupKey && monthsBetween(groupKey, myGroupKey) < MONTH_WINDOW,
    [roomType, groupKey, myGroupKey],
  );

  const switchRoomType = (t: RoomType) => {
    setRoomType(t);
    setPage(1);
    if (t === 'month') setGroupKey(myGroupKey);
    else if (t === 'region') setGroupKey(`region:${REGIONS[0].key}`);
    // radius 모드는 groupKey와 무관 (자체 radiusKey 사용)
  };

  // radius 모드용 자녀 출생연도 (동갑 매칭)
  const myBabyBirthYear = useMemo(() => {
    if (!selectedChild) return null;
    if (selectedChild.isPregnant) {
      if (selectedChild.dueDate) {
        const y = new Date(selectedChild.dueDate).getFullYear();
        return isNaN(y) ? null : y;
      }
      return null;
    }
    if (selectedChild.birthDate) {
      const y = new Date(selectedChild.birthDate).getFullYear();
      return isNaN(y) ? null : y;
    }
    return null;
  }, [selectedChild]);

  // 매칭 대상 출생연도 배열 (±ageRange)
  const targetBirthYears = useMemo(() => {
    if (!myBabyBirthYear) return undefined;
    const list: number[] = [];
    for (let d = -ageRange; d <= ageRange; d++) list.push(myBabyBirthYear + d);
    return list;
  }, [myBabyBirthYear, ageRange]);

  // 위치 등록 여부 확인 — radius 모드 진입 시마다 재조회 (등록 후 돌아오면 즉시 반영)
  const refreshLocation = useCallback(() => {
    momLocationApi.get().then((res) => {
      const data = res.data?.data as { hasLocation?: boolean; locationLabel?: string } | undefined;
      setHasLocation(!!data?.hasLocation);
      setLocationLabel(data?.locationLabel ?? '');
    }).catch(() => setHasLocation(false));
  }, []);

  useEffect(() => {
    if (roomType !== 'radius') return;
    refreshLocation();
  }, [roomType, refreshLocation]);

  // 화면 포커스 복귀 시 위치 재확인 (위치 등록 화면에서 돌아왔을 때)
  useFocusEffect(
    useCallback(() => {
      if (roomType === 'radius') refreshLocation();
    }, [roomType, refreshLocation]),
  );

  // radius 모드 진입 시 반경별 활동 카운트 조회
  useEffect(() => {
    if (roomType !== 'radius') return;
    momGroupApi.radiusCounts(targetBirthYears)
      .then((res) => {
        const data = res.data?.data as { counts?: Record<string, number> } | undefined;
        if (data?.counts) setRadiusCounts(data.counts);
      })
      .catch(() => setRadiusCounts({}));
  }, [roomType, targetBirthYears, hasLocation]);

  const canWrite =
    roomType === 'month' ? groupKey === myGroupKey
    : roomType === 'radius' ? !!hasLocation
    : true;

  const loadPosts = useCallback(async () => {
    void targetBirthYears; // 의존성 인지용
    if (roomType === 'radius') {
      // 전국 모드(radiusKey===0)는 위치 미등록이어도 OK
      if (radiusKey !== 0 && !hasLocation) {
        setPosts([]);
        setTotalPages(1);
        setTotalCount(0);
        return;
      }
      setLoading(true);
      try {
        const res = await momGroupApi.listPostsByRadius({
          radius: radiusKey,
          birthYears: targetBirthYears,
          category: categoryFilter ?? undefined,
          sort: sortMode,
          page,
          pageSize: PAGE_SIZE,
          q: searchQuery || undefined,
        });
        const payload = res.data.data as
          | { posts: Post[]; page: number; pageSize: number; total: number; totalPages: number }
          | undefined;
        if (payload && Array.isArray(payload.posts)) {
          setPosts(payload.posts);
          setTotalPages(payload.totalPages);
          setTotalCount(payload.total);
        } else {
          setPosts([]);
          setTotalPages(1);
          setTotalCount(0);
        }
      } catch {
        // silent — 초기 로드 시 alert 띄우지 않기 (사용자 새로고침 시도하면 retry)
        setPosts([]);
        setTotalPages(1);
        setTotalCount(0);
      }
      setLoading(false);
      return;
    }

    if (!groupKey) return;
    setLoading(true);
    try {
      const res = await momGroupApi.listPosts(groupKey, {
        category: categoryFilter ?? undefined,
        sort: sortMode,
        page,
        pageSize: PAGE_SIZE,
        q: searchQuery || undefined,
        qField: searchField,
      });
      const payload = res.data.data as
        | { posts: Post[]; page: number; pageSize: number; total: number; totalPages: number }
        | undefined;
      if (payload && Array.isArray(payload.posts)) {
        setPosts(payload.posts);
        setTotalPages(payload.totalPages);
        setTotalCount(payload.total);
      } else {
        setPosts([]);
        setTotalPages(1);
        setTotalCount(0);
      }
    } catch {
      Alert.alert('오류', '게시글을 불러오지 못했어요');
    }
    setLoading(false);
  }, [roomType, groupKey, radiusKey, hasLocation, targetBirthYears, categoryFilter, sortMode, page, searchQuery, searchField]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    if (myGroupKey && !groupKey) setGroupKey(myGroupKey);
  }, [myGroupKey, groupKey]);

  // groupKey / filter / sort / search 변경 시 페이지 초기화
  useEffect(() => { setPage(1); }, [groupKey, categoryFilter, sortMode, searchQuery, searchField]);

  const loadBookmarks = useCallback(async () => {
    setLoadingBookmarks(true);
    try {
      const res = await momGroupApi.listBookmarks();
      const list = (res.data.data as Post[]) ?? [];
      setBookmarkPosts(list);
      setBookmarkedIds(new Set(list.map((p) => p.id)));
    } catch {
      // silent
    }
    setLoadingBookmarks(false);
  }, []);

  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);

  const loadMinePosts = useCallback(async () => {
    setLoadingMine(true);
    try {
      const res = await momGroupApi.listPosts('', {
        mine: true,
        sort: 'recent',
        page: 1,
        pageSize: 100,
      });
      const payload = res.data.data as
        | { posts: Post[]; page: number; pageSize: number; total: number; totalPages: number }
        | undefined;
      setMinePosts(payload?.posts ?? []);
    } catch {
      // silent
    }
    setLoadingMine(false);
  }, []);

  useEffect(() => {
    if (viewMode === 'mine') loadMinePosts();
  }, [viewMode, loadMinePosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (viewMode === 'feed') await loadPosts();
    else if (viewMode === 'bookmarks') await loadBookmarks();
    else await loadMinePosts();
    setRefreshing(false);
  };

  const pickImage = async () => {
    const result = await pickImageFromLibrary({ quality: 0.7 });
    if (result?.uri) setPostImage(result.uri);
  };

  const resetWriteForm = () => {
    setWriteTitle('');
    setWriteContent('');
    setWriteCategory('chat');
    setWriteAnonymous(false);
    setPostImage(null);
    setEditingPostId(null);
  };

  const openEditPost = (p: Post) => {
    setEditingPostId(p.id);
    setWriteTitle(p.title || '');
    setWriteContent(p.content || '');
    setWriteCategory(p.category);
    setWriteAnonymous(p.anonymous);
    setPostImage(p.imageUrl ?? null);
    setShowWriteModal(true);
  };

  const handleSubmitPost = async () => {
    const title = writeTitle.trim();
    const body = writeContent.trim();
    if (!title) { Alert.alert('알림', '제목을 입력해주세요'); return; }
    if (!body) { Alert.alert('알림', '내용을 입력해주세요'); return; }

    setWriting(true);
    try {
      let imageUrl: string | null | undefined = undefined;
      if (postImage && postImage.startsWith('file://')) {
        setUploading(true);
        try {
          const up = await uploadApi.upload(postImage, 'mom-group');
          imageUrl = up.url;
        } finally {
          setUploading(false);
        }
      } else if (postImage && postImage.startsWith('https://')) {
        imageUrl = postImage;
      } else if (postImage === null) {
        imageUrl = null;
      }

      if (editingPostId) {
        await momGroupApi.updatePost(editingPostId, {
          title,
          content: body,
          category: writeCategory,
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        });
      } else {
        // radius 모드 글쓰기: 자신의 myGroupKey(월방)에 저장 → 자동으로 lat/lng/babyBirthYear 첨부됨
        const postGroupKey = roomType === 'radius' ? myGroupKey : groupKey;
        if (!postGroupKey) throw new Error('no groupKey');
        await momGroupApi.createPost(
          postGroupKey,
          title,
          body,
          writeCategory,
          writeAnonymous,
          imageUrl ?? null,
        );
      }

      resetWriteForm();
      setShowWriteModal(false);
      if (viewMode === 'mine') loadMinePosts();
      else loadPosts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '작성에 실패했어요';
      Alert.alert('알림', msg);
    }
    setWriting(false);
  };

  const handleDeletePost = (post: Post) => {
    Alert.alert('삭제', '이 게시글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await momGroupApi.deletePost(post.id);
            if (viewMode === 'mine') loadMinePosts();
            else loadPosts();
            setActivePost(null);
          } catch { Alert.alert('오류', '삭제에 실패했어요'); }
        },
      },
    ]);
  };

  const handleToggleLike = async (post: Post) => {
    // 낙관적 업데이트: posts + activePost 둘 다
    setPosts((prev) => prev.map((p) =>
      p.id === post.id ? { ...p, likeCount: p.likeCount + 1 } : p,
    ));
    setActivePost((prev) => (prev && prev.id === post.id
      ? { ...prev, likeCount: prev.likeCount + 1 }
      : prev));
    try {
      const res = await momGroupApi.toggleLike(post.id);
      const liked = (res.data.data?.liked as boolean) ?? true;
      // 서버 응답이 '취소'면 -2 보정 (낙관적 +1 → 실제 -1)
      const delta = liked ? 0 : -2;
      if (delta !== 0) {
        setPosts((prev) => prev.map((p) =>
          p.id === post.id
            ? { ...p, likeCount: Math.max(0, p.likeCount + delta) }
            : p,
        ));
        setActivePost((prev) => (prev && prev.id === post.id
          ? { ...prev, likeCount: Math.max(0, prev.likeCount + delta) }
          : prev));
      }
    } catch {
      setPosts((prev) => prev.map((p) =>
        p.id === post.id ? { ...p, likeCount: Math.max(0, p.likeCount - 1) } : p,
      ));
      setActivePost((prev) => (prev && prev.id === post.id
        ? { ...prev, likeCount: Math.max(0, prev.likeCount - 1) }
        : prev));
    }
  };

  const submitReport = async (post: Post, reason: 'abuse' | 'ad' | 'privacy' | 'spam' | 'other') => {
    try {
      await momGroupApi.reportPost(post.id, reason);
      Alert.alert('접수', '신고가 접수됐어요');
    } catch { Alert.alert('오류', '처리에 실패했어요'); }
  };

  const handleReport = (post: Post) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: '신고 사유 선택',
          message: '3회 이상 신고되면 자동 숨김 처리돼요',
          options: [...REPORT_REASON_OPTIONS.map((o) => o.label), '취소'],
          cancelButtonIndex: REPORT_REASON_OPTIONS.length,
        },
        (idx) => {
          if (idx < REPORT_REASON_OPTIONS.length) {
            submitReport(post, REPORT_REASON_OPTIONS[idx].key);
          }
        },
      );
    } else {
      Alert.alert(
        '신고 사유 선택',
        '3회 이상 신고되면 자동 숨김 처리돼요',
        [
          ...REPORT_REASON_OPTIONS.map((o) => ({
            text: o.label,
            onPress: () => submitReport(post, o.key),
          })),
          { text: '취소', style: 'cancel' as const },
        ],
      );
    }
  };

  const handleToggleBookmark = async (post: Post) => {
    const wasBookmarked = bookmarkedIds.has(post.id);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (wasBookmarked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    try {
      const res = await momGroupApi.toggleBookmark(post.id);
      const bookmarked = (res.data.data?.bookmarked as boolean) ?? !wasBookmarked;
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (bookmarked) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
      if (!bookmarked) {
        setBookmarkPosts((prev) => prev.filter((p) => p.id !== post.id));
      } else if (!wasBookmarked) {
        setBookmarkPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
      }
    } catch {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (wasBookmarked) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
      Alert.alert('오류', '북마크 처리에 실패했어요');
    }
  };

  const openComments = async (post: Post) => {
    setActivePost(post);
    setCommentAnonymous(false);
    setLoadingComments(true);
    try {
      const res = await momGroupApi.listComments(post.id);
      setComments((res.data.data as Comment[]) ?? []);
    } catch { /* silent */ }
    setLoadingComments(false);
  };

  const handleCreateComment = async () => {
    if (!activePost) return;
    const body = commentContent.trim();
    if (!body) return;
    setPosting(true);
    try {
      await momGroupApi.createComment(activePost.id, body, commentAnonymous);
      setCommentContent('');
      const res = await momGroupApi.listComments(activePost.id);
      setComments((res.data.data as Comment[]) ?? []);
      setPosts((prev) => prev.map((p) =>
        p.id === activePost.id ? { ...p, commentCount: p.commentCount + 1 } : p,
      ));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '작성에 실패했어요';
      Alert.alert('알림', msg);
    }
    setPosting(false);
  };

  const handleDeleteComment = (c: Comment) => {
    Alert.alert('삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await momGroupApi.deleteComment(c.id);
            setComments((prev) => prev.filter((x) => x.id !== c.id));
            if (activePost) {
              setPosts((prev) => prev.map((p) =>
                p.id === activePost.id ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p,
              ));
            }
          } catch { /* silent */ }
        },
      },
    ]);
  };

  if (!groupKey) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>{'< 뒤로'}</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>맘스톡</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyText}>출산예정일 또는 아기 생일을 먼저 등록해주세요</Text>
          <TouchableOpacity
            style={[styles.sortBtn, styles.sortBtnActive, { marginTop: SPACING.md }]}
            onPress={() => switchRoomType('region')}
          >
            <Text style={styles.sortTextActive}>지역방으로 둘러보기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderBoardRow = (p: Post, idx: number) => {
    const isBookmarked = bookmarkedIds.has(p.id);
    const rowNo = isFeed ? (totalCount - (page - 1) * PAGE_SIZE - idx) : (list.length - idx);
    return (
      <TouchableOpacity
        key={p.id}
        style={styles.boardRow}
        activeOpacity={0.6}
        onPress={() => openComments(p)}
      >
        <Text style={styles.colNo}>{rowNo > 0 ? rowNo : ''}</Text>
        <View style={styles.colTitleWrap}>
          <Text style={styles.colTitle} numberOfLines={1}>
            {p.isOfficial ? <Text style={styles.officialBadgeInline}>공식 </Text> : null}
            {p.isFallback ? <Text style={styles.fallbackBadgeInline}>전국 </Text> : null}
            {displayTitle(p)}
            {p.commentCount > 0 ? <Text style={styles.commentCountInline}> [{p.commentCount}]</Text> : null}
            {p.imageUrl ? <Text style={styles.inlineMark}> 📷</Text> : null}
            {isBookmarked ? <Text style={styles.inlineMark}> 🔖</Text> : null}
          </Text>
        </View>
        <Text style={styles.colAuthor} numberOfLines={1}>
          {p.anonymous ? '익명' : (p.isOfficial ? `${p.nickname} ✓` : p.nickname)}
        </Text>
        <Text style={styles.colDate}>{compactDate(p.createdAt)}</Text>
        <Text style={styles.colViews}>{p.viewCount ?? 0}</Text>
        <Text style={styles.colLikes}>{p.likeCount}</Text>
      </TouchableOpacity>
    );
  };

  const isFeed = viewMode === 'feed';
  const isBookmarkView = viewMode === 'bookmarks';
  const isMineView = viewMode === 'mine';

  const list = isFeed ? posts : isBookmarkView ? bookmarkPosts : minePosts;
  const isLoading = isFeed ? loading : isBookmarkView ? loadingBookmarks : loadingMine;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>{'< 뒤로'}</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>맘스톡</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 방 타입 탭 (지역방 deprecated — 내 동네 radius 모드로 대체) */}
      <View style={styles.roomTabRow}>
        {(['month', 'radius'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.roomTab, roomType === t && styles.roomTabActive]}
            onPress={() => switchRoomType(t)}
          >
            <Text
              style={[styles.roomTabText, roomType === t && styles.roomTabTextActive]}
              numberOfLines={1}
            >
              {t === 'month' ? '월방' : '내 동네'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 방 선택 UI */}
      {isFeed && roomType === 'radius' ? (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.roomPickerScroll}
            contentContainerStyle={styles.roomPickerRow}
          >
            {RADIUS_TABS.map((r) => {
              const active = radiusKey === r.key;
              const count = radiusCounts[String(r.key)] ?? 0;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roomPickerChip, active && styles.roomPickerChipActive]}
                  onPress={() => { setRadiusKey(r.key); setPage(1); }}
                >
                  <Text style={[styles.roomPickerText, active && styles.roomPickerTextActive]}>
                    {r.label}
                  </Text>
                  <Text style={[styles.roomPickerSub, active && { color: '#FFFFFF', opacity: 0.9 }]}>
                    {r.sub}
                    {count > 0 ? ` · ${count}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* 위치 미등록 안내 (전국 모드는 OK) */}
          {radiusKey !== 0 && hasLocation === false && (
            <TouchableOpacity
              style={styles.locationPrompt}
              onPress={() => router.push('/(main)/mom-location-setup')}
              activeOpacity={0.85}
            >
              <Text style={styles.locationPromptText}>
                위치를 먼저 등록해주세요 — 탭하여 등록
              </Text>
            </TouchableOpacity>
          )}
          {/* 등록된 위치 + 변경 버튼 */}
          {radiusKey !== 0 && hasLocation === true && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationInfoText} numberOfLines={1}>
                {'현재 등록: '}
                <Text style={styles.locationInfoStrong}>
                  {locationLabel || '위치 좌표 등록됨'}
                </Text>
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(main)/mom-location-setup')}
                style={styles.locationChangeBtn}
                hitSlop={8}
              >
                <Text style={styles.locationChangeText}>변경</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* 동갑 ±N 살 선택 */}
          {myBabyBirthYear && (
            <View style={styles.ageRangeRow}>
              <Text style={styles.ageRangeLabel}>아이 나이 차이</Text>
              <View style={styles.ageRangeChips}>
                {([0, 1, 2] as const).map((d) => {
                  const active = ageRange === d;
                  const label = d === 0 ? '동갑' : `±${d}살`;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.ageRangeChip, active && styles.ageRangeChipActive]}
                      onPress={() => { setAgeRange(d); setPage(1); }}
                    >
                      <Text style={[styles.ageRangeChipText, active && styles.ageRangeChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          {/* 매칭 안내 */}
          {myBabyBirthYear && targetBirthYears && (
            <View style={styles.matchHint}>
              <Text style={styles.matchHintText}>
                {ageRange === 0
                  ? `동갑 매칭: ${myBabyBirthYear}년생`
                  : `매칭 범위: ${targetBirthYears[0]}~${targetBirthYears[targetBirthYears.length - 1]}년생`}
              </Text>
            </View>
          )}
        </View>
      ) : isFeed && (roomType === 'month' ? (
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={[styles.monthArrow, !canGoPrev && { opacity: 0.25 }]}
            onPress={() => canGoPrev && setGroupKey(shiftGroupKey(groupKey, -1))}
            disabled={!canGoPrev}
          >
            <Text style={styles.monthArrowText}>{'‹'}</Text>
          </TouchableOpacity>
          <View style={styles.monthCenter}>
            <Text style={styles.monthTitle}>{formatGroupLabel(groupKey)}</Text>
            {myGroupKey && groupKey !== myGroupKey && (
              <TouchableOpacity onPress={() => setGroupKey(myGroupKey)}>
                <Text style={styles.monthReset}>내 예정월로 ({formatGroupLabel(myGroupKey).split(' ')[1]})</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.monthArrow, !canGoNext && { opacity: 0.25 }]}
            onPress={() => canGoNext && setGroupKey(shiftGroupKey(groupKey, 1))}
            disabled={!canGoNext}
          >
            <Text style={styles.monthArrowText}>{'›'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.roomPickerScroll}
          contentContainerStyle={styles.roomPickerRow}
        >
          {REGIONS.map((r) => {
            const key = `region:${r.key}`;
            const active = groupKey === key;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.roomPickerChip, active && styles.roomPickerChipActive]}
                onPress={() => setGroupKey(key)}
              >
                <Text style={[styles.roomPickerText, active && styles.roomPickerTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ))}

      {/* 카테고리 필터 제거 — 사용자 요청 */}

      {/* 정렬 + 북마크 + 내 글 */}
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.sortBtn, isFeed && sortMode === 'recent' && styles.sortBtnActive]}
          onPress={() => { setViewMode('feed'); setSortMode('recent'); }}
        >
          <Text style={[styles.sortText, isFeed && sortMode === 'recent' && styles.sortTextActive]}>🕒 최신</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, isFeed && sortMode === 'popular' && styles.sortBtnActive]}
          onPress={() => { setViewMode('feed'); setSortMode('popular'); }}
        >
          <Text style={[styles.sortText, isFeed && sortMode === 'popular' && styles.sortTextActive]}>🔥 인기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, isBookmarkView && styles.sortBtnActive]}
          onPress={() => setViewMode(isBookmarkView ? 'feed' : 'bookmarks')}
        >
          <Text style={[styles.sortText, isBookmarkView && styles.sortTextActive]}>
            🔖 북마크 {bookmarkedIds.size > 0 ? `(${bookmarkedIds.size})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, isMineView && styles.sortBtnActive]}
          onPress={() => setViewMode(isMineView ? 'feed' : 'mine')}
        >
          <Text style={[styles.sortText, isMineView && styles.sortTextActive]}>
            👤 내 글 {minePosts.length > 0 ? `(${minePosts.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : list.length === 0 ? (
          <View style={styles.emptyFeed}>
            <Text style={styles.emptyFeedEmoji}>
              {isBookmarkView ? '🔖' : isMineView ? '👤' : '✏️'}
            </Text>
            <Text style={styles.emptyFeedText}>
              {isBookmarkView
                ? '북마크한 글이 없어요'
                : isMineView
                  ? '아직 작성한 글이 없어요'
                  : searchQuery
                    ? `"${searchQuery}" 검색 결과가 없어요`
                    : categoryFilter
                      ? '이 카테고리에 아직 글이 없어요'
                      : roomType === 'radius' && hasLocation
                        ? `${radiusKey === 0 ? '전국' : `${radiusKey}km 안`}에 글이 없어요`
                        : '첫 게시글을 남겨보세요!'}
            </Text>
            {/* radius 모드에서 빈 화면이면 다음 반경 제안 */}
            {roomType === 'radius' && !isBookmarkView && !isMineView && !searchQuery && !categoryFilter && (
              <View style={styles.expandRow}>
                {(() => {
                  const sequence: RadiusKey[] = [5, 10, 50, 100, 0];
                  const idx = sequence.indexOf(radiusKey);
                  const nextOptions = sequence.slice(idx + 1);
                  return nextOptions.slice(0, 2).map((next) => {
                    const meta = RADIUS_TABS.find((r) => r.key === next);
                    if (!meta) return null;
                    const count = radiusCounts[String(next)] ?? 0;
                    return (
                      <TouchableOpacity
                        key={next}
                        style={styles.expandBtn}
                        onPress={() => { setRadiusKey(next); setPage(1); }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.expandBtnText}>
                          {`${meta.label} 보기${count > 0 ? ` (${count})` : ''}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
            )}
          </View>
        ) : (
          <>
            {/* 표형 헤더 */}
            <View style={styles.boardHeaderRow}>
              <Text style={[styles.colNo, styles.colHeaderText]}>번호</Text>
              <View style={styles.colTitleWrap}>
                <Text style={[styles.colHeaderText, { textAlign: 'left' }]}>제목</Text>
              </View>
              <Text style={[styles.colAuthor, styles.colHeaderText]}>작성자</Text>
              <Text style={[styles.colDate, styles.colHeaderText]}>날짜</Text>
              <Text style={[styles.colViews, styles.colHeaderText]}>조회</Text>
              <Text style={[styles.colLikes, styles.colHeaderText]}>♥</Text>
            </View>
            {list.map((p, i) => renderBoardRow(p, i))}
            {/* 페이지네이션 (feed 모드만) */}
            {isFeed && totalPages > 1 && (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  onPress={() => page > 1 && setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>‹ 이전</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {page} / {totalPages}
                  {totalCount > 0 ? ` · ${totalCount}개` : ''}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                  onPress={() => page < totalPages && setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextDisabled]}>다음 ›</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* 검색 바 (하단) — 사용자 요청 */}
            {isFeed && (
              <>
                <View style={styles.searchFieldRow}>
                  {(
                    [
                      { key: 'all', label: '전체' },
                      { key: 'title', label: '제목' },
                      { key: 'content', label: '내용' },
                      { key: 'nickname', label: '작성자' },
                    ] as { key: 'all' | 'title' | 'content' | 'nickname'; label: string }[]
                  ).map((opt) => {
                    const active = searchField === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.searchFieldChip, active && styles.searchFieldChipActive]}
                        onPress={() => setSearchField(opt.key)}
                      >
                        <Text
                          style={[
                            styles.searchFieldChipText,
                            active && styles.searchFieldChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.searchRowBottom}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder={
                      searchField === 'title'
                        ? '제목에서 검색'
                        : searchField === 'content'
                          ? '내용에서 검색'
                          : searchField === 'nickname'
                            ? '작성자에서 검색'
                            : '검색'
                    }
                    placeholderTextColor={COLORS.textSecondary}
                    value={searchInput}
                    onChangeText={setSearchInput}
                    returnKeyType="search"
                    onSubmitEditing={() => setSearchQuery(searchInput.trim())}
                  />
                  {searchInput ? (
                    <TouchableOpacity
                      style={styles.searchClearBtn}
                      onPress={() => { setSearchInput(''); setSearchQuery(''); }}
                    >
                      <Text style={styles.searchClearText}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.searchBtn}
                    onPress={() => setSearchQuery(searchInput.trim())}
                  >
                    <Text style={styles.searchBtnText}>🔍</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {canWrite && isFeed && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + SPACING.md }]}
          onPress={() => {
            resetWriteForm();
            setShowWriteModal(true);
          }}
        >
          <Text style={styles.fabText}>✏️ 글쓰기</Text>
        </TouchableOpacity>
      )}

      {/* 글쓰기 / 수정 모달 */}
      <Modal
        visible={showWriteModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowWriteModal(false); resetWriteForm(); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowWriteModal(false); resetWriteForm(); }}>
                <Text style={styles.backBtn}>{'< 닫기'}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingPostId ? '글 수정' : `${roomLabel(roomType, groupKey, radiusKey, ageRange)} · 새 글`}
              </Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {/* 카테고리 UI 제거 — 내부적으로 'chat' 기본 */}

              {/* 제목 */}
              <Text style={styles.writeLabel}>제목</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="제목을 입력해주세요"
                placeholderTextColor={COLORS.textSecondary}
                value={writeTitle}
                onChangeText={setWriteTitle}
                maxLength={50}
                returnKeyType="next"
              />
              <Text style={styles.writeCount}>{writeTitle.length} / 50</Text>

              {/* 내용 */}
              <Text style={styles.writeLabel}>내용</Text>
              <TextInput
                style={styles.writeInput}
                placeholder={writePlaceholder(roomType)}
                placeholderTextColor={COLORS.textSecondary}
                multiline
                value={writeContent}
                onChangeText={setWriteContent}
                maxLength={1000}
              />
              <Text style={styles.writeCount}>{writeContent.length} / 1000</Text>

              {/* 사진 첨부 */}
              {postImage ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: postImage }} style={styles.imagePreview} contentFit="cover" />
                  <TouchableOpacity
                    style={styles.imageRemoveBtn}
                    onPress={() => setPostImage(null)}
                    disabled={uploading}
                  >
                    <Text style={styles.imageRemoveText}>✕ 사진 삭제</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePickBtn} onPress={pickImage}>
                  <Text style={styles.imagePickText}>📷 사진 첨부 (선택)</Text>
                </TouchableOpacity>
              )}

              {/* 익명 토글 (새 글 작성 시에만) */}
              {!editingPostId && (
                <View style={styles.anonRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.anonTitle}>🕶️ 익명으로 쓰기</Text>
                    <Text style={styles.anonDesc}>실제 닉네임 대신 같은 방에서만 고정되는 &apos;익명맘#1234&apos;로 표시돼요</Text>
                  </View>
                  <Switch
                    value={writeAnonymous}
                    onValueChange={setWriteAnonymous}
                    trackColor={{ false: '#D1D5DB', true: '#F48FB1' }}
                    thumbColor={writeAnonymous ? '#E91E63' : '#F3F4F6'}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!writeTitle.trim() || !writeContent.trim() || writing || uploading) && { opacity: 0.4 },
                ]}
                onPress={handleSubmitPost}
                disabled={!writeTitle.trim() || !writeContent.trim() || writing || uploading}
              >
                {writing || uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingPostId ? '수정 완료' : '게시'}</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 댓글 모달 */}
      <Modal
        visible={!!activePost}
        animationType="slide"
        transparent
        onRequestClose={() => { setActivePost(null); setComments([]); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { height: '85%', flexDirection: 'column' }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setActivePost(null); setComments([]); }}>
                <Text style={styles.backBtn}>{'< 닫기'}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>게시글</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: SPACING.md }}
              keyboardShouldPersistTaps="handled"
            >
            {activePost && (
              <View style={styles.commentPostPreview}>
                <View style={styles.postHeader}>
                  <View style={[styles.postCatBadge, { backgroundColor: (CATEGORY_META[activePost.category] ?? CATEGORY_META.chat).bg }]}>
                    <Text style={[styles.postCatText, { color: (CATEGORY_META[activePost.category] ?? CATEGORY_META.chat).color }]}>
                      {(CATEGORY_META[activePost.category] ?? CATEGORY_META.chat).emoji} {(CATEGORY_META[activePost.category] ?? CATEGORY_META.chat).label}
                    </Text>
                  </View>
                  <Text style={styles.postTime}>
                    {timeAgo(activePost.createdAt)}
                    {activePost.isEdited ? ' · (수정됨)' : ''}
                  </Text>
                </View>
                {activePost.title ? (
                  <Text style={styles.detailTitle}>
                    {activePost.isOfficial ? <Text style={styles.officialBadgeInline}>공식 </Text> : null}
                    {activePost.isFallback ? <Text style={styles.fallbackBadgeInline}>전국 인기 </Text> : null}
                    {activePost.title}
                  </Text>
                ) : null}
                <Text style={styles.postNickname}>
                  {activePost.nickname}
                  {activePost.isOfficial ? <Text style={styles.officialCheck}> ✓ 공식</Text> : null}
                  {activePost.anonymous ? ' · 익명' : ''}
                </Text>
                <Text style={styles.postContent}>{activePost.content}</Text>
                {activePost.imageUrl ? (
                  <Image
                    source={{ uri: activePost.imageUrl }}
                    style={styles.detailImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                ) : null}
                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.postActionWithIcon} onPress={() => handleToggleLike(activePost)}>
                    <Image source={IC_HEART} style={styles.actionIcon} contentFit="contain" />
                    <Text style={styles.postActionText}>{activePost.likeCount}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postActionWithIcon} onPress={() => handleToggleBookmark(activePost)}>
                    <Image source={IC_BOOKMARK} style={styles.actionIcon} contentFit="contain" />
                    <Text style={styles.postActionText}>
                      {bookmarkedIds.has(activePost.id) ? '저장됨' : '북마크'}
                    </Text>
                  </TouchableOpacity>
                  {activePost.isMine ? (
                    <>
                      <TouchableOpacity
                        style={styles.postAction}
                        onPress={() => {
                          setActivePost(null);
                          openEditPost(activePost);
                        }}
                      >
                        <Text style={styles.postActionText}>✏️ 수정</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.postAction} onPress={() => handleDeletePost(activePost)}>
                        <Text style={styles.postActionTextDanger}>삭제</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={styles.postAction} onPress={() => handleReport(activePost)}>
                      <Text style={styles.postActionTextMuted}>🚩 신고</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <View>
              {loadingComments ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
              ) : comments.length === 0 ? (
                <Text style={styles.emptyComment}>첫 댓글을 남겨주세요</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentNickname}>
                        {c.nickname}
                        {c.isOfficial ? <Text style={styles.officialCheck}> ✓ 공식</Text> : null}
                        {c.anonymous ? ' · 익명' : ''} · {timeAgo(c.createdAt)}
                      </Text>
                      <Text style={styles.commentText}>{c.content}</Text>
                    </View>
                    {c.isMine && (
                      <TouchableOpacity onPress={() => handleDeleteComment(c)}>
                        <Text style={styles.postActionTextDanger}>삭제</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
            </ScrollView>

            <View style={styles.commentAnonRow}>
              <Text style={styles.commentAnonLabel}>🕶️ 익명으로</Text>
              <Switch
                value={commentAnonymous}
                onValueChange={setCommentAnonymous}
                trackColor={{ false: '#D1D5DB', true: '#F48FB1' }}
                thumbColor={commentAnonymous ? '#E91E63' : '#F3F4F6'}
              />
            </View>

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="댓글 작성..."
                placeholderTextColor={COLORS.textSecondary}
                value={commentContent}
                onChangeText={setCommentContent}
                maxLength={300}
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, (!commentContent.trim() || posting) && { opacity: 0.4 }]}
                onPress={handleCreateComment}
                disabled={!commentContent.trim() || posting}
              >
                {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.commentSendText}>전송</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },

  roomTabRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.md, paddingTop: 4, gap: 4,
    backgroundColor: COLORS.surface,
  },
  roomTab: {
    flex: 1, paddingVertical: 5, borderRadius: RADIUS.sm, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  roomTabActive: { backgroundColor: '#E91E63', borderColor: '#E91E63' },
  roomTabText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  roomTabTextActive: { color: '#FFFFFF', fontWeight: '700' },

  roomPickerScroll: {
    flexGrow: 0,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  roomPickerRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    gap: 4,
    alignItems: 'center',
  },
  roomPickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    marginRight: 4,
  },
  roomPickerChipActive: { backgroundColor: '#F8BBD0', borderColor: '#E91E63' },
  roomPickerText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  roomPickerTextActive: { color: '#AD1457', fontWeight: '700' },
  roomPickerSub: { fontSize: 9, color: COLORS.textLight, fontWeight: '600', marginTop: 1 },
  locationPrompt: {
    backgroundColor: '#FFF0E6',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#FFD4BB',
  },
  locationPromptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF8C5A',
    textAlign: 'center',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FAF7',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#B8E1D2',
    gap: 8,
  },
  locationInfoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1A6B4C',
  },
  locationInfoStrong: {
    fontWeight: '900',
    color: '#0F4D33',
  },
  locationChangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#1A6B4C',
  },
  locationChangeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  matchHint: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  matchHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#AD1457',
  },
  ageRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 10,
  },
  ageRangeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  ageRangeChips: {
    flexDirection: 'row',
    gap: 6,
  },
  ageRangeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  ageRangeChipActive: {
    backgroundColor: '#F8BBD0',
    borderColor: '#E91E63',
  },
  ageRangeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  ageRangeChipTextActive: {
    color: '#AD1457',
    fontWeight: '900',
  },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 2,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  monthArrow: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FCE4EC',
  },
  monthArrowText: { fontSize: 20, fontWeight: '800', color: '#AD1457' },
  monthCenter: { alignItems: 'center', flex: 1 },
  monthTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  monthReset: { fontSize: 11, color: COLORS.primary, marginTop: 2 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    gap: 6,
  },
  searchFieldRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 4,
    gap: 6,
  },
  searchFieldChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchFieldChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  searchFieldChipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  searchFieldChipTextActive: {
    color: '#fff',
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 6 : 10,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  searchClearBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.border,
  },
  searchClearText: { fontSize: 12, color: COLORS.textSecondary },
  searchBtn: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E91E63',
  },
  searchBtnText: { fontSize: 14, color: '#fff' },

  catRow: {
    paddingHorizontal: SPACING.md, paddingVertical: 6, gap: 6, alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, marginRight: 6,
  },
  catChipActive: { backgroundColor: '#FCE4EC', borderColor: '#E91E63' },
  catChipText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600' },
  catChipTextActive: { color: '#E91E63', fontWeight: '700' },

  sortRow: {
    flexDirection: 'row', gap: 3, paddingHorizontal: SPACING.md, paddingVertical: 4,
    flexWrap: 'wrap', backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sortBtn: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  sortBtnActive: { backgroundColor: '#F8BBD0', borderColor: '#E91E63' },
  sortText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600' },
  sortTextActive: { color: '#AD1457', fontWeight: '700' },

  scrollContent: { padding: 0, paddingBottom: 120 },

  emptyFeed: { alignItems: 'center', padding: SPACING.xl * 2 },
  emptyFeedEmoji: { fontSize: 40, marginBottom: SPACING.md },
  emptyFeedText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: 16 },
  expandRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  expandBtn: {
    backgroundColor: '#FF8C5A',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
  },
  expandBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  // 클래식 표형 게시판 행
  boardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F9',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  colHeaderText: {
    fontSize: 11,
    color: '#6B6B70',
    fontWeight: '700',
    textAlign: 'center',
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEF',
  },
  colNo: {
    width: 34,
    fontSize: 11,
    color: '#9A9AA0',
    textAlign: 'center',
  },
  colTitleWrap: {
    flex: 1,
    paddingHorizontal: 4,
  },
  colTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  commentCountInline: {
    fontSize: 12,
    color: '#E91E63',
    fontWeight: '700',
  },
  inlineMark: {
    fontSize: 11,
  },
  officialBadgeInline: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    backgroundColor: '#1976D2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fallbackBadgeInline: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    backgroundColor: '#7C4DFF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  officialCheck: {
    color: '#1976D2',
    fontWeight: '700',
    fontSize: 12,
  },
  colAuthor: {
    width: 52,
    fontSize: 11,
    color: '#6B6B70',
    textAlign: 'center',
  },
  colDate: {
    width: 50,
    fontSize: 11,
    color: '#6B6B70',
    textAlign: 'center',
  },
  colViews: {
    width: 34,
    fontSize: 11,
    color: '#9A9AA0',
    textAlign: 'center',
  },
  colLikes: {
    width: 28,
    fontSize: 11,
    color: '#9A9AA0',
    textAlign: 'center',
  },
  postActionWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: { width: 16, height: 16, tintColor: COLORS.textSecondary },

  // 하단 검색 바
  searchRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 6,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  pageBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.sm,
    backgroundColor: '#FCE4EC', borderWidth: 1, borderColor: '#F8BBD0',
  },
  pageBtnDisabled: { backgroundColor: COLORS.border, borderColor: COLORS.border },
  pageBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#AD1457' },
  pageBtnTextDisabled: { color: COLORS.textSecondary },
  pageInfo: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },

  postCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  postCatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  postCatText: { fontSize: 11, fontWeight: '700' },
  postNickname: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  postTime: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  detailTitle: {
    fontSize: 18, fontWeight: '800', color: COLORS.text,
    marginTop: SPACING.xs, marginBottom: SPACING.xs,
  },
  postContent: { fontSize: FONT_SIZE.md, color: COLORS.text, lineHeight: 22 },
  postImage: {
    width: '100%', height: 200, borderRadius: RADIUS.sm,
    marginTop: SPACING.sm, backgroundColor: COLORS.border,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
    backgroundColor: '#F2F2F4',
  },

  imagePickBtn: {
    padding: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border,
    alignItems: 'center', marginBottom: SPACING.md,
  },
  imagePickText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  imagePreviewWrap: { marginBottom: SPACING.md },
  imagePreview: {
    width: '100%', height: 180, borderRadius: RADIUS.md,
    backgroundColor: COLORS.border,
  },
  imageRemoveBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  imageRemoveText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: '700' },
  postActions: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexWrap: 'wrap',
  },
  postAction: { padding: 4 },
  postActionText: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },
  postActionTextMuted: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  postActionTextDanger: { fontSize: FONT_SIZE.sm, color: COLORS.error, fontWeight: '600' },

  fab: {
    position: 'absolute',
    right: SPACING.md,
    backgroundColor: '#E91E63',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 30,
    ...SHADOWS.soft,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.md,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },

  writeLabel: {
    fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  catPickerRow: {
    flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.md,
  },
  titleInput: {
    height: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  writeInput: {
    minHeight: 140,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  writeCount: {
    textAlign: 'right',
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  anonRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.sm, borderRadius: RADIUS.md,
    marginBottom: SPACING.md, gap: SPACING.sm,
  },
  anonTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  anonDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 16 },
  submitBtn: {
    backgroundColor: '#E91E63',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },

  commentPostPreview: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  emptyComment: {
    textAlign: 'center',
    paddingVertical: SPACING.xl,
    color: COLORS.textSecondary,
  },
  commentRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  commentNickname: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: 2 },
  commentText: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
  commentAnonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 6, paddingVertical: 4,
  },
  commentAnonLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  commentInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  commentInput: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentSendBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#E91E63',
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
  },
  commentSendText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },
});
