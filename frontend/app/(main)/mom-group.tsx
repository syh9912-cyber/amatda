import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChildStore } from '../../stores/childStore';
import { momGroupApi, momLocationApi, uploadApi, authApi, type MomGroupCategory, type MomGroupSort } from '../../services/api';
import { displayNickname } from '../../utils/displayNickname';
import { AdSlot } from '../../components/ads/AdSlot';
import { pickImageFromLibrary } from '../../utils/imagePicker';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideButton } from '../../components/common/GuideButton';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { getMomGroupGuide } from '../../features/guide/momGroupGuide';

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
  isPinned?: boolean;
}

function getReportReasonOptions(t: TFunction): { key: 'abuse' | 'ad' | 'privacy' | 'spam' | 'other'; label: string }[] {
  return [
    { key: 'abuse', label: t('momGroup.reportReason.abuse') },
    { key: 'ad', label: t('momGroup.reportReason.ad') },
    { key: 'privacy', label: t('momGroup.reportReason.privacy') },
    { key: 'spam', label: t('momGroup.reportReason.spam') },
    { key: 'other', label: t('momGroup.reportReason.other') },
  ];
}

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

// 산뜻한 컬러 팔레트 — Material 400~500 (밝고 명도 높음)
// 어두운 톤(800/900)은 옛 게시판 느낌이라 의도적으로 회피
function getCategoryMeta(t: TFunction): Record<MomGroupCategory, { label: string; emoji: string; color: string; bg: string }> {
  return {
    question:    { label: t('momGroup.category.question'), emoji: '❓', color: '#29B6F6', bg: '#E1F5FE' }, // 산뜻한 하늘
    chat:        { label: t('momGroup.category.chat'), emoji: '💬', color: '#EC407A', bg: '#FCE4EC' }, // 밝은 핑크
    info:        { label: t('momGroup.category.info'), emoji: '📚', color: '#66BB6A', bg: '#E8F5E9' }, // 프레시 그린
    worry:       { label: t('momGroup.category.worry'), emoji: '😔', color: '#FFA726', bg: '#FFF3E0' }, // 따뜻한 오렌지
    celebration: { label: t('momGroup.category.celebration'), emoji: '🎉', color: '#AB47BC', bg: '#F3E5F5' }, // 라벤더
  };
}
const CATEGORY_KEYS: MomGroupCategory[] = ['question', 'chat', 'info', 'worry', 'celebration'];

const PAGE_SIZE = 20;

function deriveGroupKey(isoDate?: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatGroupLabel(t: TFunction, key: string): string {
  const [y, m] = key.split('-');
  return t('momGroup.groupLabel', { year: y, month: parseInt(m, 10) });
}

function formatMonthOnly(t: TFunction, key: string): string {
  const [, m] = key.split('-');
  return t('momGroup.monthOnly', { month: parseInt(m, 10) });
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

function timeAgo(t: TFunction, iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('momGroup.timeAgo.justNow');
  if (min < 60) return t('momGroup.timeAgo.minutes', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('momGroup.timeAgo.hours', { count: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t('momGroup.timeAgo.days', { count: day });
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

const MONTH_WINDOW = 12; // 내 예정월 ±12개월(1년)까지 이동 허용

type RoomType = 'month' | 'region' | 'radius';
type ViewMode = 'feed' | 'bookmarks' | 'mine' | 'honor';

// 부적절 콘텐츠(욕설·비방 등) 1차 필터 — Apple 1.2 objectionable content filtering 대응.
// 공백·자모 분리를 제거해 우회를 일부 방지한다. 서버측(mom-group.ts)에도 동일 검사 권장.
const BANNED_WORDS = [
  '씨발', '시발', '씨빨', '시1발', '씨1발', '씨발년', '씨발놈', '개씨발',
  '병신', '븅신', 'ㅂㅅ', '지랄', 'ㅈㄹ', '개새끼', '개새', '새끼', 'ㅅㄲ',
  '좆', '좇', '좆같', '존나', '졸라', '엠창', '느금', '니애미', '니미',
  '미친놈', '미친년', '창녀', '걸레년', '보지', '자지', '씹', '꺼져', '닥쳐',
  'ㅅㅂ', 'ㅄ', '시발', 'fuck', 'shit', 'bitch', 'asshole',
];
function containsBannedWord(text: string): boolean {
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  return BANNED_WORDS.some((w) => normalized.includes(w.toLowerCase()));
}

// 명예의 전당 진입 임계값 — 게시물의 인기 점수 = likeCount + commentCount * 2
const HONOR_SCORE_THRESHOLD = 5;

// 가이드맵 1회만 노출용 AsyncStorage 키. 가이드 변경 시 v2로 bump.
const GUIDE_SEEN_KEY = 'mom-group-guide-seen-v1';

type RadiusKey = 5 | 10 | 50 | 100 | 0; // 0 = 전국
function getRadiusTabs(t: TFunction): { key: RadiusKey; label: string; sub: string }[] {
  return [
    { key: 5,   label: '5km',  sub: t('momGroup.radius.sub5') },
    { key: 10,  label: '10km', sub: t('momGroup.radius.sub10') },
    { key: 50,  label: '50km', sub: t('momGroup.radius.sub50') },
    { key: 100, label: '100km', sub: t('momGroup.radius.sub100') },
    { key: 0,   label: t('momGroup.radius.nationwide'), sub: t('momGroup.radius.subNationwide') },
  ];
}

function getRegions(t: TFunction): { key: string; label: string }[] {
  return [
    { key: 'seoul', label: t('momGroup.region.seoul') }, { key: 'busan', label: t('momGroup.region.busan') },
    { key: 'daegu', label: t('momGroup.region.daegu') }, { key: 'incheon', label: t('momGroup.region.incheon') },
    { key: 'gwangju', label: t('momGroup.region.gwangju') }, { key: 'daejeon', label: t('momGroup.region.daejeon') },
    { key: 'ulsan', label: t('momGroup.region.ulsan') }, { key: 'sejong', label: t('momGroup.region.sejong') },
    { key: 'gyeonggi', label: t('momGroup.region.gyeonggi') }, { key: 'gangwon', label: t('momGroup.region.gangwon') },
    { key: 'chungbuk', label: t('momGroup.region.chungbuk') }, { key: 'chungnam', label: t('momGroup.region.chungnam') },
    { key: 'jeonbuk', label: t('momGroup.region.jeonbuk') }, { key: 'jeonnam', label: t('momGroup.region.jeonnam') },
    { key: 'gyeongbuk', label: t('momGroup.region.gyeongbuk') }, { key: 'gyeongnam', label: t('momGroup.region.gyeongnam') },
    { key: 'jeju', label: t('momGroup.region.jeju') },
  ];
}

function roomLabel(t: TFunction, roomType: RoomType, groupKey: string, radiusKey?: number, ageRange?: number): string {
  if (roomType === 'month') return formatGroupLabel(t, groupKey);
  if (roomType === 'radius') {
    const meta = getRadiusTabs(t).find((r) => r.key === (radiusKey ?? 10));
    const ageLabel = ageRange === 0 ? t('momGroup.sameAge') : ageRange ? t('momGroup.ageRangePlusMinus', { n: ageRange }) : '';
    return t('momGroup.roomLabelNearby', { label: meta?.label ?? '', ageSuffix: ageLabel ? ` · ${ageLabel}` : '' });
  }
  const r = getRegions(t).find((x) => `region:${x.key}` === groupKey);
  return t('momGroup.roomLabelRegion', { label: r?.label ?? '' });
}

function writePlaceholder(t: TFunction, roomType: RoomType): string {
  if (roomType === 'radius') return t('momGroup.writePlaceholderNearby');
  if (roomType === 'month') return t('momGroup.writePlaceholderMonth');
  return t('momGroup.writePlaceholderRegion');
}

function displayTitle(t: TFunction, p: Post): string {
  if (p.title) return p.title;
  // legacy fallback: derive from content
  const trimmed = p.content.trim().replace(/\s+/g, ' ');
  if (!trimmed) return t('momGroup.noContent');
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 40) + '…';
}

export default function MomGroupScreen() {
  const { t } = useTranslation();
  const momGroupGuide = useMemo(() => getMomGroupGuide(t), [t]);
  const insets = useSafeAreaInsets();
  const { selectedChild } = useChildStore();
  // 자녀 birthDate/dueDate 기반 월방. 자녀 없는 사용자(공식 계정 등)는 현재 월 fallback.
  const childGroupKey = deriveGroupKey(selectedChild?.dueDate ?? selectedChild?.birthDate);
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const myGroupKey = childGroupKey ?? currentMonthKey;

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
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 글쓰기 / 수정
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeCategory, setWriteCategory] = useState<MomGroupCategory>('chat');
  const [writePinned, setWritePinned] = useState(false);
  const [writing, setWriting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [isOfficialUser, setIsOfficialUser] = useState(false);

  const [activePost, setActivePost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  // 이번 세션에서 공감(좋아요)한 게시물 — 활성 상태 표시 + 토글 방향 판정
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [bookmarkPosts, setBookmarkPosts] = useState<Post[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [minePosts, setMinePosts] = useState<Post[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  // 첫 진입 가이드 — 1회만 노출 (스포트라이트 GuideCarousel)
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(GUIDE_SEEN_KEY);
        if (!seen) setShowGuide(true);
      } catch { /* AsyncStorage 실패는 무시 — 가이드 안 보이는 것뿐 */ }
    })();
  }, []);
  const closeGuide = useCallback(async () => {
    setShowGuide(false);
    try { await AsyncStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch { /* 무시 */ }
  }, []);
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

  const switchRoomType = (roomTypeArg: RoomType) => {
    setRoomType(roomTypeArg);
    setPage(1);
    // 정석: 방 전환 시 viewMode를 feed로 리셋 → 북마크/내 글 상태에서 방 바꾸는 모순 제거
    setViewMode('feed');
    setSearchQuery('');
    setSearchInput('');
    if (roomTypeArg === 'month') setGroupKey(myGroupKey);
    // 'region'은 deprecated — switchRoomType 호출처 모두 제거
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

  // 공식 계정 여부 확인 (마운트 시 1회) — 글쓰기 시 핀 옵션 노출 여부 판정
  useEffect(() => {
    authApi.getProfile()
      .then((res) => {
        const data = res.data?.data as { isOfficial?: boolean } | undefined;
        setIsOfficialUser(data?.isOfficial === true);
      })
      .catch(() => {});
  }, []);

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
      Alert.alert(t('common.error'), t('momGroup.loadPostsError'));
    }
    setLoading(false);
  }, [roomType, groupKey, radiusKey, hasLocation, targetBirthYears, categoryFilter, sortMode, page, searchQuery, searchField, t]);

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
    const result = await pickImageFromLibrary(t, { quality: 0.7 });
    if (result?.uri) setPostImage(result.uri);
  };

  const resetWriteForm = () => {
    setWriteTitle('');
    setWriteContent('');
    setWriteCategory('chat');
    setWritePinned(false);
    setPostImage(null);
    setEditingPostId(null);
  };

  const openEditPost = (p: Post) => {
    setEditingPostId(p.id);
    setWriteTitle(p.title || '');
    setWriteContent(p.content || '');
    setWriteCategory(p.category);
    setWritePinned(p.isPinned === true);
    setPostImage(p.imageUrl ?? null);
    setShowWriteModal(true);
  };

  const handleSubmitPost = async () => {
    const title = writeTitle.trim();
    const body = writeContent.trim();
    if (!title) { Alert.alert(t('common.notice'), t('momGroup.titleRequired')); return; }
    if (!body) { Alert.alert(t('common.notice'), t('momGroup.contentRequired')); return; }
    if (containsBannedWord(title) || containsBannedWord(body)) {
      Alert.alert(t('common.notice'), t('momGroup.bannedWordError'));
      return;
    }

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
          ...(isOfficialUser ? { isPinned: writePinned } : {}),
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
          false, // 익명 게시 폐지 — 항상 실명(닉네임)으로 작성 (Apple 1.2 대응)
          imageUrl ?? null,
          isOfficialUser ? writePinned : undefined,
        );
      }

      resetWriteForm();
      setShowWriteModal(false);
      if (viewMode === 'mine') loadMinePosts();
      else loadPosts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('momGroup.submitError');
      Alert.alert(t('common.notice'), msg);
    }
    setWriting(false);
  };

  const handleDeletePost = (post: Post) => {
    Alert.alert(t('momGroup.deletePostTitle'), t('momGroup.deletePostConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive', onPress: async () => {
          try {
            await momGroupApi.deletePost(post.id);
            if (viewMode === 'mine') loadMinePosts();
            else loadPosts();
            setActivePost(null);
          } catch { Alert.alert(t('common.error'), t('momGroup.deletePostError')); }
        },
      },
    ]);
  };

  const applyLikeDelta = (postId: string, delta: number) => {
    if (delta === 0) return;
    setPosts((prev) => prev.map((p) =>
      p.id === postId ? { ...p, likeCount: Math.max(0, p.likeCount + delta) } : p,
    ));
    setActivePost((prev) => (prev && prev.id === postId
      ? { ...prev, likeCount: Math.max(0, prev.likeCount + delta) }
      : prev));
  };

  const handleToggleLike = async (post: Post) => {
    const wasLiked = likedIds.has(post.id);
    const optimisticDelta = wasLiked ? -1 : 1;
    // 낙관적: 토글 방향대로 카운트/활성상태 즉시 반영
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(post.id); else next.add(post.id);
      return next;
    });
    applyLikeDelta(post.id, optimisticDelta);
    try {
      const res = await momGroupApi.toggleLike(post.id);
      const liked = (res.data.data?.liked as boolean) ?? !wasLiked;
      // 서버 실제 상태로 보정 (낙관적 가정과 다르면 카운트 재조정)
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(post.id); else next.delete(post.id);
        return next;
      });
      const actualDelta = liked ? 1 : -1;
      applyLikeDelta(post.id, actualDelta - optimisticDelta);
    } catch {
      // 롤백
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(post.id); else next.delete(post.id);
        return next;
      });
      applyLikeDelta(post.id, -optimisticDelta);
    }
  };

  const submitReport = async (post: Post, reason: 'abuse' | 'ad' | 'privacy' | 'spam' | 'other') => {
    try {
      await momGroupApi.reportPost(post.id, reason);
      Alert.alert(t('momGroup.reportReceivedTitle'), t('momGroup.reportReceivedDesc'));
    } catch { Alert.alert(t('common.error'), t('momGroup.reportError')); }
  };

  // UGC 정책(Apple 1.2) — 사용자 차단: 즉시 피드에서 제거 + 운영팀(개발자) 통지(자동 신고).
  const handleBlockUser = (post: Post) => {
    if (post.isMine) return;
    const name = post.anonymous ? t('momGroup.anonymousUser') : (post.nickname || t('momGroup.thisUser'));
    const doBlock = async () => {
      try {
        await momGroupApi.blockUser(post.userId, post.id);
        // 즉시 제거: 이 사용자의 모든 글을 피드에서 빼고 상세를 닫는다.
        setPosts((prev) => prev.filter((p) => p.userId !== post.userId));
        setActivePost(null);
        Alert.alert(t('momGroup.blockDoneTitle'), t('momGroup.blockDoneDesc'));
      } catch {
        Alert.alert(t('common.error'), t('momGroup.blockError'));
      }
    };
    Alert.alert(
      t('momGroup.blockConfirmTitle', { name }),
      t('momGroup.blockConfirmDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('momGroup.block'), style: 'destructive', onPress: doBlock },
      ],
    );
  };

  const handleReport = (post: Post) => {
    const reportReasonOptions = getReportReasonOptions(t);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t('momGroup.reportReasonTitle'),
          message: t('momGroup.reportReasonMessage'),
          options: [...reportReasonOptions.map((o) => o.label), t('common.cancel')],
          cancelButtonIndex: reportReasonOptions.length,
        },
        (idx) => {
          if (idx < reportReasonOptions.length) {
            submitReport(post, reportReasonOptions[idx].key);
          }
        },
      );
    } else {
      Alert.alert(
        t('momGroup.reportReasonTitle'),
        t('momGroup.reportReasonMessage'),
        [
          ...reportReasonOptions.map((o) => ({
            text: o.label,
            onPress: () => submitReport(post, o.key),
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
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
      Alert.alert(t('common.error'), t('momGroup.bookmarkError'));
    }
  };

  const openComments = async (post: Post) => {
    setActivePost(post);
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
    if (containsBannedWord(body)) {
      Alert.alert(t('common.notice'), t('momGroup.bannedWordError'));
      return;
    }
    setPosting(true);
    try {
      await momGroupApi.createComment(activePost.id, body, false);
      setCommentContent('');
      const res = await momGroupApi.listComments(activePost.id);
      setComments((res.data.data as Comment[]) ?? []);
      setPosts((prev) => prev.map((p) =>
        p.id === activePost.id ? { ...p, commentCount: p.commentCount + 1 } : p,
      ));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('momGroup.submitError');
      Alert.alert(t('common.notice'), msg);
    }
    setPosting(false);
  };

  const handleDeleteComment = (c: Comment) => {
    Alert.alert(t('momGroup.deleteCommentTitle'), t('momGroup.deleteCommentConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive', onPress: async () => {
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

  // 빈 상태(no groupKey) 분기 제거 — myGroupKey가 currentMonthKey로 항상 fallback되므로 도달 불가

  /**
   * 게시글 리스트 행 — 베이비빌리/마미톡 톤 (평평한 흰 배경 + bottom divider)
   *   - 이벤트/공식/핀 글: 작은 chip 배지 + 매우 옅은 배경 틴트
   *   - 일반 글: 흰 배경
   *   - 우측: 댓글 카운트 버블 (베빌 스타일)
   */
  const renderBoardRow = (p: Post, _idx: number) => {
    const isBookmarked = bookmarkedIds.has(p.id);
    const categoryMeta = getCategoryMeta(t);
    const cat = categoryMeta[p.category] ?? categoryMeta.chat;
    const isPinTop = p.isPinned && p.isOfficial;
    // 강조 배경은 공지(공식)·고정 글에만. 전국 폴백 글(isFallback)은 '전국' 칩만 달고 배경은 일반과 동일.
    const isHighlight = isPinTop || p.isOfficial;

    return (
      <TouchableOpacity
        key={p.id}
        style={[
          styles.billyRow,
          isHighlight && styles.billyRowHighlight,
        ]}
        activeOpacity={0.6}
        onPress={() => openComments(p)}
      >
        {/* 좌측 이미지 미리보기 — 있을 때만, 작은 thumb */}
        {p.imageUrl ? (
          <Image
            source={{ uri: p.imageUrl }}
            style={styles.billyThumb}
            contentFit="cover"
          />
        ) : null}

        <View style={styles.billyRowMain}>
          {/* 1줄: 배지 + 제목 (한 줄 ellipsis) */}
          <View style={styles.boardTitleRow}>
            {isPinTop ? <View style={[styles.chip, styles.chipEvent]}><Text style={styles.chipEventText}>{t('momGroup.badgeEvent')}</Text></View> : null}
            {p.isOfficial && !isPinTop ? <View style={[styles.chip, styles.chipRecommend]}><Text style={styles.chipRecommendText}>{t('momGroup.badgeRecommend')}</Text></View> : null}
            {p.isFallback ? <View style={[styles.chip, styles.chipNation]}><Text style={styles.chipNationText}>{t('momGroup.badgeNationwide')}</Text></View> : null}
            <Text style={styles.boardTitle} numberOfLines={1} ellipsizeMode="tail">
              {displayTitle(t, p)}
            </Text>
          </View>

          {/* 2줄: 작성자 · 카테고리 */}
          <Text style={styles.boardAuthor} numberOfLines={1}>
            {p.anonymous ? t('momGroup.anonymous') : displayNickname(t, p.nickname)}
            <Text style={styles.boardCategory}> · {cat.label}</Text>
          </Text>

          {/* 3줄: 날짜 · 조회수 · 공감 */}
          <View style={styles.boardMetaRow}>
            <Text style={styles.boardMeta}>{compactDate(p.createdAt)}</Text>
            {p.viewCount > 0 ? <Text style={styles.boardMeta}>  {t('momGroup.viewCount', { count: p.viewCount })}</Text> : null}
            {p.likeCount > 0 ? <Text style={styles.boardMeta}>  {t('momGroup.likeCount', { count: p.likeCount })}</Text> : null}
            {isBookmarked ? <Text style={styles.boardMetaIcon}>  🔖</Text> : null}
          </View>
        </View>

        {/* 우측 댓글 카운트 버블 */}
        <View style={styles.commentBubble}>
          <Text style={styles.commentBubbleText}>{p.commentCount}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isFeed = viewMode === 'feed';
  const isBookmarkView = viewMode === 'bookmarks';
  const isMineView = viewMode === 'mine';
  const isHonorView = viewMode === 'honor';

  // 명예의 전당 / 익명 탭은 별도 API 없이 현재 페이지 posts 에서 파생.
  //   한계: 페이지네이션된 posts 중 현재 페이지만 필터링됨 → 출시 후 백엔드 인덱스/쿼리 보강 권장.
  //   honor: 인기 점수 = likeCount + commentCount * 2 ≥ HONOR_SCORE_THRESHOLD
  //   anonymous: anonymous === true
  const honorPosts = useMemo(
    () => posts
      .filter((p) => p.likeCount + p.commentCount * 2 >= HONOR_SCORE_THRESHOLD)
      .sort((a, b) =>
        (b.likeCount + b.commentCount * 2) - (a.likeCount + a.commentCount * 2),
      ),
    [posts],
  );
  const anonymousPosts = useMemo(
    () => posts.filter((p) => p.anonymous),
    [posts],
  );

  const list = isFeed
    ? posts
    : isBookmarkView
      ? bookmarkPosts
      : isMineView
        ? minePosts
        : isHonorView
          ? honorPosts
          : anonymousPosts;
  const isLoading = isFeed
    ? loading
    : isBookmarkView
      ? loadingBookmarks
      : isMineView
        ? loadingMine
        // honor / anonymous 는 posts 파생이므로 loading 상태 공유
        : loading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title={t('momGroup.headerTitle')}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <GuideButton onPress={() => setShowGuide(true)} />
            <TouchableOpacity
              style={styles.headerSearchBtn}
              onPress={() => setSearchExpanded((v) => !v)}
              hitSlop={8}
            >
              <Text style={styles.headerSearchIcon}>{searchExpanded ? '✕' : '🔍'}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* 검색 영역 — 헤더 우측 🔍 탭 시 펼침 */}
      {searchExpanded && isFeed && (
        <View style={styles.searchExpandedWrap}>
          <View style={styles.searchFieldRow}>
            {(
              [
                { key: 'all', label: t('momGroup.searchFieldAll') },
                { key: 'title', label: t('momGroup.searchFieldTitle') },
                { key: 'content', label: t('momGroup.searchFieldContent') },
                { key: 'nickname', label: t('momGroup.searchFieldNickname') },
              ] as { key: 'all' | 'title' | 'content' | 'nickname'; label: string }[]
            ).map((opt) => {
              const active = searchField === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.searchFieldChip, active && styles.searchFieldChipActive]}
                  onPress={() => setSearchField(opt.key)}
                >
                  <Text style={[styles.searchFieldChipText, active && styles.searchFieldChipTextActive]}>
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
                searchField === 'title' ? t('momGroup.searchPlaceholderTitle')
                : searchField === 'content' ? t('momGroup.searchPlaceholderContent')
                : searchField === 'nickname' ? t('momGroup.searchPlaceholderNickname')
                : t('momGroup.searchPlaceholderAll')
              }
              placeholderTextColor={COLORS.textSecondary}
              value={searchInput}
              onChangeText={setSearchInput}
              returnKeyType="search"
              onSubmitEditing={() => setSearchQuery(searchInput.trim())}
              autoFocus
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
        </View>
      )}

      {/* 방 타입 탭 (지역방 deprecated — 내 동네 radius 모드로 대체) */}
      <View style={styles.roomTabRow}>
        {(['month', 'radius'] as const).map((roomTypeItem) => (
          <TouchableOpacity
            key={roomTypeItem}
            style={[styles.roomTab, roomType === roomTypeItem && styles.roomTabActive]}
            onPress={() => switchRoomType(roomTypeItem)}
          >
            <Text
              style={[styles.roomTabText, roomType === roomTypeItem && styles.roomTabTextActive]}
              numberOfLines={1}
            >
              {roomTypeItem === 'month' ? t('momGroup.roomTypeMonth') : t('momGroup.roomTypeNearby')}
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
            {getRadiusTabs(t).map((r) => {
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
                {t('momGroup.locationPrompt')}
              </Text>
            </TouchableOpacity>
          )}
          {/* 등록된 위치 + 변경 버튼 */}
          {radiusKey !== 0 && hasLocation === true && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationInfoText} numberOfLines={1}>
                {t('momGroup.locationCurrentLabel')}
                <Text style={styles.locationInfoStrong}>
                  {locationLabel || t('momGroup.locationRegisteredFallback')}
                </Text>
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(main)/mom-location-setup')}
                style={styles.locationChangeBtn}
                hitSlop={8}
              >
                <Text style={styles.locationChangeText}>{t('common.change')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* 동갑 ±N 살 선택 */}
          {myBabyBirthYear && (
            <View style={styles.ageRangeRow}>
              <Text style={styles.ageRangeLabel}>{t('momGroup.ageDifferenceLabel')}</Text>
              <View style={styles.ageRangeChips}>
                {([0, 1, 2] as const).map((d) => {
                  const active = ageRange === d;
                  const label = d === 0 ? t('momGroup.sameAge') : t('momGroup.ageRangePlusMinus', { n: d });
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
                  ? t('momGroup.matchSameAge', { year: myBabyBirthYear })
                  : t('momGroup.matchRange', { from: targetBirthYears[0], to: targetBirthYears[targetBirthYears.length - 1] })}
              </Text>
            </View>
          )}
        </View>
      ) : roomType === 'month' && groupKey ? (
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={[styles.monthArrow, !canGoPrev && { opacity: 0.25 }]}
            onPress={() => canGoPrev && setGroupKey(shiftGroupKey(groupKey, -1))}
            disabled={!canGoPrev}
          >
            <Text style={styles.monthArrowText}>{'‹'}</Text>
          </TouchableOpacity>
          <View style={styles.monthCenter}>
            <Text style={styles.monthTitle}>{formatGroupLabel(t, groupKey)}</Text>
            {myGroupKey && groupKey !== myGroupKey && (
              <TouchableOpacity onPress={() => setGroupKey(myGroupKey)}>
                <Text style={styles.monthReset}>{t('momGroup.resetToMyMonth', { month: formatMonthOnly(t, myGroupKey) })}</Text>
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
      ) : null}

      {/* 카테고리 필터 제거 — 사용자 요청 */}

      {/* 정렬 + 북마크 + 내 글 — 가로 스크롤 1줄 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sortRow}
        contentContainerStyle={styles.sortRowContent}
      >
        <TouchableOpacity
          style={[styles.sortBtn, isFeed && sortMode === 'recent' && styles.sortBtnActive]}
          onPress={() => { setViewMode('feed'); setSortMode('recent'); }}
        >
          <Text style={[styles.sortText, isFeed && sortMode === 'recent' && styles.sortTextActive]}>🕒 {t('momGroup.sortRecent')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, isFeed && sortMode === 'popular' && styles.sortBtnActive]}
          onPress={() => { setViewMode('feed'); setSortMode('popular'); }}
        >
          <Text style={[styles.sortText, isFeed && sortMode === 'popular' && styles.sortTextActive]}>🔥 {t('momGroup.sortPopular')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, isHonorView && styles.sortBtnActive]}
          onPress={() => setViewMode(isHonorView ? 'feed' : 'honor')}
        >
          <Text style={[styles.sortText, isHonorView && styles.sortTextActive]}>
            🏆 {t('momGroup.sortHonor')} {honorPosts.length > 0 ? `(${honorPosts.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, isBookmarkView && styles.sortBtnActive]}
          onPress={() => setViewMode(isBookmarkView ? 'feed' : 'bookmarks')}
        >
          <Text style={[styles.sortText, isBookmarkView && styles.sortTextActive]}>
            🔖 {t('momGroup.sortBookmark')} {bookmarkedIds.size > 0 ? `(${bookmarkedIds.size})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, isMineView && styles.sortBtnActive]}
          onPress={() => setViewMode(isMineView ? 'feed' : 'mine')}
        >
          <Text style={[styles.sortText, isMineView && styles.sortTextActive]}>
            👤 {t('momGroup.sortMine')} {minePosts.length > 0 ? `(${minePosts.length})` : ''}
          </Text>
        </TouchableOpacity>
      </ScrollView>

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
                ? t('momGroup.emptyBookmarks')
                : isMineView
                  ? t('momGroup.emptyMine')
                  : searchQuery
                    ? t('momGroup.emptySearchResult', { query: searchQuery })
                    : categoryFilter
                      ? t('momGroup.emptyCategory')
                      : roomType === 'radius' && hasLocation
                        ? t('momGroup.emptyRadius', { area: radiusKey === 0 ? t('momGroup.radius.nationwide') : t('momGroup.radiusKmArea', { km: radiusKey }) })
                        : t('momGroup.emptyFirstPost')}
            </Text>
            {/* radius 모드에서 빈 화면이면 다음 반경 제안 */}
            {roomType === 'radius' && !isBookmarkView && !isMineView && !searchQuery && !categoryFilter && (
              <View style={styles.expandRow}>
                {(() => {
                  const sequence: RadiusKey[] = [5, 10, 50, 100, 0];
                  const idx = sequence.indexOf(radiusKey);
                  const nextOptions = sequence.slice(idx + 1);
                  return nextOptions.slice(0, 2).map((next) => {
                    const meta = getRadiusTabs(t).find((r) => r.key === next);
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
                          {t('momGroup.expandViewLabel', { label: meta.label, countSuffix: count > 0 ? ` (${count})` : '' })}
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
            {/* 모던 리스트 — 표형 헤더 제거됨 */}
            <View style={{ height: 6 }} />
            {list.map((p, i) => renderBoardRow(p, i))}
            {/* 페이지네이션 (feed 모드만) */}
            {isFeed && totalPages > 1 && (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  onPress={() => page > 1 && setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>‹ {t('momGroup.pagePrev')}</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {page} / {totalPages}
                  {totalCount > 0 ? ` · ${t('momGroup.pageTotalCount', { count: totalCount })}` : ''}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                  onPress={() => page < totalPages && setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextDisabled]}>{t('momGroup.pageNext')} ›</Text>
                </TouchableOpacity>
              </View>
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
          <Text style={styles.fabText}>✏️ {t('momGroup.writeButton')}</Text>
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
                <Text style={styles.backBtn}>{`< ${t('common.close')}`}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingPostId ? t('momGroup.editPostTitle') : t('momGroup.newPostTitle', { roomLabel: roomLabel(t, roomType, groupKey ?? '', radiusKey, ageRange) })}
              </Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {/* 카테고리 UI 제거 — 내부적으로 'chat' 기본 */}

              {/* 제목 */}
              <Text style={styles.writeLabel}>{t('momGroup.titleLabel')}</Text>
              <TextInput
                style={styles.titleInput}
                placeholder={t('momGroup.titlePlaceholder')}
                placeholderTextColor={COLORS.textSecondary}
                value={writeTitle}
                onChangeText={setWriteTitle}
                maxLength={50}
                returnKeyType="next"
              />
              <Text style={styles.writeCount}>{writeTitle.length} / 50</Text>

              {/* 내용 */}
              <Text style={styles.writeLabel}>{t('momGroup.contentLabel')}</Text>
              <TextInput
                style={styles.writeInput}
                placeholder={writePlaceholder(t, roomType)}
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
                    <Text style={styles.imageRemoveText}>✕ {t('momGroup.removePhoto')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePickBtn} onPress={pickImage}>
                  <Text style={styles.imagePickText}>📷 {t('momGroup.attachPhoto')}</Text>
                </TouchableOpacity>
              )}

              {/* 상단 고정 토글 (공식 계정만) */}
              {isOfficialUser && (
                <View style={styles.anonRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.anonTitle}>📌 {t('momGroup.pinToTop')}</Text>
                    <Text style={styles.anonDesc}>{t('momGroup.pinToTopDesc')}</Text>
                  </View>
                  <Switch
                    value={writePinned}
                    onValueChange={setWritePinned}
                    trackColor={{ false: '#D1D5DB', true: '#90CAF9' }}
                    thumbColor={writePinned ? '#1976D2' : '#F3F4F6'}
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
                  <Text style={styles.submitBtnText}>{editingPostId ? t('momGroup.editComplete') : t('momGroup.publish')}</Text>
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
                <Text style={styles.backBtn}>{`< ${t('common.close')}`}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('momGroup.postDetailTitle')}</Text>
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
                  <View style={[styles.postCatBadge, { backgroundColor: (getCategoryMeta(t)[activePost.category] ?? getCategoryMeta(t).chat).bg }]}>
                    <Text style={[styles.postCatText, { color: (getCategoryMeta(t)[activePost.category] ?? getCategoryMeta(t).chat).color }]}>
                      {(getCategoryMeta(t)[activePost.category] ?? getCategoryMeta(t).chat).emoji} {(getCategoryMeta(t)[activePost.category] ?? getCategoryMeta(t).chat).label}
                    </Text>
                  </View>
                  <Text style={styles.postTime}>
                    {timeAgo(t, activePost.createdAt)}
                    {activePost.isEdited ? ` · ${t('momGroup.editedSuffix')}` : ''}
                  </Text>
                </View>
                {activePost.title ? (
                  <Text style={styles.detailTitle}>
                    {activePost.isOfficial ? <Text style={styles.officialBadgeInline}>{t('momGroup.officialBadge')} </Text> : null}
                    {activePost.isFallback ? <Text style={styles.fallbackBadgeInline}>{t('momGroup.nationwidePopularBadge')} </Text> : null}
                    {activePost.title}
                  </Text>
                ) : null}
                {activePost.isOfficial ? (
                  <View style={styles.officialBanner}>
                    <Text style={styles.officialBannerText}>📌 {t('momGroup.officialBannerText')}</Text>
                  </View>
                ) : null}
                <Text style={styles.postNickname}>
                  {displayNickname(t, activePost.nickname)}
                  {activePost.isOfficial ? <Text style={styles.officialCheck}> ✓ {t('momGroup.officialBadge')}</Text> : null}
                  {activePost.anonymous ? ` · ${t('momGroup.anonymous')}` : ''}
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
                    <Image
                      source={IC_HEART}
                      style={[styles.actionIcon, likedIds.has(activePost.id) && styles.actionIconLiked]}
                      contentFit="contain"
                    />
                    <Text style={[styles.postActionText, likedIds.has(activePost.id) && styles.postActionTextLiked]}>
                      {activePost.likeCount}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postActionWithIcon} onPress={() => handleToggleBookmark(activePost)}>
                    <Image source={IC_BOOKMARK} style={styles.actionIcon} contentFit="contain" />
                    <Text style={styles.postActionText}>
                      {bookmarkedIds.has(activePost.id) ? t('momGroup.saved') : t('momGroup.bookmark')}
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
                        <Text style={styles.postActionText}>✏️ {t('common.edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.postAction} onPress={() => handleDeletePost(activePost)}>
                        <Text style={styles.postActionTextDanger}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.postAction} onPress={() => handleReport(activePost)}>
                        <Text style={styles.postActionTextMuted}>🚩 {t('momGroup.report')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.postAction} onPress={() => handleBlockUser(activePost)}>
                        <Text style={styles.postActionTextDanger}>🚫 {t('momGroup.block')}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )}

            <View>
              {loadingComments ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
              ) : comments.length === 0 ? (
                <Text style={styles.emptyComment}>{t('momGroup.emptyComments')}</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentNickname}>
                        {displayNickname(t, c.nickname)}
                        {c.isOfficial ? <Text style={styles.officialCheck}> ✓ {t('momGroup.officialBadge')}</Text> : null}
                        {c.anonymous ? ` · ${t('momGroup.anonymous')}` : ''} · {timeAgo(t, c.createdAt)}
                      </Text>
                      <Text style={styles.commentText}>{c.content}</Text>
                    </View>
                    {c.isMine && (
                      <TouchableOpacity onPress={() => handleDeleteComment(c)}>
                        <Text style={styles.postActionTextDanger}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
            </ScrollView>

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder={t('momGroup.commentPlaceholder')}
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
                {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.commentSendText}>{t('momGroup.send')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AdSlot />

      {/* 첫 진입 가이드 — 스포트라이트 코치마크 (앱 공용 GuideCarousel). */}
      <GuideCarousel visible={showGuide} pages={momGroupGuide} onClose={closeGuide} onComplete={closeGuide} />
    </View>
  );
}

const styles = StyleSheet.create({
  // ── 가이드맵 (첫 진입 모달) ──────────────────────────────
  guideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  guideCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  guideTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  guideEmoji: { fontSize: 56, marginVertical: 12 },
  guideDesc: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  guideDots: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  guideDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  guideDotActive: { backgroundColor: COLORS.primary, width: 24 },
  guideBtnRow: { flexDirection: 'row', width: '100%', gap: 10 },
  guideBtnSecondary: {
    flex: 1, height: 48,
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
  },
  guideBtnSecondaryText: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textSecondary,
  },
  guideBtnPrimary: {
    flex: 1, height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  guideBtnPrimaryText: {
    fontSize: FONT_SIZE.md, fontWeight: '700', color: '#FFF',
  },
  container: { flex: 1, backgroundColor: '#F4F8FB' }, // 산뜻한 라이트 블루-그레이 (Notion/Linear 톤)
  // ── 모던 리스트 행 ──────────────────────────────────────
  // outer: shadow + radius 컨테이너 (LinearGradient 위 layer)
  modernRowOuter: {
    marginHorizontal: 8,
    marginBottom: 3,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#88A0B8',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  modernRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingRight: 10,
  },
  // (deprecated — gradient로 대체)
  modernRowPinned: {},
  modernRowFallback: {},
  modernLeftBar: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: 8,
  },
  modernContent: { flex: 1, justifyContent: 'center' },
  modernTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  modernPinIcon: { fontSize: 9 },
  modernCatText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  modernOfficialChip: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#42A5F5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 3,
    overflow: 'hidden',
  },
  modernFallbackChip: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#9575CD',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 3,
    overflow: 'hidden',
  },
  modernTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modernMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  modernAuthor: {
    fontSize: 9.5,
    color: '#999',
    fontWeight: '500',
    maxWidth: 70,
  },
  modernDot: { fontSize: 9, color: '#DDD', marginHorizontal: 2 },
  modernTime: { fontSize: 9.5, color: '#999' },
  modernIcon: { fontSize: 9, color: '#BBB', marginLeft: 2 },
  modernActions: {
    alignItems: 'flex-end',
    marginLeft: 4,
    minWidth: 38,
  },
  modernCount: {
    fontSize: 9,
    color: '#999',
    fontWeight: '600',
    marginVertical: 0,
  },
  // ── /모던 리스트 행 ─────────────────────────────────────

  // ── 게시글 리스트 (베빌 톤) ────────────────────────────
  billyRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFEFF1',
    alignItems: 'center',
  },
  billyRowHighlight: {
    backgroundColor: '#FFF8F4', // 매우 옅은 코랄 틴트 — 강조 글
  },
  billyRowMain: { flex: 1, paddingRight: 10 },
  billyThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  boardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 2,
  },
  chipEvent: { backgroundColor: '#FFE4E6' },
  chipEventText: { fontSize: 11, color: '#E11D48', fontWeight: '600' },
  chipRecommend: { backgroundColor: '#EDE9FE' },
  chipRecommendText: { fontSize: 11, color: '#6D28D9', fontWeight: '600' },
  chipNation: { backgroundColor: '#E0F2FE' },
  chipNationText: { fontSize: 11, color: '#0369A1', fontWeight: '600' },
  boardTitle: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    fontWeight: '500',
  },
  boardAuthor: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
    fontWeight: '400',
  },
  boardCategory: { color: '#9CA3AF', fontWeight: '400' },
  boardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  boardMeta: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  boardMetaIcon: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  commentBubble: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  commentBubbleText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  // ── /게시글 리스트 ──────────────────────────────────────
  // ── 헤더 검색 아이콘 + 펼침 영역 ───────────────────────
  headerSearchBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSearchIcon: { fontSize: 18 },
  searchExpandedWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  // ── /헤더 검색 ─────────────────────────────────────────
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
  monthArrowText: {
    fontSize: 20, fontWeight: '600', color: '#AD1457',
    lineHeight: 22, textAlign: 'center', textAlignVertical: 'center',
    includeFontPadding: false, width: 20,
  },
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
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexGrow: 0, flexShrink: 0,
  },
  sortRowContent: {
    flexDirection: 'row', gap: 3, alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  sortBtn: {
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center',
  },
  sortBtnActive: { backgroundColor: '#F8BBD0', borderColor: '#E91E63' },
  sortText: {
    fontSize: FONT_SIZE.xs, lineHeight: 18, color: COLORS.textSecondary, fontWeight: '600',
  },
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
    fontWeight: '700',
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
  officialSubLabel: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
    marginTop: 2,
  },
  officialBanner: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 3,
    borderLeftColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 6,
  },
  officialBannerText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '600',
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
  actionIconLiked: { tintColor: '#E91E63' },

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
    fontSize: 18, fontWeight: '600', color: COLORS.text,
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
  postActionTextLiked: { color: '#E91E63', fontWeight: '700' },
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
