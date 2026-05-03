# 아맞다(A-matda) 개발 진행 현황
> 최종 업데이트: 2026-05-03

---

## 2026-05-03 — 알람·인증 안정화 + 맘스톡 전면 개편 + Pretendard 폰트

대규모 작업일 — 핵심 fix + 새 기능 + UI 재설계 모두 진행.

### A. 알람/인증 안정화 (오전)

**알람 누수 정리** — 임신부 모드 삭제/출생 전환 시 잔여 알람 해결
- `frontend/services/pushNotifications.ts`
  - `cancelAllPregnancyLocalNotifications()`에 `cancelDailyMissionReminder()` 호출 추가 (이전엔 검진 알림만 취소했음)
  - `cancelAllLocalNotifications()` 신규 — 로그아웃/계정삭제 시 모든 예약 알림 + AsyncStorage 알림 키 일괄 정리
  - `runOneTimeOrphanCleanup()` — OLD 코드(cascade 누락) 잔여 알람 1회 청소 후 영구 no-op (AsyncStorage 플래그)
- `frontend/app/_layout.tsx`
  - 부팅 시 `runOneTimeOrphanCleanup` 호출
- `frontend/app/(main)/home.tsx`
  - 임신→출생 전환 시 임신 알람 일괄 취소 + 육아 알림 자동 등록 (`syncScheduledNotifications` + `scheduleFirstCoachingNudge`)

**카카오 SDK 디바이스 정리** — 계정삭제 시 앱 크래시 fix
- `frontend/services/social-auth.ts`
  - `clearAllSocialSessions()` 신규 — 카카오/네이버/구글 SDK logout만 호출 (unlink는 서버가 이미 처리해서 디바이스에서 재시도 시 네이티브 크래시 발생했음)
  - 모든 SDK 호출에 3초 타임아웃 보호
- `frontend/app/(main)/profile.tsx`
  - 로그아웃: 즉시 로컬 정리 → 리다이렉트 → SDK 정리는 fire-and-forget
  - 계정삭제: 백엔드 호출 → 로컬 정리 → 리다이렉트 → SDK 정리 fire-and-forget

**삭제된 계정 토큰 → 401** — 잔존 토큰 OTA 다이얼로그 무한 루프 fix
- `backend/src/routes/auth.ts` (`/me`)
- `backend/src/routes/subscription.ts` (`/premium/status`, `/premium/start-trial`)
- 모두 "사용자 없음" 응답을 **404 → 401**로 변경 → axios interceptor가 자동 logout 처리

**자녀 미등록 사용자 접근성**
- `frontend/app/(main)/home.tsx` — EmptyState에 "맘스톡 둘러보기" + "프로필" 보조 버튼 추가
- `frontend/app/(main)/mom-group.tsx` — 자녀 없으면 현재 월(YYYY-MM)을 myGroupKey로 fallback → 월방 진입 가능

### B. 맘스톡 공식 계정 시스템 (오후)

**isOfficial 기반 권한**
- `backend/src/routes/auth.ts` — `/auth/me` 응답에 `isOfficial` 필드 추가
- `backend/src/routes/mom-group.ts`
  - 게시글 생성 시 `isOfficial`을 user에서 denormalize 저장 (조회 비용 0)
  - 댓글에도 동일 적용
  - 익명 게시글에는 isOfficial 노출 안 함 (정체성 보호)

**전국 노출 + 핀**
- `/posts/radius`: 위치 무관 모든 공식 글 합류 (반경 필터 무시)
- `/posts` (월방): 모든 공식 글 합류 (월 무관)
- `/posts/radius` 폴백: 로컬 글 < 5개 시 전국 인기글 자동 채움
- `isPinned` 필드: 공식 계정만 설정 가능 (백엔드 검증), 최대 3개 최상단 고정
- `frontend/services/api.ts`: `createPost`/`updatePost`에 `isPinned` 파라미터 추가

**글쓰기 모달 UI**
- `frontend/app/(main)/mom-group.tsx`
  - 공식 계정 + 익명 OFF일 때만 "📌 상단 고정" 토글 노출
  - `isOfficialUser` 상태 — 마운트 시 `authApi.getProfile()`로 1회 조회

**Firestore 인덱스 7개 추가**
- `firestore.indexes.json`:
  - `momGroupPosts`: `hidden + lat`
  - `momGroupPosts`: `hidden + babyBirthYear + lat`
  - `momGroupPosts`: `hidden + category + lat`
  - `momGroupPosts`: `isOfficial + hidden`
  - `momGroupPosts`: `isOfficial + hidden + category`
  - `momGroupPosts`: `isOfficial + hidden + babyBirthYear`
  - `momGroupPosts`: `hidden + createdAt` (폴백 인기 쿼리용)

**시드 게시글 스크립트**
- `backend/scripts/seed-official-posts.cjs` 신규
- 정보 6 / 질문 2 / 수다 1 / 축하 1 = 총 10개
- `_seedKey` 마커로 멱등성 (재실행 시 중복 X)
- 실행: `node scripts/seed-official-posts.cjs --apply`

### C. 맘스톡 UI 전면 개편

**임신부 35주+ UX 고도화 (홈)**
- `frontend/components/home/DenseStatsRow.tsx`
  - "오늘?" → "기록", "입력하기" → "입력" (행동 중심 라벨)
  - mood에 "속불편" 추가 (후기 입덧 사라진 사용자 공감)
- `frontend/stores/uiStore.ts` 신규 — overlay 카운터 (모달 활성 시 SOS FAB 자동 숨김)
- `frontend/app/(main)/home.tsx`
  - 35주+ 임신부: DailyMissionBadges 우선 노출 → BirthBag → 여정 → 퀵메뉴 순서
  - DailyMissionBadges는 import만 되어 있고 어디서도 렌더링 안 되던 dead component였음
  - SOS FAB은 `useUiStore.overlayCount === 0`일 때만 렌더

**모던 리스트 UI (맘스톡)**
- `frontend/app/(main)/mom-group.tsx`
  - 표 형식(번호/제목/작성자/날짜/조회/♥) 완전 폐기
  - LinearGradient 카드 (Threads 스타일, 위→아래 화이트로 페이드)
  - 카테고리 색 산뜻하게: Material 800/900 → 400/500
    - 질문 #1565C0 → #29B6F6 (스카이)
    - 수다 #AD1457 → #EC407A (밝은 핑크)
    - 정보 #2E7D32 → #66BB6A (그린)
    - 고민 #E65100 → #FFA726 (오렌지)
    - 축하 #6A1B9A → #AB47BC (라벤더)
  - 컨테이너 배경: 베이지 → #F4F8FB (라이트 블루-그레이)
  - 카드 둥근 모서리 12px → 16px
  - 카드 그림자 산뜻한 블루-그레이 (#88A0B8 10% opacity)
  - 좌측 액센트 바 4px (핀=피치, 공식=스카이, 일반=카테고리색)
  - 공식/전국 칩 색 산뜻하게 (#42A5F5 / #9575CD)

**검색 위치 개선**
- 페이지 하단 (못 찾는 위치) → 헤더 우측 🔍 아이콘
- 탭 시 펼침, 인스타·스레드 표준
- autoFocus 적용

**상태 맵핑 버그 fix**
- `switchRoomType` 시 `viewMode='feed'` + `searchQuery=''` 자동 리셋 (북마크 상태에서 방 바꾸는 모순 제거)
- 죽은 'region' 픽커 코드 완전 제거 (실제로 도달 불가능했음)
- '지역방으로 둘러보기' 빈 상태 제거 (groupKey가 currentMonthKey로 항상 fallback돼서 도달 X)

### D. Pretendard 폰트 전역 적용

**설치/번들**
- `expo-font` 설치 (~14.0.11)
- `frontend/assets/fonts/`에 Pretendard 4 weights (Regular/Medium/SemiBold/Bold) 배치 (~6.4MB)
- `frontend/app.config.js` plugins에 expo-font 등록 (다음 APK 빌드부터 native 임베드)
- 현재 OTA용: `useFonts` + `require()`로 JS 번들 포함

**자동 weight 매핑** (정석)
- `frontend/app/_layout.tsx`에 Text/TextInput.render monkey-patch
- fontWeight에 따라 자동으로 Pretendard 변형 선택 (700→Bold, 600→SemiBold, 500→Medium, 그 외→Regular)
- 기존 모든 Text 컴포넌트가 코드 변경 없이 자동 Pretendard 적용
- 사용자 style이 우선 (override 가능)
- `useFonts` 훅으로 로드 완료 대기 → 미완료 시 ActivityIndicator (FOUT 방지)

### 검증
- `cd backend && npx tsc --noEmit` ✅ EXIT=0
- `cd frontend && npx tsc --noEmit` ✅ EXIT=0
- 백엔드 배포: 여러 차례 (보안 24파일 + analyze 로깅 + isOfficial + 폴백 + 핀 + 401 fix)
- 프론트 OTA: ~15회 배포 (preview 채널)
- Firestore 인덱스 배포 완료

### 남은 이슈/메모
- **APK 재빌드 권장** — Pretendard 폰트 native 임베드 (현재는 OTA로 JS 번들 6.4MB 추가 — 첫 다운로드 느림)
- 운영자가 시드 글 작성: `cd backend && node scripts/seed-official-posts.cjs --apply` 실행 필요
- Firestore 인덱스 빌드 ~1-5분 (자동 활성화 후 radius 폴백 정상 동작)
- 공식 계정 운영 가이드: Firestore Console에서 `users/{uid}.isOfficial: true` 수동 설정

---

## 2026-05-01 — 홈 UX 정리 + 임신부 맞춤추천 분기 + 톤 통일

### 변경 파일
- `frontend/app/(main)/home.tsx` — DailyTipBanner 제거, RecommendationSection 임신부 분기, addChildBanner 톤다운, 헤더 아이콘 3D 그림자/간격
- `frontend/components/home/DailyTipBanner.tsx` — 삭제
- `frontend/components/home/useBabyDailyTip.ts` — 삭제
- `frontend/app/(main)/recommendations.tsx` — 임신부 4 카테고리(임산부음식·운동/요가·태교·출산용품), 트라이메스터별 설명 분기
- `frontend/app/(main)/recommendation-list.tsx` — 임신부면 ageGroup을 pregnant_early/mid/late로 송신, CATEGORY_STYLE에 임신부 카테고리 추가
- `backend/src/data/recommendation-seeds.ts` — 임신부 시드 12개 추가 (4 카테고리 × 3 트라이메스터)

### 작업 목적
- "오늘 기록을 시작해 보세요" 일줄 배너가 퀵메뉴(아기시간)와 중복 → 삭제
- 임신부에게 "음식·놀이·학원·책" 추천이 맞지 않음 → 임산부 카테고리 + 주차별 콘텐츠
- "내 아이 정보 추가하기" 진한 오렌지 단독 배너가 앱 톤과 어색 → 파스텔 피치로 통일
- 헤더 진통체크/벨/설정 아이콘 높이/간격 불일치 + 입체감 부족

### 검증
- `cd backend && npx tsc --noEmit` ✅ EXIT=0
- `cd frontend && npx tsc --noEmit` ✅ EXIT=0
- `cd frontend && npx expo lint` ✅ 0 errors (97 pre-existing warnings)

### 남은 이슈
- 임신부 시드 데이터는 첫 호출 시 캐시 미존재 → seed 폴백 사용. POST `/api/recommendations/seed` 호출하면 Firestore에 캐싱됨
- "전부 입체감" 요청은 헤더 아이콘 위주로 적용. 다른 위치(PregnancyJourneyCard, MonthlyChar 등)는 추가 요청 시 진행 가능

---

## 2026-05-01 — albumPhotos 마이그레이션 + 알림/UI 대규모 개편 + APK v2.9.0 빌드 + 홈 V3 Dashboard

### 배경
- 출시 동결 해제(4-30) 후 14일 내 출시 위해 회귀·UX·인프라 일괄 정리
- 베타 테스터 피드백 + Play Store 패키지명 변경 후 OAuth/SHA-1 수정 + 임신부/영아 모드별 home UX 차별화

### 1) albumPhotos 컬렉션 통합 (Rule of Two 승인 후 진행)

#### 배경
- 옛: `pregnancyRecords`(임신 기록 + 사진) + `milestonePhotos`(출생 후 사진) 두 컬렉션
- album.ts PDF 생성 시 read-time merge로 통합 출력 (C-1 안전버전 동작 중)
- 출시 후 마이그레이션은 사용자 데이터 손상 위험 → 베타(테스터 5명, 27 docs) 시점에 통합

#### 진행 절차 (정석 zero-downtime migration)
1. **백업**: 로컬 JSON + Firebase Storage (`gs://amatda-parenting.firebasestorage.app/firestore-backup-2026-04-30/`)
2. **Audit**: 27 docs 전체 무결성 확인 (ERROR 0, WARN 0)
3. **인덱스 배포**: `albumPhotos` (childId+date / childId+phase+createdAt)
4. **실 마이그레이션**: 27 docs → albumPhotos (옛 ID 보존, emoji 백필 14건 동시 처리)
5. **Backend dual-write**:
   - `routes/album.ts` — POST/GET/DELETE/PDF generate (옛 milestonePhotos + 새 albumPhotos 양쪽 쓰기, read는 albumPhotos)
   - `routes/pregnancy.ts` — POST/GET/DELETE/timeline (옛 pregnancyRecords + 새 albumPhotos 양쪽 쓰기)
   - `routes/child.ts`, `routes/auth.ts` — cascade delete에 albumPhotos 추가
   - `services/coaching/auto.diary.ts` — pregnancy 기록 조회를 albumPhotos로
6. **백엔드 배포** + 라우트 시뮬레이션 검증 (모든 phase 정상)

#### 통합 스키마 (`albumPhotos`)
```ts
{
  userId, childId,
  phase: 'pregnancy' | 'baby',
  uri, printUrl, mediaType,
  title, content, milestoneType, milestoneEmoji, milestoneColor,
  date (YYYY-MM-DD), monthKey (YYYY-MM), createdAt (Timestamp),
  week, pregnancyType,
  _sourceCollection, _sourceId, _migratedAt,
}
```

#### 7번 emoji 백필 흡수
- 옛 pregnancyRecords의 14건 `milestoneEmoji=null` → frontend `ALL_MILESTONES`(20개) + backend `AUTO_MILESTONES`(10개) + `PREG_TYPE_EMOJI` 매핑으로 100% 백필
- `prenatal_vitamins → 💊`, `first_visit → 🏥` 등

#### 마이그레이션 스크립트
- `backend/scripts/migrate-album-photos/00-count.cjs` — 카운트
- `01-backup.cjs` — 로컬 백업
- `01b-upload-backup-to-storage.cjs` — Cloud Storage 업로드
- `02-dry-run.cjs` — 변환 시뮬레이션
- `02b-full-audit.cjs` — 무결성 검증
- `03-migrate.cjs` — 실 마이그레이션
- `04-verify-routes.cjs` — 라우트 동작 검증

### 2) 알림 버그 fix — 삭제된 자녀 알림 잔류

#### 원인
- `pushNotifications.ts` 모든 schedule 함수가 `childName`을 body에 넣지만 `data.childId`는 안 넣음
- `cancelAllChildLocalNotifications`가 `data.childId === childId` 매칭에만 의존 → 100% 실패
- `ScheduledIds` 전역 키(morning/afternoon/evening/weekly/coachingFollowup/reengagement) 자녀 삭제 시 정리 안 함

#### 수정
- 모든 schedule 함수에 `childId`, `childName` 매개변수 추가, `data.childId` 박힘
- `cancelAllChildLocalNotifications` 강화:
  1. ScheduledIds 전역 키 모두 cancel + clear
  2. FIRST_COACHING_KEY, amatda_nextday_nudge 정리
  3. data.childId 매칭 + childName fallback (옛 알림 안전망)
- 호출자 5개 파일 업데이트 (_layout, chatbot, profile, child-edit, notification-settings)

#### 추가 fix (열나열나)
- 체온 전체 삭제 시 `useFeverStore.bump()` 호출 추가 → home 펄스 즉시 해제

### 3) fever.tsx (열나열나) 전면 재설계

#### 사용자 요청 5가지
1. 정보 다이어트: 단일 행동 카드만 강조
2. 폰트 크기 혁명: 권장 복용량 56pt → **110pt** 거대 표시
3. 2x2 약 그리드: 타이레놀/챔프/부루펜/맥시부펜
4. 챔프 빨강/파랑 토글 (아세트아미노펜/이부프로펜 오복용 방지)
5. 시간 입력: DateTimePicker(다이얼) → 숫자 키패드 + '지금' 버튼
6. 광고 슬롯 placeholder ('엄마를 위한 팁' 톤, 현재 미노출)

#### 신규 컴포넌트
- `FastTimeInput` — 오전/오후 토글 + 시·분 숫자 입력 + '지금' 1탭

### 4) APK v2.9.0 빌드 (com.sylabs.amatda)

#### 배경
- Play Store 등록 시 옛 패키지(`com.amatda.app`) 충돌로 새 패키지(`com.sylabs.amatda`) 변경 (사용자 작업)
- 빌드 4회 실패/재시도 후 성공

#### 빌드 시도
1. **#1 실패** (`81646a1e`): `processReleaseGoogleServices` — google-services.json에 com.sylabs.amatda 매핑 없음
2. **#2 실패** (`75f0602e`): `eas env:update` 명령이 file env를 손상시킴 (preview env에서 사라짐)
3. **#3 성공** (`191cd945`): `eas env:create --force`로 재업로드 → 빌드 성공
4. **#4 성공** (`a63cb8d8`): 새 SHA-1 google-services.json 반영, 백업 APK

#### SHA-1 매핑 fix
- 실제 EAS keystore SHA-1: `F8:46:ED:C0:70:04:C8:D4:33:94:BE:84:48:66:BD:9F:FE:9F:96:D4`
- 사용자가 옛 SHA-1(`A0:6C:19:...`)을 콘솔에 등록한 상태였음
- Firebase Console에서 새 SHA-1 자동 등록 → 새 google-services.json 다운로드 → EAS file env 재업로드
- Google Cloud Console OAuth Android Client 자동 동기화 (Firebase가 처리)
- Kakao keyHash 사용자가 등록 (`+EbtwHAEyNQzlL6ESGa9n/6fltQ=`)
- Naver는 기존 등록값 유지

### 5) 홈 V3 Dashboard (영아/임신부 모드 자동 분기)

#### 신규 컴포넌트 5개
- `components/home/DenseStatsRow.tsx` — 4-stat 그리드 (모드 자동 분기)
  - 영아: 수유 / 수면 / 대변 / 키체중 percentile
  - 임신부: 물(클릭 +1) / 영양제(토글) / 다음검진 D-day / 오늘 컨디션(4-mood)
  - 단일 카드에 4 column + 디바이더 (mockup 통합 스타일)
- `components/home/DailyTipBanner.tsx` — 노란 알림 배너
- `components/home/AIAnalysisRow.tsx` — AI 분석 3-카드 (한 카드 안 통합)
- `components/home/TraitBarsCard.tsx` — 기질 5막대 (영아 only)
- `components/home/PregnancyJourneyCard.tsx` — 임신 여정 5단계 (임신부 only, 클릭 → 상세)
- `components/home/NextCheckupModal.tsx` — 다음 검진 일정 입력 모달

#### 데이터 출처
- 영아 stats: `features/baby-tracker/storage`(AsyncStorage 로컬)에서 로드 (← server API에서 변경)
- 임신부 stats: AsyncStorage(물/영양제/mood) + AsyncStorage(다음검진)
- AI 분석: `useAIAnalysisData.ts` 훅 (영아: dailyTracking 어제vs오늘, 임신부: 7일 추세)
- 영아 데일리 팁: `useBabyDailyTip.ts` 훅 (어제 vs 오늘 비교 메시지)
- 기질 5막대: `child.innateData.fiveElements` (이미 0~100 percent 정규화됨, 시각만 1.5배 확대)

#### 다음 검진 일정 (AsyncStorage 기반, Firestore 미사용)
- `services/checkup.ts` — getNextCheckup / setNextCheckup / clearNextCheckup / daysUntil / formatDday / formatKoreanDate
- `useCheckupStore` (zustand) — 입력/삭제 시 home 즉시 갱신 트리거
- 임신앨범 화면 상단에 "다음 검진 일정" 카드 추가 (탭하면 모달)
- PDF 앨범 출력 시 자동 미포함 (PDF는 albumPhotos만 봄)

#### 갱신 트리거 (zustand store)
- `stores/feverStore.ts` — 측정/삭제 시 home 펄스 동기화
- `stores/checkupStore` (in checkup.ts) — 검진 일정 변경 시 home 동기화
- `stores/trackerStore.ts` — baby-tracker 저장 시 home stats 동기화

### 6) 홈 V3 변천사 (수정 반영)

#### v2.9.1 — 1차
- 5 컴포넌트 + 단순 헤더 + 만삭 출산 등록 카드

#### v2.9.2 — 펄스 즉시 반영
- feverStore 트리거로 fever 측정 → home 펄스 즉시 표시

#### v2.9.3 — 4-stat 통합 카드
- 4-stat / AI 분석 → 단일 카드 안에 column 통합 (mockup 스타일)

#### v2.9.4 — 컴팩트
- 모든 섹션 padding/icon 축소 (퀵메뉴 8개까지 한 화면)

#### v2.9.5 — 데이터 fix
- 기질 5막대 percent 정확화 (× 10 버그 수정)
- 영아 AI 분석 데이터 연동 (어제 vs 오늘)
- baby-tracker 저장 → home 즉시 갱신 (storage.ts에서 trackerStore.bump 자동 호출)
- 임신부 AI 옵션 1: 영양제 7일 챙김율 / 컨디션 7일 추세 / 이번 주 핵심

#### v2.9.6 — UI 재구성 (사용자 mockup 반영)
- AI/기질 분석 단일 행 배너 (파스텔 라벤더/피치)
- 임신부 home: AI 분석 카드 제거 → 출산가방/검진/태동 등 주차별 핵심 강조 카드
- 임신 여정 5단계 클릭 → `pregnancy-journey-detail.tsx` 신규 페이지
  - 단계별 영양제 / 식단 / 운동 / 검사 / 주의사항 / 마일스톤 (early/wk12/stable/late/birth)
  - 의료적 결정은 산부인과 안내 disclaimer

#### v2.9.7 — 탭 정리 + 순서 재배치
- `pregnancy-journey-detail` 탭바에서 숨김 (`href: null`)
- 홈 순서: 4-stat → **퀵메뉴 8개 (위로)** → [임신: 핵심카드 + 여정 / 영아: 팁 + AI + 기질] → 월별특징 / 추천

### 7) 인증 흐름 (이전 작업, 검증 완료)
- 이메일/소셜 가입 시 별명 화면 경유
- backend `isNewUser` 정확화
- set-nickname을 `(auth)` 그룹 밖 `app/onboarding/`으로 이동
- 회원 탈퇴 + 소셜 unlink — Backend REST 정석 패턴 A
- 4-30 빌드 #4 (`a63cb8d8`)에서 com.sylabs.amatda 패키지로 빌드 + Firebase Console 새 SHA-1 자동 등록 + Kakao keyHash 등록 완료 → 카카오/구글/네이버 로그인 정상화

### 검증 결과
- frontend `npx tsc --noEmit` → 0 errors (모든 변경)
- backend `npx tsc --noEmit` → 0 errors
- `firebase deploy --only functions:api` → 성공 (dual-write 코드)
- `firebase deploy --only firestore:indexes` → 성공
- adb logcat으로 로그인 + 펄스 알림 + baby-tracker 갱신 검증

### OTA 배포 이력 (이번 세션)
| Update Group | 버전 | 내용 |
|---|---|---|
| 21c3ae9d | v2.9.1 | 알림 childId fix + fever 재설계 |
| aa9aae2c | v2.9.2 | feverStore 펄스 즉시 반영 |
| 9d73d4be | v2.9.3 | 홈 V3 Dashboard (5 컴포넌트) |
| 33a0e48f | v2.9.4 | 4-stat / AI 단일 카드 통합 |
| 86d5c1d1 | v2.9.5 | 기질 percent fix + tracker store 자동 갱신 + 임신부 AI 옵션1 |
| 3ee17427 | v2.9.6 | AI/기질 파스텔 단일 배너 + 임신부 home 재구성 + 임신 여정 상세 페이지 |
| 37b242c6 | v2.9.7 | 출산 탭 숨김 + 홈 순서 재배치 (퀵메뉴 위로) |

### 신규/수정 파일 요약

**Frontend 신규**:
- `stores/feverStore.ts`, `stores/trackerStore.ts`
- `services/checkup.ts`
- `components/home/DenseStatsRow.tsx`, `DailyTipBanner.tsx`, `AIAnalysisRow.tsx`, `TraitBarsCard.tsx`, `PregnancyJourneyCard.tsx`, `NextCheckupModal.tsx`
- `components/home/useBabyDailyTip.ts`, `useAIAnalysisData.ts`
- `app/(main)/pregnancy-journey-detail.tsx`
- `assets/quick-bottle.png` (gpt-image-1로 신규 생성)

**Frontend 수정**:
- `app/(main)/home.tsx` — V3 dashboard 통합, 헤더 단순화, 순서 재배치
- `app/(main)/_layout.tsx` — pregnancy-journey-detail 탭 숨김
- `app/(main)/fever.tsx` — FastTimeInput, 4-약 그리드, 챔프 토글, 110pt
- `app/(main)/pregnancy.tsx` — NextCheckupSection 추가
- `app/(main)/baby-tracker.tsx` — useTrackerStore 메모 (자동 호출 명시)
- `app/(main)/chatbot.tsx`, `profile.tsx`, `child-edit.tsx`, `notification-settings.tsx` — 알림 함수 시그니처 변경 반영
- `services/pushNotifications.ts` — 모든 schedule/cancel 함수에 childId 박음
- `features/baby-tracker/storage.ts` — saveRecords 직후 trackerStore.bump 자동 호출

**Backend 신규**:
- `backend/scripts/migrate-album-photos/*` (00~04 + 01b)

**Backend 수정**:
- `services/firestore.ts` — albumPhotos 컬렉션 추가
- `routes/album.ts`, `pregnancy.ts`, `child.ts`, `auth.ts` — dual-write
- `services/coaching/auto.diary.ts` — albumPhotos 쿼리

**인프라**:
- `firestore.indexes.json` — albumPhotos 인덱스 2개 추가
- EAS env: GOOGLE_SERVICES_JSON 새 SHA-1 반영 (preview + production)
- Firebase Console: com.sylabs.amatda + 새 SHA-1 자동 등록

### 남은 이슈 (출시 전 사용자 액션 필요)
1. ⚠️ **`backend/service-account.json` 삭제** + Firebase Console 키 폐기 (보안)
2. ⚠️ **OpenAI API 키 폐기** (채팅 노출됨)
3. **production AAB 빌드** (Play Store 제출용 — preview는 검증 완료)
4. **Sentry DSN 운영 env 주입**
5. **Play Console 메타데이터 / 데이터 보안 양식 / 콘텐츠 등급 / 대상 연령층 설문**
6. **AAB 업로드 → Internal testing → Production 단계 출시**
7. **albumPhotos 안정화 후 옛 컬렉션 삭제** (1주 모니터링 후, 옵션)

---

## 2026-04-27 — 코드 동결 시작 + 출시 P0 핫픽스 2건

### 배경
- 출시 직전 반복적 버그 발생 → 동결(`FREEZE.md`) 도입, 출시 목표 2026-05-15
- 271개 미커밋 파일 누적 → release/v2.9.0 브랜치에 분리 백업

### 수행 작업

#### 1) 코드 동결 (STEP 0)
- `FREEZE.md` 신규 — 허용/금지/회색지대 작업 명시
- `CLAUDE.md` 상단에 동결 배너 추가 (다음 세션부터 자동 인식)
- `LAUNCH-CHECKLIST.md` 신규 — STEP 0~8 절차
- `release/v2.9.0` 브랜치 생성 → main과 분리

#### 2) 저장소 정리 (STEP 1)
- `.gitignore` 강화 — OAuth credential dump 패턴(`[0-9]*-*.txt`),
  Claude 내부, Firebase 캐시, 일회성 로그/스크립트, assets.backup/ 제외
- 271 미커밋 파일 → 3개 커밋으로 분리 후 origin push
  - `c02544c chore: gitignore — 시크릿/캐시/임시파일 제외`
  - `1a6d017 chore: pre-launch snapshot — 미커밋 작업 일괄 정리`
  - `491dc53 docs: 코드 동결 + 출시 체크리스트`

#### 3) 정적 검증 (STEP 2)
- `cd backend && npx tsc --noEmit` → exit 0 ✅
- `cd frontend && npx tsc --noEmit` → exit 0 ✅
- `cd frontend && npx expo lint` → 0 errors / 59 warnings (모두 P2, 동결 유지)

#### 4) Firestore 룰 P0 핫픽스
- 문제: `firestore.rules`가 임시 룰(`request.time < 2026-05-05`).
  출시일(5/15) 이후 모든 사용자 차단 + 그 전에는 인증 없이 누구든 read/write
- 수정: 클라이언트 직접 접근 전면 차단(`allow read, write: if false`).
  프론트엔드는 Firestore 직접 접근 0건(grep 검증) → 백엔드 Admin SDK만 통과
- 배포: `firebase deploy --only firestore:rules` → released
- 커밋: `88fb568 fix(security): Firestore 임시 룰 → 클라이언트 차단 룰로 교체 (P0)`

#### 5) SOS 이미지 P0 핫픽스
- 문제: `frontend/assets/sos-*.png` 4장이 Gemini 생성 시 가짜 한글
  (`심페소송물`, `기모 털기`, `머리 피로 젓히기 + 탁 일미기` 등)으로
  잘못된 응급정보 표시 → 부모가 따라하면 위험
- 수정: ChatGPT(GPT Image 1)로 4장 재생성 + 사람이 글자 한 자씩 검수
  - sos-cpr.png — 영아 CPR 4단계 (반응→기도→압박 30회→인공호흡 2회)
  - sos-heimlich.png — 하임리히 4단계 (등 두드리기→가슴 압박→1세 이상→119)
  - sos-burn-fall.png — 화상/낙상 4단계 (찬물 10분→금지 항목→일으키기 X→24시간 관찰)
  - sos-foreign.png — 이물질 4단계 (손가락 X→기침 막지 X→하임리히→119+병원)
- 재발 방지: `scripts/generate-sos-images.cjs` 비활성화(즉시 exit 1)
- 의학 정확도: AHA 영아 CPR 가이드라인 부합 확인
- 커밋: `f30e9cc fix(sos): SOS 응급가이드 이미지 4장 한글 깨짐 수정 (P0)`

#### 6) 환경/시크릿 점검 (STEP 3)
- ✅ Firestore 인덱스 22개 모두 "사용 설정됨" (Firebase Console 확인)
- ✅ google-services.json 존재 (frontend/, 1312 bytes)
- ✅ storage.rules 정상 (인증+uid+사이즈 제한)
- ⏳ Sentry DSN 운영 env 누락 → 빌드 직전 사용자가 sentry.io DSN 제공

#### 7) runtimeVersion 정책 (STEP 4)
- 현재 `{"policy": "appVersion"}` 이미 적용 (이전 v2.8.5 미결 사항 해결됨)
- 운영/preview 채널 모두 2.8.1 → 다음 빌드는 2.9.0으로 자동 매핑

#### 8) 출시 베타 빌드 시작
- `eas build --profile preview --platform android` 시작
- Build ID: `ff118ed5-bb24-4cb9-828f-3df25cc64400`
- 메시지: "v2.9.0-beta: SOS 이미지 정본 + Firestore 룰 핫픽스"
- ⚠️ 4월 EAS 무료 크레딧 100% 소진 — 이번 빌드는 유료 과금
- 5월 1일 무료 크레딧 리셋 후 production 빌드 만들 예정

#### 9) 출시 보조 문서 신규
- `STEP6-DEVICE-TEST.md` — 실기기 시나리오 11개 (A~K) + P0 발견 시 절차
- `PLAY-CONSOLE-METADATA.md` — Play Console 제출용 텍스트/설문 답안/이미지 가이드

### 검증 결과
- 백엔드/프론트 tsc → 통과
- 프론트 lint → 0 errors
- Firestore 룰 배포 성공
- SOS 이미지 사람 검수 통과
- git push origin release/v2.9.0 완료 (백업)

### 남은 작업 (출시까지)
- [ ] 베타 빌드 완료 → APK 다운로드 (백그라운드 진행 중)
- [ ] STEP 6 실기기 검증 (사용자 직접 — 시나리오 A~K)
- [ ] 태교음악 화면 처리 결정 (P1, 옵션: 숨김/준비중 표시/그대로)
- [ ] STEP 7 지인 5명 클로즈베타 → 피드백 수렴
- [ ] 5월 1일 EAS 크레딧 리셋 후 production 빌드
- [ ] Sentry DSN 발급 → eas.json production env 주입
- [ ] Play Console 메타데이터 등록 + 스크린샷 업로드
- [ ] 데이터 보안 양식 / 콘텐츠 등급 / 대상 연령층 설문
- [ ] AAB 업로드 → Internal testing → Production 단계적 출시

### 동결 위반 없음
- 본 세션 모든 변경은 P0 핫픽스 또는 출시 보조 문서. FREEZE.md 정책 준수.

---

## 2026-04-21 — iOS 미니멀 디자인 (Option 3) 적용

### 목적
전체 앱 UI를 iOS 시스템 색상 기준 미니멀 스타일로 통일

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `constants/theme.colors.ts` | iOS 팔레트 교체 (background #F2F2F7, text #1C1C1E, border #C6C6C8 등) |
| `constants/theme.ts` | `IOS_HEADER_STYLE` 상수 추가, RADIUS 소폭 조정 |
| `app/(main)/_layout.tsx` | 탭바 iOS 스타일 (border 0.33, C6C6C8) |
| `app/(main)/home.tsx` 外 10개 | 로컬 COLOR const → iOS 팔레트 |
| `app/(main)/*.tsx` 14개 + components 5개 | #FAFAFA→#F2F2F7, #2D2016→#1C1C1E, #8C7A6B→#636366 등 일괄 교체 |

### 유지 (의도적 다크 테마)
- `sleep-predict.tsx` (#0D1B3E 베이스) — 수면 화면 야간 UI
- `lullaby.tsx` (#1A1230 베이스) — 자장가 화면 야간 UI

### 검증 결과
- `cd backend && npx tsc --noEmit` → 통과
- `cd frontend && npx tsc --noEmit` → 통과
- `cd frontend && npx expo lint` → 24 errors 모두 pre-existing (album.tsx hooks 조건부 호출), 내 변경 무관

### iOS 미니멀 팔레트 요약
| 토큰 | 값 | 의미 |
|------|-----|------|
| background | #F2F2F7 | iOS systemGroupedBackground |
| surface | #FFFFFF | iOS card |
| text | #1C1C1E | iOS label |
| textSecondary | #636366 | iOS secondaryLabel |
| textLight | #ABABAB | iOS tertiaryLabel |
| border | #C6C6C8 | iOS separator |
| borderLight | #E5E5EA | iOS opaqueSeparator |

---

## 2026-04-19 v2.8.6 — 에셋 정리 (앱 번들 경량화)

### 배경
- 프론트 `assets/` 445MB → 107MB (76% 감소). 릴리즈 AAB/APK 크기 대폭 축소.

### 삭제
| 항목 | 크기 | 이유 |
|------|------|------|
| `frontend/assets/milestones/` | 241MB | 풀사이즈 마일스톤 원본. 앨범 PDF는 백엔드 `/api/album/milestone-image`로 서빙, 프론트에서 import 0건 |
| `frontend/assets/milestones-sm/` | 1.8MB | `constants/milestoneImages.ts`만 참조 — 그 파일 자체도 import 0건 |
| `frontend/constants/milestoneImages.ts` | — | 어디서도 import하지 않는 dead code |
| Top-level PNG 69개 | ~95MB | `app/ components/ constants/ services/ stores/ hooks/ lib/ utils/` 전체에서 참조 0건 (예: `passport-*`, `onboarding-*`, `feature-*`, `trait-*-small`, `weather-cloudy/rainy/snowy`, `analyzer-*`, `growth-cognitive/language/social`, `milestone-*` (프론트판), `mascot-doctor/reading/sleeping`, `quick-trait`, 기타) |

### 보존
- `icon.png`, `adaptive-icon.png`, `favicon.png` — `app.json` 참조
- `mascot-happy.png` — splash + `app/_layout.tsx` + `app/voice.tsx`
- `store-listing.json` — Play Console 등록용 메타데이터(번들 포함 X, 소스 유지)
- `scripts/generate-*-icons.js`는 아이콘 생성 스크립트일 뿐 앱은 생성물을 참조하지 않음 — 스크립트 자체는 유지하되 생성 PNG는 삭제

### 검증
- 정적 require가 전부 `assets/xxx.png` 리터럴 문자열 → 동적 템플릿 require(``\`assets/${x}.png\``) 없음 확인
- `grep -rF "<filename>" app components constants services stores hooks lib utils` 0건인 PNG만 삭제
- `cd frontend && npx tsc --noEmit` → exit 0
- `cd frontend && npx expo lint` → exit 0
- `cd backend && npx tsc --noEmit` → exit 0

### 남은 작업
- Preview APK 재빌드해 `google-services.json` 동적 주입(`app.config.js`) + 경량화 반영 검증
- 실기기 설치 후 전 화면 이미지 깨짐 확인 (특히 momstagram, clinic, coparenting, home quick-actions)

---

## 2026-04-19 v2.8.5 — 플레이스토어 사전 감사 + 안전·성능 수정

### 배경
- 전문 에이전트 4개 병렬 감사(AI 파이프라인, 백엔드 안전, 프론트 버그, Play Store + 성능) 기반 출시 전 정리

### 수정 파일 / 목적
| 파일 | 목적 |
|------|------|
| `backend/src/routes/coaching/ask.handler.ts` | AI 파이프라인 순서 교정 — 위험키워드(`detectRedFlags`)를 본문검증 직후로 이동, EMERGENCY는 Gemini 미호출로 즉시 119 안내 short-circuit. `invalidateTierCache` / `invalidateChildContextCache` export. streak LRU 캐시(5000, 1h) 추가. `createdAt`을 `FieldValue.serverTimestamp()`로 교정 |
| `backend/src/routes/subscription.ts` | trial-start / subscribe 후 `invalidateTierCache(userId)` 호출. 결제 경로 silent catch → stack 로깅 |
| `backend/src/index.ts` | body limit 세분화(`/api/upload` 10mb, 기본 1mb, coaching 2mb). 글로벌 에러 미들웨어 추가 |
| `backend/src/middleware/security.ts` | CORS `credentials: true` → `false` (JWT 헤더 기반) |
| `backend/src/routes/auth.ts` | 비밀번호 최소 6 → 8자. Kakao state 로그 마스킹 |
| `backend/src/services/coaching/db.searcher.ts` | 연령별 KB 배열 모듈 로드시 사전 합성(요청당 spread 제거) |
| `backend/src/routes/food.ts`, `question.ts` | GET 응답 Cache-Control: `max-age=3600, stale-while-revalidate=86400` |
| `frontend/services/api.ts` | 운영 빌드에서 env 누락 시 localhost로 조용히 떨어지는 문제 차단(`resolveApiUrl`) |
| `frontend/app/(auth)/_layout.tsx` | 인증된 유저가 로그인 화면 재진입 시 `/(main)/home` 리다이렉트(역방향 게이트) |
| `frontend/app/(main)/_layout.tsx` | 루트 layout의 OTA/push 로직과 **중복된** OTA check/reload 및 push 토큰 등록 블록 제거 |
| `frontend/app.json` | `versionCode` 1 → 2, 미사용 권한(`WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`) 제거 |
| `frontend/app/(main)/cry-analyzer.tsx`, `poop-analyzer.tsx`, `home.tsx`, `components/coaching/CoachMessage.tsx`, `app/(main)/recommendation-list.tsx` | `\uXXXX` 유니코드 이스케이프를 리터럴 한글/기호로 치환 (CLAUDE.md 규칙 #5) |
| `frontend/app/(main)/coparenting.tsx` | import 순서 교정(`import/first`), 미사용 `roleIcon` 제거 |
| `frontend/app/(main)/sos.tsx` | `Linking.openURL('tel:119')` 실패 silent catch → Alert "전화 연결 실패" |

### 미적용(위험 판단으로 보류)
- `app.json` `runtimeVersion: "1.0.0"` → `{"policy": "appVersion"}`: 운영 OTA 채널에 이미 런타임 1.0.0으로 배포된 기기들이 있어, 변경 시 고객 단말 OTA가 끊김. 다음 네이티브 빌드 타이밍에 사용자 승인 후 전환 권장.
- 대규모 `expo-image` 마이그레이션: 적용 범위가 넓고 본 감사 주제(출시 블로커)와 범위 밖.
- 홈 부트스트랩 병렬화: 이미 `loadChildren/checkProactivePopup/checkTrialStatus` 및 `loadRetentionData/loadProactiveInsights`가 await 체인 없이 나란히 트리거됨(개선 불필요).

### 검증
- `cd backend && npx tsc --noEmit` → exit 0
- `cd frontend && npx tsc --noEmit` → exit 0
- `cd frontend && npx expo lint` → exit 0

### 남은 이슈 / 출시 전 사용자 액션 필요
- `runtimeVersion` 정책 전환 결정
- `google-services.json` / Android 서명 키 정상 여부 재확인
- ✅ 개인정보처리방침 URL 호스팅 완료 (https://amatda-parenting.web.app/privacy) — Play Console 입력 필요
- Sentry DSN이 운영 env에 주입되는지 (eas.json production에 `EXPO_PUBLIC_SENTRY_DSN` 부재)

---

## 2026-04-19 v2.8.4 — album-cover.png 기본 표지 적용 (UI 미리보기 + PDF 삽입)

### 배경 / 원인
- 사용자가 `frontend/assets/album-cover.png` 직접 제공
- 표지 미선택 시: 기존 이모지 placeholder("🖼") → 제공받은 이미지로 교체
- PDF 생성 시: 표지 미선택 시 기본 그라데이션 폴백 → `album-cover.png` base64 embed로 교체

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/app/(main)/album.tsx` | `DEFAULT_COVER_SOURCE = require('assets/album-cover.png')` 모듈 상수 추가; `_defaultCoverB64` base64 캐시 추가; `getDefaultCoverDataUri()` 헬퍼 추가 (`Image.resolveAssetSource` → `uriToDataUri` 변환, 캐시); 커버 피커 UI: 이모지 placeholder → `DEFAULT_COVER_SOURCE` 이미지 + "기본 표지 · 탭하여 변경" 반투명 오버레이; `handleGenerateAlbum`: 커버 미선택 시 `getDefaultCoverDataUri()` 호출; `albumCoverDefaultOverlay`, `albumCoverDefaultText` 스타일 추가 |

### 동작 방식
- 표지 피커 기본 상태: `album-cover.png` 이미지 미리보기 표시 (height 120, cover 모드)
- 하단에 반투명 오버레이 "기본 표지 · 탭하여 변경" 텍스트로 변경 가능함을 안내
- 갤러리에서 다른 이미지 선택 시 → 선택 이미지 + ✕ 버튼으로 교체
- PDF 생성 시 커버 이미지(기본 or 선택)를 `Image.resolveAssetSource` + `uriToDataUri`로 base64 embed → X박스 없음
- base64 변환은 최초 1회만, 이후 `_defaultCoverB64` 캐시 재사용

### 검증
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 Lint: `npx expo lint` → 에러/경고 0 (album.tsx 기준) ✅

### 배포
- **OTA**: preview 브랜치 배포 완료 ✅
  - Update group ID: `0cb39b5a-edaa-4021-9ba2-2fb425b1fa36`
  - Message: `v2.8.4: album-cover.png 기본 표지 적용 (UI 미리보기 + PDF 삽입)`
  - album-cover.png 번들 포함 확인 (3.6 MB)

---

---

## 2026-04-18 v2.8.0 (최종) — expo-print 기기내 PDF 생성 전면 교체 + 표지 이미지 선택 + 마일스톤 PNG API

### 배경 / 원인
- 백엔드 PDFKit 방식은 수차례 시도에도 앱에 변경사항이 전혀 반영되지 않았음
- 원인: Firebase Functions 컨테이너 재사용, OTA 적용 타이밍, 마일스톤 미설정 사진 등 복합 문제
- **근본 해결책**: PDF 생성 자체를 프론트엔드로 이관 — 백엔드 의존성 제거

### 새 아키텍처
```
기간 선택
  ↓
photos 상태에서 날짜 범위 필터링 (클라이언트)
  ↓
generateAlbumHTML() — HTML/CSS로 표지 + 2×2 사진 그리드 빌드
  ↓
Print.printToFileAsync({ html }) — 기기 WebView에서 PDF 렌더링
  ↓
Sharing.shareAsync(uri) — 네이티브 공유 시트 (카카오톡, 드라이브 등)
```

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/app/(main)/album.tsx` | **전면 교체**: `import * as FileSystem` 제거 → `import * as Print from 'expo-print'` 추가; `DownloadButton` 컴포넌트 제거; `GeneratedAlbum` 인터페이스 제거; `albums` / `pollingRef` / `albumsRef` 상태 제거; `loadAlbums` / `useEffect` 폴링 로직 제거; `handleDeleteAlbum` 제거; `handleGenerateAlbum` 완전 교체 (expo-print 기반); `generateAlbumHTML()` + `escapeHtml()` 헬퍼 추가; 앨범 섹션 UI 간소화 (앨범 목록 제거); 미사용 스타일 정리; `useRef` import 제거 |
| `frontend/app.json` | version `2.7.1` → `2.8.0` |
| `backend/src/services/album.pdf.service.ts` | `getMilestoneImageBuffer` → `export` 추가 |
| `backend/src/routes/album.ts` | `GET /api/album/milestone-image?label=...` 엔드포인트 추가 (인증 불필요, 정적 PNG 서빙, 24h 캐시) |

### HTML PDF 구성 (최종)
- **표지**: 사용자가 갤러리에서 선택한 이미지 → 전체 페이지 `<img>` (텍스트 없음). 미선택 시 다크 네이비 그라데이션 폴백.
- **마일스톤 이미지**: `GET /api/album/milestone-image?label=첫 울음` → 백엔드가 `milestones-sm/` 에서 PNG 서빙 → expo-print WebView 에서 `<img>` 직접 로드. 실패 시 `onerror` 로 fallback 배지 표시.
- **내지**: A4, 2×2 CSS Grid, Firebase Storage URL `<img>` 직접 로드, 마일스톤 = PNG 이미지 + 카테고리 컬러 텍스트, 메모 이탤릭
- **한국어 폰트**: `-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic'` (시스템 폰트, 별도 파일 불필요)

### 검증
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 백엔드 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 Lint: `npx expo lint` → 에러 없음 (경고 5개, coparenting.tsx 무관) ✅
- 마일스톤 이미지 API 실동작 확인: `curl /api/album/milestone-image?label=첫 걸음` → 128×128 PNG 반환 ✅

### 배포
- **백엔드**: `npm run build` (tsc 컴파일) 후 Firebase Functions 배포 완료 ✅
- **OTA**: production 브랜치 배포 완료 ✅
  - Update group ID: `87fadf86-d095-43e1-9959-32c1dba2d0c6`
  - Message: `v2.8.0-album-expo-print`

### 남은 이슈
- Firebase Storage 이미지 로드는 기기 네트워크 상태에 따라 느릴 수 있음 (HTTPS 공개 URL이므로 정상 동작 예상)
- 인쇄소용 고화질이 필요하면 `photo.uri` 대신 `printUrl` 필드 사용 고려 (현재 thumbUrl 사용)

---

## 2026-04-18 v2.8.2 — PDF 이미지 X박스 수정 (base64 embed)

### 원인
expo-print WebView는 HTML을 렌더링한 직후 PDF 스냅샷을 찍음. Firebase Storage HTTPS URL 이미지가 로드되기 전에 스냅샷이 찍혀 이미지가 X박스로 표시됨.

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/app/(main)/album.tsx` | `import * as FileSystem from 'expo-file-system/legacy'` 추가; `uriToDataUri()` 헬퍼 추가 (원격 URL → 로컬 캐시 다운로드 → base64 data URI 변환); `handleGenerateAlbum`에서 PDF 생성 직전 `Promise.all`로 모든 사진 base64 변환 후 HTML에 embed |

### 동작 방식
- PDF 생성 버튼 클릭 → 사진 URL 병렬 다운로드 → base64 embed HTML 생성 → expo-print
- 이미지가 HTML에 직접 embed되므로 WebView 네트워크 로드 불필요 → X박스 없음
- 실패한 이미지는 원본 URI fallback (에러 숨기지 않음)

### 검증
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 Lint: `npx expo lint` → 에러 없음 ✅

### 배포
- **OTA**: preview 브랜치 배포 완료 ✅
  - Update group ID: `4d46e501-ea2c-4371-8aed-61d5e3a09d5b`
  - Message: `v2.8.2-pdf-base64-images`

---

## 2026-04-18 v2.8.1 — 앱 피드 카드에 마일스톤 일러스트 이미지 적용

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/app/(main)/album.tsx` | `milestoneImgUrl()` 모듈 레벨 헬퍼로 분리 (PDF + 앱 UI 공유); `MilestoneBadgeIcon` 컴포넌트 추가 (API PNG → onError 시 이모지 폴백); 피드 카드 `LinearGradient` 원형 → `MilestoneBadgeIcon`으로 교체; `feedBadgeImg` 스타일 추가 |

### 동작 방식
- 앨범 화면 피드 카드의 마일스톤 배지: **실제 PNG 일러스트** 이미지(28×28) 표시
- 이미지 로드 실패 시 → 기존 카테고리 컬러 그라데이션 원형 + 이모지 폴백
- React Native Image 자동 캐시 → 동일 마일스톤은 첫 로드 이후 즉시 표시

### 검증
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 Lint: `npx expo lint` → 에러 없음 ✅

### 배포
- **OTA**: preview 브랜치 배포 완료 ✅
  - Update group ID: `9cd0cf38-b5c9-4105-ba2a-140caed90236`
  - Message: `v2.8.1-milestone-img-in-feed`

---

## 2026-04-18 v2.7.1 — PDF 마일스톤 실제 PNG 이미지 렌더링 (256개 이미지 백엔드 번들)

### 수정 내용

| 파일/폴더 | 수정 내용 |
|------|-----------|
| `backend/src/assets/milestones-sm/` | frontend의 milestone PNG 256개를 백엔드에 복사 (1.8MB) |
| `backend/src/services/album.pdf.service.ts` | `getMilestoneFileSet()` 캐시 스캔 추가; `safeMilestoneName()` + `getMilestoneImageBuffer()` 추가 (suffix 매칭 + 괄호 제거 fallback); PDF 마일스톤 렌더링: **PNG 이미지 22pt × 22pt + 카테고리 컬러 텍스트** (이미지 없으면 컬러 원형 배지 폴백) |

### 핵심 로직
- **suffix 매칭**: `photo.milestone` = "첫 울음" → `safeMilestoneName()` = "첫_울음" → `-첫_울음.png`로 끝나는 파일 탐색 → `0m-첫_울음.png` 발견
- **왜 이전 실패와 다른가**: 프론트 OTA `require()` 방식은 APK에 없는 파일 로드 불가 → 실패. 백엔드 `fs.readFileSync`는 Firebase Functions 배포 시 파일이 서버에 포함 → **항상 동작**
- **fallback**: 이미지 없으면 카테고리 컬러 원형 배지 (기존 방식 유지)

### 검증
- 백엔드 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅

### 배포
- **백엔드**: Firebase Functions 배포 완료 (42.68MB, milestones-sm 256개 포함) ✅

---

## 2026-04-18 v2.7.0 — PDF 마일스톤 컬러 원형 배지 + milestoneColor 전파 + 백엔드 재배포

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `backend/src/services/album.pdf.service.ts` | `AlbumPhoto`에 `milestoneColor?: string` 추가; PDF 마일스톤 렌더링 전면 재설계 — 기존 텍스트 pill → 카테고리 컬러 채워진 원형(5pt 반지름) + 흰 별 + 굵은 마일스톤 텍스트(카테고리 색상) 3행 레이아웃으로 변경 |
| `backend/src/routes/album.ts` | POST /photos: `milestoneColor?` body/Firestore 저장 추가; `generateAlbumInBackground`: AlbumPhoto에 `milestoneColor` 포함 |
| `frontend/services/api.ts` | `albumApi.save()`: `milestoneColor?: string` 파라미터 추가 |
| `frontend/app/(main)/album.tsx` | `MilestonePhoto` 인터페이스에 `milestoneColor?` 추가; `saveEntry()`: `milestoneColor: CATEGORY_COLORS[selectedMilestone.cat]` 저장; `newPhoto` 로컬 객체에 `milestoneColor` 포함; `loadPhotos()`: `milestoneColor` 로드; 피드 렌더링: `photo.milestoneColor`를 카테고리 조회 실패 시 폴백으로 사용 |
| `frontend/app.json` | version `2.6.0` → `2.7.0` |

### PDF 마일스톤 시각 변화
- **Before**: 날짜 옆 인라인 텍스트 pill (`★ 첫 걸음마`, 베이지 배경)
- **After**: 3행 캡션 레이아웃
  - 행 1: 날짜 (굵은 9pt)
  - 행 2: **카테고리 컬러 채워진 원 + 흰 별** + **굵은 마일스톤 텍스트** (카테고리 색상)
  - 행 3: 메모 (세리프 폰트, 따옴표)

### 검증
- 백엔드 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 Lint: `npx expo lint` → 에러 없음 (경고 5개, coparenting.tsx 무관) ✅

### 배포
- **백엔드**: Firebase Functions 배포 완료 (41.58MB, api + coachingApi 모두 업데이트) ✅
- **프론트 OTA v2.7.0**: Update group `7c4923b5-dbf8-4cbe-aadf-011f76b1f0d0` (branch: **preview**, android+ios)
  - Message: "v2.7.0: milestoneColor 저장 + PDF 마일스톤 컬러 원형 배지 시각화"
  - Runtime version: 1.0.0 ✅

---

## 2026-04-18 v2.5.0 — LinearGradient 마일스톤 칩 + 피드 컬러 스트립 + 카테고리 색상 동적 적용

### 원인 분석
- v2.4.0까지: 칩은 26px 원형(chipBadge)이 StyleSheet에 없어서 0×0 크기로 투명 렌더링됨
- 피드 배지: `COLORS.primary`(오렌지) 단색 고정이라 카테고리 구분 불가
- 결과: 사용자가 보기에 "바뀐게 없다"

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/app/(main)/album.tsx` | `expo-linear-gradient` import 추가; `getMilestoneCategory(label)` 역방향 조회 함수 추가; 마일스톤 칩 → LinearGradient 그라데이션 전체 배경 (비활성: catColor 21% tint, 활성: 진한 catColor); 피드 카드 → 좌측 5px 컬러 스트립(feedStrip) + LinearGradient 배지 원형 + 카테고리 색 텍스트; StyleSheet 전면 정비 (composeChipWrap, composeChipEmoji 16px, feedStrip, feedBadgeCircle 28px 그라데이션, feedMemo fontWeight bold) |
| `frontend/app.json` | version `2.4.0` → `2.5.0` |

### 시각 변화 (unmissable)
- **칩**: 카테고리별 컬러 그라데이션 배경 → 8가지 색이 가로 스크롤에 눈에 확 띔
- **피드 카드**: 좌측에 카테고리 컬러 5px 스트립 (신체=주황, 언어=파랑, 인지=보라 ...)
- **배지**: 28px 그라데이션 원형 + 카테고리 색 텍스트 (동적으로 올바른 색상 표시)
- **메모**: fontFamily serif + italic + bold (눈에 띄게 다른 글씨체)

### 검증
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 Lint: `npx expo lint` → 에러 없음 ✅

### 배포
- **프론트 OTA v2.5.0**: Update group `01f1b21a-82f0-42c7-b76b-2407d9080a85` (branch: **preview**, android+ios)
  - Message: "v2.5.0: LinearGradient 마일스톤 칩 + 피드 카드 컬러 스트립 + 카테고리별 색상 동적 적용"
  - Runtime version: 1.0.0 ✅

---

## 2026-04-18 v2.4.0 — 마일스톤 배지 OTA 안전 교체 + 폰트 굵게 + PDF 표지 이름 제거

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/app/(main)/album.tsx` | `CATEGORY_COLORS` 추가; 마일스톤 칩 이미지(PNG require) → 카테고리 컬러 원형 배지(View+Text) 교체; 피드 카드 `getMilestoneImageByLabel` 제거 → `feedBadgeCircle`+`feedBadgeEmojiInner` 교체; 폰트 굵게 (`composeChipText` `'700'`, `feedBadgeText` `'700'`, `feedMemo` `'600'`, `composeInput` `'600'`); 새 스타일 추가 (`chipBadge`, `chipBadgeEmoji`, `feedBadgeCircle`, `feedBadgeEmojiInner`); 불필요 스타일 제거 (`chipImgWrap`, `chipImg`, `feedBadgeImg`, `feedBadgeEmoji`) |
| `frontend/app.json` | version `2.3.0` → `2.4.0` |
| `backend/src/services/album.pdf.service.ts` | `drawCover()`에서 childName 파라미터 및 이름 텍스트 오버레이 완전 제거; 표지에 기간(YYYY.MM — YYYY.MM)만 우하단 미묘하게 표시; PDF 본문 폰트 굵기 향상 (마일스톤 배지 `FONT_R`→`FONT_B`, 날짜 fontSize 8→9, 클로징 포토 카운트 `FONT_R`→`FONT_B`) |

### 해결된 이슈
1. **마일스톤 이미지 OTA에서 계속 안 보이는 문제 근본 해결**
   - 원인: `require()` static PNG assets는 OTA 번들에서 원본 APK에 없으면 로드 불가
   - 해결: PNG 파일 참조 완전 제거 → 순수 JS (카테고리별 컬러 원형 배지 + 이모지)로 교체
   - 8가지 카테고리 (body/talk/brain/heart/hand/star/food/eye) 각각 고유 색상 배지
2. **PDF 표지에 아이 이름 노출 제거** (`drawCover` 시그니처에서 childName 제거)
3. **앱 내 폰트 일관성** — 메모/칩 텍스트 fontWeight 강화; `fontFamily: 'serif'` + `fontStyle: 'italic'` + `fontWeight: '600'` 조합

### 검증
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 Lint: `npx expo lint` → 에러 없음 (경고 5개, coparenting.tsx 무관) ✅
- 백엔드 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅

### 배포
- **백엔드**: Firebase Functions 배포 완료 (PDF 표지 이름 제거, 본문 폰트 굵게)
- **프론트 OTA v2.4.0**: Update group `a16003c0-9c4c-41ed-8c2d-3c4dd0882821` (branch: **preview**, android+ios)
  - Message: "v2.4.0: milestone color badge (OTA-safe), bolder fonts, PDF cover name removed"
  - Runtime version: 1.0.0 ✅

---

## 2026-04-18 OTA 진단 + 버전 표시 개선 + v2.2.0 배포

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/app.json` | version `2.1.0` → `2.2.0` |
| `frontend/components/profile/ProfileFooter.tsx` | `expo-updates` import 추가; `getUpdateLabel()` 함수로 OTA 상태 실시간 표시 (`v2.2.0 · OTA MM/DD HH:MM` 또는 `기본빌드` / `긴급복구`) |
| `frontend/app/_layout.tsx` | OTA catch 블록에 `captureError` 추가 → Sentry로 OTA 실패 원인 로깅 |

### 해결된 이슈
1. **OTA 미적용 진단 수단 추가** → ProfileFooter에 `Updates.isEmbeddedLaunch`, `Updates.isEmergencyLaunch`, `Updates.createdAt` 표시
   - `v2.2.0 · OTA 04/18 15:30` → OTA 정상 적용됨
   - `v2.2.0 · 기본빌드` → 앱 내장 번들만 실행중 (OTA 미적용)
   - `v2.2.0 · 긴급복구` → OTA 번들 크래시로 폴백됨
2. **OTA 에러 숨김 방지** → catch 블록에 Sentry 로깅 추가

### 검증
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅

### 배포
- **프론트 OTA v2.2.0**: Update group `61e3a3f2-775c-42c2-aa28-99ce0fe95bd6` (branch: **preview**, android+ios)
  - Message: "v2.2.0: OTA 상태 표시, 마일스톤 이미지 fix, 메모 글씨체 변경"
  - Runtime version: 1.0.0 ✅

### 사용 방법 (OTA 확인)
1. 앱 완전히 닫기 → 다시 열기
2. 앱 시작 10초 후 자동 OTA 체크 시작
3. ProfileFooter(프로필 탭 맨 아래) 버전 확인
   - `v2.2.0 · OTA ...` 표시 → 업데이트 성공
   - `v2.2.0 · 기본빌드` 표시 → OTA 미적용 (추가 진단 필요)

---

## 2026-04-18 성장앨범 PDF 고급 리디자인 + 마일스톤 이미지 수정 + 표지 더블스프레드

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `backend/src/services/album.pdf.service.ts` | NotoSerifKR 폰트 등록; `drawCover()` 우측 패널(x=420~841)에 이름/기간 오버레이; 럭셔리 본문 레이아웃 (크림 배경, 골드 액센트 스트립, 세리프 월 헤더, 마일스톤 배지, 세리프 메모 폰트, 그림자 사진); 클로징 페이지 이중 금색 프레임 + 세리프 폰트 |
| `backend/src/assets/fonts/NotoSerifKR-Regular.otf` | 새로 추가 (24MB, GitHub googlefonts/noto-cjk에서 다운로드) |
| `backend/src/assets/fonts/NotoSerifKR-Bold.otf` | 새로 추가 |
| `backend/src/assets/album-cover.jpg` | sharp로 더블 스프레드 재생성 (좌: 다크 네이비 SVG 크레센트 패널, 우: 원본 앨범 커버), 최종 1684×1190 ✅ |
| `frontend/app/(main)/album.tsx` | MILESTONE_PRESETS 전면 교체 — 모든 월령(0~6세이상) 레이블을 실제 이미지 파일명과 정확히 일치하도록 수정 |
| `frontend/constants/milestoneImages.ts` | `ageToPrefix('6세 이상')` 반환값 `'6y_'` → `'6y+'` 버그 수정 |

### 해결된 이슈
1. **마일스톤 이미지 안 나오는 문제** → 2가지 버그 동시 수정
   - `ageToPrefix` 6세이상 prefix 오류 (`6y_` → `6y+`)
   - PRESET 레이블이 이미지 파일명과 불일치 (예: `'움직이는 물체 따라보기'` → `'물체 따라보기'`) — 전 월령 교체
2. **표지 더블 스프레드** → sharp로 좌측 다크 네이비 SVG 패널 + 우측 원본 커버 합성, 1684×1190 생성. drawCover()에서 우측 패널(x=420pt~)에만 이름/기간 오버레이
3. **PDF 내부 고급화** → NotoSerifKR 세리프 폰트 로딩, 크림 배경(#FDFAF5), 골드 액센트 스트립, 마일스톤 배지(pill), 메모에 큰따옴표 + 세리프 폰트, 사진 그림자 효과, 이중 금색 클로징 프레임
4. **엄마 한마디 글씨체** → NotoSerifKR-Regular (세리프 폰트)로 교체, 메모 앞뒤 " " 따옴표 추가

### 검증
- 백엔드 TypeScript: `cd backend && npx tsc --noEmit` → 에러 없음 ✅
- 프론트 TypeScript: `cd frontend && npx tsc --noEmit` → 에러 없음 ✅
- 프론트 Lint: `cd frontend && npx expo lint` → 에러 없음 (경고 5개, coparenting.tsx 무관) ✅

### 배포
- **백엔드**: Firebase Functions 배포 완료 (NotoSerifKR 폰트 포함, 39.24MB)
- **프론트 OTA**: Update group `97561642-0a06-4115-86b7-cc83ee6ad216` (branch: **preview**, android+ios)
  - Message: "Fix milestone images + luxury PDF redesign (serif font, cover overlay, interior layout)"

---

## 2026-04-18 성장앨범 PDF 개선 4가지 (표지 크롭 수정 + 다운로드 + 사진 크롭 + 셀 cover 채움)

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `backend/src/assets/album-cover.jpg` | sharp로 A4 Landscape 정확히 1684×1190px center-crop 재처리 (PDFKit cover 버그 우회) |
| `backend/src/services/album.pdf.service.ts` | `drawCover()`: PDFKit `cover` 옵션 제거 → 미리 크롭된 이미지를 `{ width: A4_W, height: A4_H }`로 직접 배치; `drawPhotoFit()`: fit→cover+clip으로 변경 (회색 패딩 없이 균일 채움) |
| `frontend/app/(main)/album.tsx` | `import * as FileSystem from 'expo-file-system/legacy'` (v19 API 변경 대응); `DownloadButton` 컴포넌트 추가 (FileSystem.downloadAsync → Sharing.shareAsync 네이티브 공유 시트); 기존 Linking 다운로드 버튼 교체 |
| `frontend/utils/imagePicker.ts` | `allowsEditing`, `aspect` 옵션 추가 |
| `frontend/app/(main)/album.tsx` | `pickImage`: `allowsEditing: true, aspect: [4, 3]` 적용 → 사진 업로드 시 크롭 UI 표시 |

### 해결된 이슈
1. **PDF 표지 잘못된 영역 표시** → PDFKit `cover` 옵션이 (0,0)에서 시작해 페이지 경계로 잘림 버그. sharp로 서버 측 미리 center-crop 후 `{ width, height }` 직접 배치로 수정
2. **PDF 다운로드 어려움** → `Linking.openURL()` 대신 `FileSystem.downloadAsync` + `Sharing.shareAsync`로 네이티브 공유 시트 (카카오톡, 구글 드라이브, 내 파일 등)
3. **사진 업로드 크롭 없음** → `allowsEditing: true, aspect: [4, 3]` 강제 크롭 UI
4. **앨범 사진 셀 회색 여백** → `drawPhotoFit` cover+clip으로 균일 채움

### 검증
- 백엔드 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 Lint: `npx expo lint` → 에러 없음 (경고 5개, coparenting.tsx 무관) ✅

### 배포
- **백엔드**: Firebase Functions 배포 완료 (album-cover.jpg 1684×1190 포함, 20MB)
- **프론트 OTA**: Update group `efd3069b-e68f-487f-817f-108ed894f439` (branch: **preview**, android+ios)

---

## 2026-04-18 SOS 이미지 한국어 재생성 + 성장앨범 PDF 표지 이미지 교체

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/assets/sos-heimlich.png` | Gemini 이미지 생성 모델로 한국어 최적화 재생성 |
| `frontend/assets/sos-cpr.png` | 동일 |
| `frontend/assets/sos-burn-fall.png` | 동일 |
| `frontend/assets/sos-foreign.png` | 동일 |
| `backend/src/assets/album-cover.jpg` | 사용자가 제공한 "Baby Growth Album" 표지 이미지 (724×1086px, 전면 커버 크롭) |
| `backend/src/services/album.pdf.service.ts` | `drawCover()` 교체 — 사용자 제공 이미지를 전체 배경으로 (`cover` 모드), 하단에 아이 이름/기간 오버레이 (반투명 NAVY 밴드 + 금색 텍스트). 폴백(이미지 없을 시) 유지 |

### 해결된 이슈
1. **SOS 이미지 한국어 불량** → Gemini 2.5 Flash (image generation) 모델로 한국어 프롬프트 사용, 선명한 한국어 텍스트 이미지 재생성
2. **성장앨범 PDF 표지** → 직접 그린 PDFKit 디자인 대신 사용자가 만든 "Baby Growth Album" 다크 네이비 표지 이미지로 교체. A4 Landscape에 맞게 center-crop, 하단에 아이 이름(금색) + 기간(청회색) 오버레이

### 검증
- 백엔드 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- SOS 이미지 시각 확인: 한국어 텍스트 선명 ✅
- 커버 이미지 landscape 크롭 미리보기 확인 ✅ (842×595 시뮬레이션)

### 배포
- **백엔드**: Firebase Functions 배포 완료 (album-cover.jpg 포함, 19.86 MB)
- **프론트 OTA**: Update group `aefa3afd-913c-4db2-85eb-5b02a5acac11` (branch: production, android+ios)

---

## 2026-04-17 성장앨범 4가지 개선

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `backend/src/routes/album.ts` | `DELETE /api/album/albums/:albumId` 엔드포인트 추가 (소유권 확인 후 Firestore 삭제) |
| `frontend/services/api.ts` | `albumApi.deleteAlbum(albumId)` 메서드 추가 |
| `frontend/app/(main)/album.tsx` | `GeneratedAlbum`에 `createdAt` 필드 추가, `handleDeleteAlbum` 콜백 추가, 앨범 카드에 삭제 버튼 추가, 30분 이상 `generating` 상태 → "시간 초과"로 자동 처리 |
| `frontend/constants/milestoneImages.ts` | `getMilestoneImage` 괄호 제거 fallback 추가 (예: `'손 꽉 쥐기(파악반사)'` → `'손 꽉 쥐기'`로 재시도) |
| `backend/src/services/album.pdf.service.ts` | `drawCover()` 전면 재설계 — 다크 네이비(#0D1B35) 배경 + 금색 이중 액자 프레임 + "Baby Growth Album" 텍스트 + 아이 이름/기간 + "Little Moments, Precious Memories." 슬로건 |

### 해결된 이슈
1. **앨범 삭제 기능 없음** → 삭제 버튼(빨간 테두리) 앨범 카드마다 표시, 백엔드 DELETE API 연동
2. **24시간 이상 생성 중인 앨범** → createdAt 기준 30분 초과 시 "시간 초과"로 표시 + 삭제 가능
3. **마일스톤 칩이 이미지 대신 이모지 표시** → 괄호 내용 추가된 레이블(이미지 생성 이후 수정) 대응 fallback
4. **성장앨범 PDF 표지** → 사용자 요청 이미지 스타일로 전면 재설계 (다크 네이비 럭셔리 북 커버)

### 검증
- 백엔드 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- 프론트 TypeScript: `npx tsc --noEmit` → 에러 없음 ✅
- Expo lint: 에러 없음 (album.tsx 관련 경고 0) ✅

### 배포
- **백엔드**: Firebase Functions 배포 완료 (`https://api-usglfifguq-uc.a.run.app`)
- **프론트 OTA**: Update group `d1e39341-c7c9-428e-9d93-5c0f214b1e76` (branch: production, platform: android+ios)

---

---

## 🚨 2026-04-16 코칭 HTTP 404 버그 — 원인/수정/재발방지 기록

### 증상
- 앱에서 상담 메시지 전송 시 `응답을 가져오지 못했어요. 다시 시도해주세요. (HTTP 404)` 반복 표시
- 서버 로그에는 요청이 도달하지 않음

### 근본 원인 (3가지 복합)

**① `coachingApi` 함수 신규 추가 (04/15) 후 APK 미재빌드**
- `coachingApi` 별도 Cloud Run 인스턴스가 04/15에 신규 생성됨
- 당시 앱은 이미 설치된 구 APK → `EXPO_PUBLIC_COACHING_API_URL` 환경변수가 APK에 없음
- Expo `EXPO_PUBLIC_*` 변수는 **빌드 시점에 APK에 고정**, OTA로 변경 불가
- fallback: `COACHING_API_URL = API_URL` → `https://api-usglfifguq-uc.a.run.app/api`

**② Axios baseURL + leading slash 조합 버그**
- `baseURL = 'https://.../api'` (끝이 /api, trailing slash 없음)
- `coachingAxios.post('/coaching/ask')` — path가 `/`로 시작
- Axios 동작: leading slash가 있으면 baseURL의 path를 버리고 host에 붙임
- 결과: `https://api.../coaching/ask` → Express에 해당 라우트 없음 → HTML 404
- 올바른 결과: `https://api.../api/coaching/ask`

**③ `eas.json` production 프로필에 `EXPO_PUBLIC_COACHING_API_URL` 누락**
- preview 프로필에만 있고 production에 없어서 Play Store 빌드도 동일 문제 발생 가능

### 수정 내용

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/services/api.ts` | `coachingApi` 모든 경로에서 leading slash 제거: `'/coaching/ask'` → `'coaching/ask'` |
| `frontend/eas.json` | production 프로필에 `EXPO_PUBLIC_COACHING_API_URL` 추가 |
| `backend/src/index.ts` | fastApp/coachingApp 모두 `/coaching/*` 폴백 라우트 추가 (구 APK 대응) |

### 배포
- **백엔드**: Firebase Functions 배포 완료
- **프론트**: OTA `--branch preview` 업데이트 완료 (update group: `60bae0e1-d75a-4192-a8b8-7791956cf797`)
- **APK**: EAS build preview 재빌드 완료 (`7234b7b0-ccfa-4f57-94be-d2ade9c4fa92`)

### 재발 방지
- **Axios 버그 수정 (영구)**: leading slash 없는 상대경로 사용 → baseURL + path 정상 조합
- **서버 폴백 (영구)**: `/coaching/*` 라우트 서버에 유지 → 아주 오래된 APK도 처리
- **eas.json 보완**: 모든 빌드 프로필에 COACHING URL 명시

### 교훈
> **새 Cloud Run 함수(URL) 추가 시 반드시 APK 재빌드 필요**
> `EXPO_PUBLIC_*` 환경변수는 OTA로 변경 불가 — 빌드 시 고정됨
> Axios baseURL에 path가 포함될 경우 path는 trailing slash 없이, 요청 path는 leading slash 없이 써야 정상 조합됨

---

## 2026-04-16 추가 수정: Galaxy Note10 갤러리 호환성 + 스플래시 즉시 애니메이션

### 문제
- 갤럭시 노트10 등 구형 Android에서 `expo-image-picker` 사용 시 "앱을 설치해야 합니다" 시스템 다이얼로그 표시
  - 원인: 기본 갤러리 앱 없거나 비활성화 → `launchImageLibraryAsync` 내부에서 "No Activity" 예외 발생
- 스플래시 화면 흰 화면 8초 → 텍스트 애니메이션 (이전 세션에서 비디오 스킵 처리)

### 수정 내용
| 파일 | 수정 내용 |
|------|-----------|
| `frontend/utils/imagePicker.ts` (신규) | `pickImageFromLibrary()` / `pickImageFromCamera()` 공통 유틸리티 — "No Activity" 에러 try/catch, 한국어 안내 메시지 |
| `app/(main)/album.tsx` 외 9개 파일 | 직접 `expo-image-picker` 호출 → `utils/imagePicker.ts` 유틸로 교체 |
| `app/splash.tsx` | `VideoComp = null` 고정, 딜레이 0ms → 즉시 텍스트 애니메이션 시작 |

### 교체된 파일 목록 (imagePicker 유틸로 전환)
- `app/(main)/album.tsx`
- `app/(main)/home.tsx`
- `app/(main)/poop-analyzer.tsx`
- `app/(main)/pregnancy.tsx`
- `components/coaching/CoachingInput.tsx`
- `app/(main)/momstagram-post.tsx`
- `components/profile/ProfileCard.tsx`
- `components/momstagram/StoriesRow.tsx`
- `components/onboarding/PhotoPicker.tsx`
- `components/diary/WriteArea.tsx`

### 배포
- TypeScript 컴파일: 에러 없음 ✅
- OTA 배포: `--branch preview` (Update group: `2e5714d4-943b-4512-9759-7a62f3d20c31`)
- APK 재빌드: `1ef76747-39d5-4a66-bb6a-4610ecf7d2b0`
  - `app.json` plugins에 `"expo-av"` 추가 → 스플래시 비디오 정상 재생
  - `splash.tsx` 동적 import 복원

---

## 1. 프로젝트 개요
- **앱 이름**: 아맞다 (A-matda) — "아(이)맞(춤)다(이어리)"
- **목적**: AI 기반 영유아~초등 육아 코칭 앱
- **회사명**: SY Labs
- **기술 스택**: React Native (Expo SDK 54) + Express/Firebase Cloud Functions + Firestore + Gemini 2.5 Flash Lite
- **현재 버전**: 2.1.0 (runtimeVersion: 1.0.0, OTA로 최신 코드 배포)

---

## 2. 완성된 핵심 기능

### 2-1. 인증/회원
- 이메일 회원가입/로그인 (JWT)
- 카카오 소셜 로그인 (네이티브 SDK @react-native-seoul/kakao-login)
- 비밀번호 설정/변경 (이중확인 모달)
- 프로필 수정 (닉네임/비밀번호/부모역할)
- 회원가입 시 엄마/아빠 역할 선택 (parentRole) → 상담이모 호칭에 활용

### 2-2. 자녀 등록/관리
- 자녀 CRUD (이름/성별/생년월일/출생시간/키/몸무게)
- 등록 시 사진(photoUri) Firestore 저장 + 앱에서 표시
- 사주 기반 기질 분석 (5종: 활동형/탐구형/조화형/분석형/감성형)
- 온보딩 설문 60문항 (영유아/유아/초등 각 20문항, 리커트 5점 척도)
  - 모든 질문 구어체/짧은 문장으로 재작성 완료

### 2-3. AI 육아 코칭 (10단계 파이프라인)
| 단계 | 설명 | 담당 파일 |
|------|------|-----------|
| 1 | 입력 받기 (message, category, childId) | coaching.ts |
| 2 | 쓸모없는 질문 차단 (장난/무관/모호) | useless.filter.ts |
| 3 | 레드플래그 검사 (발열/혈변/경련 등) | red.flag.detector.ts |
| 4 | DB 410개 중 상위 2~4개 참고자료 검색 | db.searcher.ts |
| 5 | 이전 대화 요약 불러오기 | conversation.summarizer.ts |
| 6 | 최근 3턴 원문 불러오기 | conversation.summarizer.ts |
| 7 | 아이 프로필+기질+최근기록 조합 | context.builder.ts |
| 8 | System + Runtime Prompt 빌드 → Gemini 전송 | prompt.builder.ts |
| 9 | 응답 포맷 정리 + 프론트 응답 | coaching.ts |
| 10 | 대화 요약 저장 | conversation.summarizer.ts |

- **부모 호칭**: parentRole(엄마/아빠) 기반 "{아이이름}어머님/아버님" 호칭 사용
- **위험 키워드 4단계**: EMERGENCY(119안내) / HOSPITAL(병원권고) / EXPERT(전문가권고) / GENERAL(일반응답)
- **무관 질문 필터**: 장난/인사/모호 차단 + 대화 응답 패턴(네/응/아니 등) 자동 통과
- **코칭 DB**: 총 487개 (영유아 140 + 초등저 135 + 초등고 135 + 임산부 77)
- **카테고리**: 울음/수면/식사/대변/사회성/성장/행동/기타 + 임산부(입덧/영양/운동/감정/검진/출산준비)

### 2-4. AI 코칭 첫 대화 (First Talk)
- 아이 등록 후 AI가 기질/월령별 맞춤 첫 질문 생성
- 간단한 예/아니오 형태 질문 ("밤에 자주 깨는 편인가요?")
- 빠른 터치 답변 버튼 3개 + 직접 입력 가능
- **질문 컨텍스트 포함**: 사용자 답변 시 원래 질문도 함께 AI에 전송
  - `[코치 질문: 새로운 장난감을 보면 바로 만지나요?] 네 좀그래요` 형태
  - 구현: `FirstTalkCard.tsx`의 onSelect에서 질문 컨텍스트 프리픽스 추가
- Gemini AI 또는 기본 템플릿 폴백

### 2-5. AI 코칭 API 전체 목록
| API | 용도 |
|-----|------|
| POST /api/coaching/ask | 메인 상담 (개인화 답변) |
| GET /api/coaching/history/:childId | 상담 내역 |
| GET /api/coaching/followups/:childId | 팔로업 목록 |
| POST /api/coaching/followup/:id/respond | 팔로업 응답 |
| POST /api/coaching/first-talk | 첫 대화 생성 |
| POST /api/coaching/weekly-report | 주간 리포트 |
| GET /api/coaching/milestones/:childId | 성장 마일스톤 |
| POST /api/coaching/daily-diary | AI 육아일기 |
| POST /api/coaching/parent-mental | 부모 멘탈 감지 |
| POST /api/coaching/future-predict | 기질 기반 미래 예측 |
| POST /api/coaching/now-activity | 실시간 활동 추천 |
| POST /api/coaching/analyze-media | 울음/대변 AI 분석 |
| GET /api/coaching/my-tier | 내 구독/레벨 정보 |
| GET /api/coaching/capsule-suggestion | 타임캡슐 제안 |
| POST /api/coaching/capsule-suggestion/accept | 타임캡슐 생성 |
| GET /api/coaching/daily-insight | 선제적 인사이트 |
| GET /api/coaching/welcome | 환영 메시지 |
| GET /api/coaching/auto-diary | 자동 육아일기 |

### 2-6. 가족 피드 (구 맘스타그램 → 가족 전용 피드로 전환)
- **변경 이유**: 공개 소셜피드가 "개인화 AI 육아앱" 정체성과 맞지 않음
- **변경 내용**:
  - 공개 피드 → familyMembers 기반 가족 전용 피드로 전환
  - 백엔드: `momstagram.ts`에서 familyMembers 컬렉션 조회 → 가족 userId만 필터
  - 프론트: 헤더 '맘스타그램' → '가족 피드', 탭바 라벨도 '가족피드'로 변경
  - 빈 상태 텍스트: '첫 게시물을 올려보세요!' → '가족과 소중한 순간을 공유해보세요'
  - 게시물 작성 시 '모든 사용자에게 공유됩니다' → '가족에게 공유됩니다'
- **구현 방식**: Firestore `familyMembers` 컬렉션에서 status='accepted'인 유저 ID 조회 → posts 쿼리에 `where('userId', 'in', familyUserIds)` 적용

### 2-7. 육아 기록 (Baby Tracker) — 연령별 동적 분리
- 배변/수유/수면 3탭 구성
- **연령별 탭 자동 조정**: `ageFeatures.ts`의 `getTrackerTabs(ageGroup)`
  - 영아(0~24개월): 배변 + 수유 + 수면
  - 유아(25~72개월): 배변 + 수유 + 수면 (배변훈련 시기)
  - 초등(73개월+): 식사 + 수면 (기저귀 제거)
- **연령별 수유 타입 자동 조정**: `getFeedingTypes(ageGroup)`
  - 영아: 모유/분유/이유식/간식
  - 유아: 유아식/밥/간식/우유
  - 초등: 식사/간식
- AddRecordModal에 `availableTabs`/`feedingOptions` props 추가
- Firestore dailyTracking 컬렉션 저장

### 2-8. 성장/발달 기능
- 발달 체크리스트 (26개 연령 포인트, 1~144개월)
- 타임라인 마일스톤 27개
- 키/몸무게 날짜별 입력 + 기록 히스토리
- 개월별 발달 특징 화면

### 2-9. 분석기 — 연령 가드 추가
- **대변 분석기**: 사진+특성 선택 → 규칙 기반 분석
  - 연령 가드: 영유아(0~72개월) 전용, 초등은 Alert 후 리다이렉트
- **울음 분석기**: 녹음+특성 선택 → 규칙 기반 분석
  - 연령 가드: 영아(0~24개월) 전용, 유아/초등은 Alert 후 리다이렉트
- 구현: `isScreenAvailable(screen, ageGroup)` 함수로 접근 제어

---

## 3. 2026-04-12 신규 구현 기능

### 3-1. 구독 시스템 전면 재설계

#### 변경 사항
| 항목 | Before | After |
|------|--------|-------|
| 무료 DB 참고 | 2개 | **4개 (유료와 동일)** |
| 무료 답변 길이 | 800토큰 | 900토큰 |
| 무료 대화 요약 | 3줄 | 5줄 |
| 무료 맥락 유지 | 1일 | 3일 |
| 무료 일일 한도 | 200회 고정 | **레벨 기반 (10~50회)** |
| VIP 월간 가격 | 4,900원 | **3,900원** |
| VIP 연간 가격 | 39,900원 | **33,900원** |
| 무료 체험 기간 | 30일 | **7일** |
| VIP 답변 길이 | 1000토큰 | 1200토큰 |

#### 설계 철학
- **무료 경험을 최대한 좋게** → 무료에서도 DB 4개 전체 참고, 충분한 답변 길이
- **유료는 독점 기능으로 차별화** → 자동육아일기, 타임캡슐, 또래비교는 VIP 전용 (403 게이트)

#### 레벨업 시스템 (5단계)
| 레벨 | 이름 | 연속 기록 일수 | 일일 한도 | 뱃지 |
|------|------|---------------|----------|------|
| 1 | 새싹 부모 | 0일 | 10회 | sprout |
| 2 | 줄기 부모 | 7일 | 15회 | stem |
| 3 | 꽃봉오리 부모 | 14일 | 20회 | bud |
| 4 | 만개 부모 | 30일 | 30회 | bloom |
| 5 | 열매 부모 | 60일 | 50회 | fruit |

- 구현: `types.ts`의 `USER_LEVELS`, `getLevelByStreak()`, `getNextLevel()`
- 스트릭 계산: `getUserStreak()` → dailyTracking 컬렉션에서 연속 날짜 카운트
- API: `GET /coaching/my-tier` → tier, level, streak, dailyLimit, nextLevel 반환

#### 프리미엄 전용 기능 (403 게이트)
| 기능 | 엔드포인트 | 무료 시 |
|------|-----------|--------|
| 자동 육아일기 | GET /coaching/auto-diary | 403 + "VIP 전용" 안내 |
| 타임캡슐 | coaching/capsule-suggestion | 403 |
| 또래 비교 | coaching/peer-comparison | 403 |

### 3-2. 연령별 동적 기능 분리 (Dynamic Age Toggling)

#### 핵심 파일: `frontend/constants/ageFeatures.ts`
3개 연령 그룹: infant(0~24개월) / toddler(25~72개월) / elementary(73개월+)

| 함수 | 용도 | 연령별 차이 |
|------|------|------------|
| `getTrackerTabs(age)` | 육아기록 탭 | 초등: 기저귀 탭 제거 |
| `getFeedingTypes(age)` | 수유 타입 | 영아: 모유/분유, 초등: 식사/간식 |
| `getCoachingCategories(age)` | AI 코칭 카테고리 | 영아: 울음/수유, 초등: 학습/감정 |
| `getHomeMenus(age)` | 홈 퀵메뉴 | 영아: 울음분석, 초등: 놀이학습 |
| `isScreenAvailable(screen, age)` | 화면 접근 제어 | 울음분석=영아, 대변분석=영유아 |

#### 적용 위치
- **홈 화면** (`home.tsx`): `ALL_ACTIONS`에 `ages` 속성 추가 → `getActionsForAge(ageGroup)` 필터링
  - 영아: 육아기록, 성장통계, 울음분석, 대변분석, 수면예측, 자장가, 소아과, 타임라인
  - 유아: 육아기록, 성장통계, 대변분석, 수면예측, 자장가, 놀이학습, 소아과, 타임라인
  - 초등: 생활기록, 성장통계, 놀이학습, 소아과, 타임라인, 공동육아, 새싹부모
  - **기질 요약 메뉴 제거** → 육아기록이 첫 번째
- **육아기록** (`baby-tracker.tsx`): `getTrackerTabs()`, `getFeedingTypes()` 적용
- **AI 상담** (`chatbot.tsx`): `CategoryBar`에 `ageGroup` prop 전달 → 연령별 카테고리 필터
- **울음 분석** (`cry-analyzer.tsx`): 영아 외 접근 시 Alert + 뒤로가기
- **대변 분석** (`poop-analyzer.tsx`): 초등 접근 시 Alert + 뒤로가기

### 3-3. 채팅 → 트래커 자동 파싱

#### 핵심 파일: `backend/src/services/coaching/tracker.parser.ts`

사용자가 AI 상담에서 자연어로 입력하면 자동으로 육아 기록 데이터를 추출하여 Firestore에 저장.

#### 파싱 대상 (한국어 정규식)
| 항목 | 키워드 예시 | 추출 데이터 |
|------|-----------|------------|
| 수유 | 분유 200ml, 이유식, 밥 | type, amount(ml) |
| 수면 | 낮잠 2시간, 밤에 3번 깸 | type, hours, nightWakeups |
| 기저귀 | 기저귀 3번, 대변 2회 | type, count |
| 컨디션 | 컨디션 좋아, 아파 | status |
| 체온 | 38도, 37.5 | temperature(number) |

#### 동작 방식
1. AI 응답 생성 후 fire-and-forget으로 실행 (응답 지연 없음)
2. `parseTrackingFromMessage(message)` → `ParsedTracking | null` 반환
3. 파싱 성공 시 Firestore `dailyTracking` 컬렉션에 `{ merge: true }`로 저장
4. 응답에 `trackerAutoSaved: true` 플래그 포함
5. docId: `${childId}_${오늘날짜}` (하루 1문서, 업데이트)

### 3-4. SOS 응급 패스트트랙

#### 백엔드: `backend/src/routes/sos.ts`

| API | 용도 |
|-----|------|
| POST /api/sos/check-symptom | 증상 체크 → 4단계 긴급도 판정 |
| GET /api/sos/fever-calculator | 해열제 용량 계산 |
| POST /api/sos/notify-family | 가족 FCM 긴급 알림 |
| POST /api/tracker/voice-parse | 한국어 음성 텍스트 → 육아 기록 JSON 파싱 |

#### 증상 체크 (4단계 긴급도)
| 레벨 | 조건 | 안내 |
|------|------|------|
| EMERGENCY | 경련+의식없음, 호흡곤란+청색증, 39.5도+3개월미만 | 119 즉시 |
| HOSPITAL | 38.5도+구토, 출혈+멈추지않음 | 병원 즉시 |
| URGENT | 38도+보채, 구토3회+, 발진+열 | 진료 예약 |
| MONITOR | 37.5도, 가벼운 기침 | 경과 관찰 |

#### 해열제 계산기
- **타이레놀 시럽**: 32mg/ml 기준, 체중 × 10~15mg, 4~6시간 간격
- **부루펜 시럽**: 20mg/ml 기준, 체중 × 5~10mg, 6~8시간 간격, 6개월 미만 사용 불가
- 교차복용 스케줄 제공 (타이레놀 → 3시간 후 부루펜 → 3시간 후 타이레놀)
- 체중 기반 용량 자동 계산 (ml 단위)

#### 가족 알림
- `familyMembers` + `pushSchedules` 컬렉션 조회
- FCM 푸시로 긴급 알림 전송

#### 프론트: `frontend/app/(main)/sos.tsx`
- **섹션 1**: 119 긴급전화 버튼 (빨간 대형 버튼, `Linking.openURL('tel:119')`)
- **섹션 2**: 6종 증상 버튼 (발열/구토/경련/호흡곤란/출혈/발진) + 체온 입력 → 긴급도 판정 카드
- **섹션 3**: 해열제 계산기 (체중 입력 → 타이레놀/부루펜 용량 + 교차복용 스케줄)
- **섹션 4**: 빠른 액션 (카카오맵 주변 소아과, 가족 알림)
- **홈 플로팅 버튼**: 빨간 56x56 원형, 우하단, "SOS" 텍스트, home.tsx에 추가

### 3-5. 자동 육아일기 + 타임캡슐 파이프라인

#### 자동 육아일기: `backend/src/services/coaching/auto.diary.ts`
- 하루 AI 상담 세션 기반으로 자동 육아일기 생성 (Gemini)
- **감정 점수 (0~10)** 자동 산출: `scoreEmotion(text)`
  - HIGH 키워드 (+3): 너무, 정말, 진짜, 미치, 폭발, 대박 등
  - MEDIUM 키워드 (+2): 많이, 계속, 자꾸, 항상 등
  - LOW 키워드 (+1): 조금, 약간, 살짝 등
  - 10점 만점 cap
- 감정 키워드 추출: `emotionKeywords: string[]`
- Firestore에 저장: diary + emotionScore + emotionKeywords

#### 타임캡슐: `backend/src/services/coaching/time.capsule.ts`
- **캡슐 제안 API** (`GET /coaching/capsule-suggestion`):
  - emotionScore >= 5인 자동일기 검색 → "이 날을 캡슐에 담을까요?" 제안
- **캡슐 생성 API** (`POST /coaching/capsule-suggestion/accept`):
  - 12개월 후 오픈되는 타임캡슐 생성
  - Firestore `timeCapsules` 컬렉션에 저장
- **캡슐 조회/오픈 API**: 오픈 가능한 캡슐 목록, 개별 오픈

#### 파이프라인 흐름
```
AI 상담 세션 → 하루 끝 → 자동 육아일기 생성
                         ↓
                  감정 점수 산출 (0~10)
                         ↓
              점수 >= 5 → 타임캡슐 제안
                         ↓
              사용자 수락 → 12개월 캡슐 생성
```

### 3-6. 기타 신규 파일/라우트

| 파일 | 용도 |
|------|------|
| `backend/src/routes/sos.ts` | SOS 라우터 (3 endpoints) |
| `backend/src/services/coaching/tracker.parser.ts` | 자연어 → 트래커 파서 |
| `backend/src/services/coaching/auto.diary.ts` | 자동 육아일기 + 감정 점수 |
| `backend/src/services/coaching/time.capsule.ts` | 타임캡슐 CRUD |
| `backend/src/services/coaching/emotion.detector.ts` | 부모 감정 감지 |
| `backend/src/services/coaching/milestone.detector.ts` | 마일스톤 컨텍스트 |
| `backend/src/services/coaching/proactive.insight.ts` | 선제적 인사이트 |
| `backend/src/services/coaching/peer.comparison.ts` | 또래 비교 (VIP) |
| `backend/src/services/coaching/time.awareness.ts` | 시간 인식 |
| `frontend/constants/ageFeatures.ts` | 연령별 기능 매핑 |
| `frontend/app/(main)/sos.tsx` | SOS 화면 |
| `frontend/app/(main)/parent-level.tsx` | 레벨 화면 |
| `frontend/app/(main)/coparenting.tsx` | 공동육아 화면 |
| `frontend/app/(main)/sleep-predict.tsx` | 수면 예측 화면 |
| `frontend/app/(main)/lullaby.tsx` | 자장가 화면 |

### 3-7. Firebase Storage 클라우드 이미지 저장 파이프라인

#### 문제
- 임신기록 이미지가 `file:///` 로컬 경로로만 저장 → 기기 변경/앱 재설치 시 이미지 소실
- 앱 인기 시 대용량 미디어 저장 불가

#### 해결: Firebase Storage 연동
- **백엔드 업로드 API**: `backend/src/routes/upload.ts` (신규)
  - Busboy 멀티파트 파싱 → Firebase Storage 업로드 → 공개 URL 반환
  - 지원: image(jpg/png/webp/heic) + video(mp4/mov), 최대 50MB
  - Cloud Functions 환경 대응: `req.rawBody` (Buffer) 사용
  - 저장 경로: `{folder}/{userId}/{timestamp}_{filename}`
- **프론트 업로드 서비스**: `frontend/services/api.ts`에 `uploadApi.upload()` 추가
  - FormData + fetch (axios 대신, 멀티파트 호환)
  - 반환: `{ url, mediaType, storagePath }`
- **Storage 보안 규칙**: `storage.rules` (신규)
  - `/pregnancy/{userId}/` — 본인만 쓰기, 50MB 제한, 읽기 공개
  - 기본: 서버(Admin SDK)만 쓰기
- **Firebase 설정**: `firebase.json`에 storage 섹션 추가
- **버킷**: `amatda-parenting.firebasestorage.app`

### 3-8. 인스타그램 스타일 임신기록 (Instagram-style Pregnancy Records)

#### 입력 UI 변경 (`pregnancy.tsx`)
- **기존**: 노트/미디어/마일스톤 3개 분리 입력
- **변경**: 인스타그램 카드 1장으로 통합
  - 상단: 정사각 사진 (탭하여 추가/변경/삭제)
  - 하단: 마일스톤 칩 선택 + 캡션 입력
  - 사진+마일스톤+캡션 = 1개 레코드로 저장
- 라벨 변경: "🏥 선생님 이야기" → "📝 기억저장"
- 플레이스홀더: "진료시 들은 이야기나 하고 싶은 이야기를 적어주세요"
- 저장 시 Firebase Storage 업로드 → 클라우드 URL로 Firestore 저장

#### 타임라인 표시 변경
- 미디어 레코드: 피드 카드(feedCard) — 풀폭 정사각 이미지 + 마일스톤 뱃지 + 캡션 + 날짜
- 텍스트 레코드: 기존 텍스트 카드 스타일 유지

#### 앨범 내보내기 (`dataExport.ts`)
- `exportPregnancyAlbum()`: 2×2 포토 그리드 앨범
  - 미디어 레코드만 추출 (텍스트 정보 제거)
  - 각 셀: 정사각 사진 + 주차 뱃지 + 캡션 + 날짜
  - 동영상: expo-video-thumbnails로 첫 프레임 캡처
- `exportBabyData()`: 2×2 성장앨범 스타일로 전면 재설계
  - 표지 페이지 (이름/나이/기질/생년월일)
  - 마일스톤 포토 2×2 그리드 (사진+마일스톤뱃지+메모+날짜)
  - 관찰일기 카드 (최근 10건)
  - albumApi.list() 데이터 소스 추가

### 3-9. 프로덕션 보안/안정성 개선 (2026-04-14)

#### 보안
- **Signed URL**: `upload.ts`에서 `makePublic()` → `getSignedUrl()` (1년 만료), 민감 사진 보호
- **JWT 시크릿 가드**: `env.ts`에서 프로덕션 시 JWT_SECRET 미설정 → 즉시 크래시 (런타임 해킹 방지)
- **카카오 OAuth 상태 저장**: 인메모리 Map → Firestore `kakaoOAuthState` 컬렉션 (Cloud Functions 멀티인스턴스 대응)
- **XSS 방지**: 카카오 콜백 error_description HTML 엔티티 이스케이프
- **seed 라우트 제거**: 인증 없이 DB 삭제 가능한 보안 취약점 차단

#### 데이터 무결성
- **앨범 영구 저장**: `milestonePhotos` Firestore 컬렉션 + CRUD API (`album.ts`) + 프론트 연동
- **자장가 녹음 클라우드 저장**: 녹음 파일 Firebase Storage 업로드 → signed URL로 AsyncStorage 저장
- **서버 동기화**: 육아트래커/성장통계/앨범 사진 → AsyncStorage + 서버 fire-and-forget 동기화
- **맘스타그램/일기/프로필 사진**: 로컬 file:// → Storage 업로드 → 클라우드 URL 저장

#### 동시성/성능
- **FieldValue.increment()**: 맘스타그램 좋아요/댓글, 광고 클릭 카운터 → 원자적 증감
- **Firestore 쿼리 제한**: clinics/reviews/memories 등 무제한 쿼리에 `.limit()` 추가
- **타이머 메모리 누수**: growth-stats 저장 타이머 useEffect cleanup

#### 소유권 검증
- **SOS/예방접종**: childId에 대한 userId 소유권 확인 추가

#### 오디오 업로드 지원
- **백엔드 upload.ts**: `ALLOWED_MIME`에 audio/mp4, audio/wav, audio/aac 등 7개 추가
- **프론트 api.ts**: `uploadApi.upload()` mimeMap에 m4a/caf/3gp/wav/aac/mp3 추가
- **Storage rules**: album/lullaby 폴더 규칙 추가 (각각 50MB/10MB 제한)

### 3-10. 베이비타임 스타일 육아기록 재설계 + 열나요 스타일 열나 화면 (2026-04-14)

#### 육아기록 (baby-tracker.tsx) — 베이비타임 UX 적용
- **원탭 기록**: 소변/대변/소변+대변/간식은 탭 한 번에 기록 (모달 없음)
- **인라인 타이머**: 모유/낮잠/밤잠은 화면 상단에 실시간 타이머 표시, 정지 시 자동 기록
- **퀵액션 아이콘 바**: 탭 필터 제거, 전체 서브타입을 이모지 원형 버튼으로 표시
- **통합 타임라인**: 배변/수유/수면 분리 없이 전체 기록 시간순 표시
- **빠른 메모 프리셋**: 모달에서 "정상"/"묽음"/"잘 먹음" 등 원탭 입력
- **토스트 확인**: 기록 시 애니메이션 확인 메시지

#### 열나 화면 (fever.tsx) — 열나요 앱 간소화 적용
- **체온 입력**: 큰 숫자 입력 + 측정 부위 선택 (귀/이마/겨드랑이)
- **체온 해석**: 부위별 보정 (+0.5도), 4단계 색상 분류 (정상/미열/중등도/고열)
- **해열제 계산기**: 체중 기반 타이레놀/부루펜 용량 (sosApi.feverCalculator 활용)
- **교차복용 스케줄**: 타임라인 표시
- **복용 알림**: expo-notifications로 4시간/6시간 후 알림
- **체온 기록**: AsyncStorage에 최근 10건 저장 + 리스트 표시

#### 홈 + SOS 변경
- **홈 퀵버튼**: ALL_ACTIONS에 "열나" 추가 (infant/toddler만, fever 라우트)
- **SOS 간소화**: 해열제 계산기/MedicineCard/복용 알림 전부 제거 → fever.tsx로 이동

### 3-11. 음성 기록 (Siri/Google Assistant 연동) (2026-04-14)

#### 개요
"시리야 윤도 방금 밥먹었어 기록해줘" → 앱이 열리면서 자동으로 육아 기록 생성

#### 백엔드
- **POST /api/tracker/voice-parse**: 한국어 자연어 → TrackerRecord JSON 변환 (Gemini AI)
  - type/subType 매핑 (배변·수유·수면 전체 지원)
  - 시간 파싱 ("방금", "30분 전", "1시에" 등)
  - 양(ml)/시간(분)/아이 이름 추출
  - 유효성 검증 + fallback 처리
- **gemini.client.ts**: model 파라미터 오버라이드 지원 추가

#### 프론트엔드
- **voice.tsx**: 딥링크 처리 화면 (`amatda://voice?text=...`)
  - AI 텍스트 파싱 → 아이 매칭 → AsyncStorage 저장 → baby-tracker 이동
  - 마스코트 애니메이션 + 분석 중 상태 표시
  - 사용자 기본값 자동 적용 (분유량/수유시간/낮잠/밤잠)
- **voice-settings.tsx**: 음성 기록 설정 + 가이드 화면
  - 기본값 설정: 분유 기본량(ml), 모유 수유시간(분), 낮잠/밤잠 시간(분)
  - 등록된 아이 목록 + 기본 아이 표시
  - 음성 명령 예시 8가지 + TIP 박스
  - iOS Siri 단축어 / Android Google Assistant 설정 가이드 (단계별)
  - 프로필 메뉴에서 "음성 기록 설정" 항목으로 진입
- **baby-tracker.tsx**: voiceToast 파라미터 수신 → 토스트 표시 + 기록 리로드
- **api.ts**: trackerApi.voiceParse() 추가

#### 사용 방법
1. iOS: Siri Shortcuts에서 URL `amatda://voice?text={음성텍스트}` 열기 액션 설정
2. Android: Google Assistant Routines에서 동일 URL 열기 설정
3. 음성 명령 → Shortcut 실행 → 앱 열림 → AI 파싱 → 기록 완료

### 3-12. BabyTime 엑셀 가져오기 (2026-04-14)

#### 개요
BabyTime 앱에서 내보낸 엑셀 파일(.xlsx/.xls/.csv)을 업로드하면 기존 기록을 자동으로 가져옴

#### 백엔드
- **POST /api/tracker/import**: 엑셀 파일 업로드 → 파싱 → 날짜별 TrackerRecord 그룹핑 반환
  - xlsx(SheetJS) 라이브러리로 엑셀 파싱
  - 한국어/영어 카테고리 자동 매핑 (모유/분유/이유식/기저귀/수면 등 30+ 변환 룰)
  - 날짜/시간/양/시간 유연한 파싱 (엑셀 serial date, 오전/오후, YYYY-MM-DD, MM/DD/YYYY 등)
  - endTime → duration 자동 계산
  - Busboy 멀티파트 업로드 (rawBody 지원 for Cloud Functions)

#### 프론트엔드
- **baby-tracker.tsx**: "BabyTime 가져오기" 버튼 + expo-document-picker로 파일 선택
  - 엑셀 파일 선택 → 백엔드 업로드 → 파싱 결과 → AsyncStorage 날짜별 저장
  - 가져오기 완료 토스트 (N건 가져오기 완료!)
- **api.ts**: trackerApi.importExcel() 추가

### 3-13. 신규 파일 요약

| 파일 | 용도 |
|------|------|
| `backend/src/routes/upload.ts` | 멀티파트 파일 업로드 → Firebase Storage (이미지+영상+오디오) |
| `backend/src/routes/album.ts` | 마일스톤 앨범 CRUD API |
| `storage.rules` | Firebase Storage 보안 규칙 (pregnancy/profiles/momstagram/diary/album/lullaby) |
| `frontend/app/(main)/fever.tsx` | 열나요 스타일 열 체크 + 해열제 계산 화면 |
| `backend/src/routes/tracker.ts` | 음성 텍스트 파싱 API (한국어 → TrackerRecord JSON) |
| `frontend/app/voice.tsx` | 딥링크 음성 기록 처리 화면 |
| `frontend/app/(main)/voice-settings.tsx` | 음성 기록 설정 + 가이드 화면 |

### 3-15. 성장 앨범 자동생성 + 인프라 최적화 (2026-04-16)

#### Cloud Functions 함수 분리 (단일 함수 병목 해소)
- `api` 함수: 256MiB × concurrency 80 — 모든 비코칭 라우트
- `coachingApi` 함수: 1GiB × concurrency 5 — AI 코칭 전용
- 로컬 개발: `devApp` 단일 포트로 통합 (`FUNCTIONS_EMULATOR` 감지)
- **효과**: 코칭 API 느려져도 로그인/앨범 등 다른 API 무영향

#### LRU 캐시 + 원자적 Rate Limit (비용 절감)
- `backend/src/utils/lru-cache.ts`: TTL 지원 Map 기반 LRU 캐시
  - `tierCache`: 유저 티어 (2000 entries, 5분 TTL)
  - `childContextCache`: 아이 컨텍스트 (1000 entries, 10분 TTL)
  - `searchCache`: DB 검색 결과 (500 entries, 영구)
- Rate limit: Firestore 전체 쿼리 → `FieldValue.increment(1)` 원자적 단일 문서 카운터
- **효과**: Firestore 읽기 요청 약 60~80% 감소 (웜업 후)

#### 성장 앨범 PDF 자동생성 기능 (앱 핵심 기능)
- **업로드 파이프라인**: `expo-image-manipulator`로 기기 내 2버전 생성
  - thumb 400px/JPEG75 → 앱 표시용 (`growth_thumb/{childId}`)
  - print 1800px/JPEG88 → A4 인쇄용 (`growth_print/{childId}`)
  - 병렬 리사이즈 + 병렬 업로드 (`Promise.all`)
- **앨범 PDF 생성** (`backend/src/services/album.pdf.service.ts`):
  - A4 (595×842pt), 2×2 그리드, 사진 260×260pt center-crop
  - NotoSansKR 한국어 폰트 (로컬→Storage→Helvetica 폴백)
  - 표지(아이이름+기간+장수) + 월별 본문 + 마지막 페이지
  - 이미지 다운로드 병렬 처리, AbortSignal 15초 타임아웃
- **비동기 생성** (`POST /album/generate`):
  - 즉시 `{ albumId, status: "generating" }` 반환
  - `setImmediate`로 백그라운드 PDF 생성 (HTTP 타임아웃 회피)
  - 프론트 5초 폴링 → `GET /album/albums/:albumId/status`
- **최대 기간**: 84개월(7년) — 초등 입학 전까지 전체 기록 가능
- **폴링 최적화**: `useRef + hasGeneratingAlbum` 패턴으로 stale closure 방지

#### 신규 Firestore 인덱스 (쿼리 실패 방지)
| 컬렉션 | 필드 조합 |
|--------|---------|
| milestonePhotos | childId ASC + date ASC |
| milestonePhotos | childId ASC + date DESC |
| growthAlbums | childId ASC + createdAt DESC |
| dailyTracking | userId ASC + date DESC |

#### 버그 수정 (3라운드 테스트 후)
| 버그 | 수정 |
|------|------|
| `upload.ts` 폴더 정규식이 슬래시 제거 → `growth_thumb/abc123` → `growth_thumbabc123` | `[^a-zA-Z0-9_\\-/]` 로 슬래시 허용 + `\\.\\. ` 경로 탐색 차단 |
| `album.pdf.service.ts` pdfReady race condition: `doc.end()` 후 `on('end')` 등록 | `on('data')` 직후 Promise 등록 (doc.addPage() 전) |
| `const toDate = \`${dateTo}-31\`` 팬텀 날짜 | `new Date(year, month, 0).getDate()`로 실제 마지막 날 계산 |
| 앨범 폴링 `[albums]` 의존성 → 매 상태변경마다 interval 재생성 | `hasGeneratingAlbum` boolean 의존 + `albumsRef`로 stale closure 제거 |
| `updatedAt: new Date()` Firestore 정책 위반 (album.pdf, ask.handler) | `admin.firestore.FieldValue.serverTimestamp()` 교체 |
| 업로드 실패 시 로컬URI 폴백 사용자 미통지 | Alert 2단계 (일반화질 저장 / 완전실패) 추가 |

---

### 3-14. UI/UX 개선 + 상담이모 호칭 + 마일스톤 피드 일치 (2026-04-15)

#### 상담이모 호칭 개인화
- `parentRole` 필드 추가: 회원가입/별명설정/프로필수정에서 엄마/아빠 선택
- `prompt.builder.ts` SYSTEM_PROMPT: "{아이이름}어머님/아버님" 호칭 규칙 추가
- `ask.handler.ts`: Firestore 유저 문서에서 parentRole 읽어 PromptContext에 전달
- Runtime prompt에 `parentRole` 필드 포함 (기본/임산부 모드 모두)

#### 마일스톤/피드 표시 일치
- 기존 문제: 앨범 마일스톤은 구조화(emoji+label), 피드는 content 텍스트에 평문 임베드
- 수정: momstagram POST API에 `milestone`/`milestoneEmoji` 필드 추가
- `MomstagramPost` 인터페이스 + `ApiFeedPost` + 매퍼 함수에 필드 추가
- `PostCard.tsx`: milestone 뱃지 UI 렌더링 (주황 라운드 칩)
- `album.tsx` shareToMomstagram: 구조화된 마일스톤 필드 전달

#### 데이터 내보내기 2×2 성장앨범
- `exportBabyData()` 전면 재설계: 텍스트 테이블 → 포토 앨범 스타일
- 표지 페이지 (이름/나이/기질/생년월일)
- `albumApi.list()` 마일스톤 사진 2×2 그리드 (사진+마일스톤뱃지+메모+날짜)
- 관찰일기 카드 섹션 (최근 10건)

#### 기타 UI 개선 (이전 세션)
- 퀵메뉴 아이콘 확대 (56→64, 32→40)
- 발달포인트 섹션 삭제 (milestone_tip 필터)
- 하단탭 비활성 색상 강화 (#C0C0C0→#8E8E93, opacity 0.5→0.75)
- 스플래시 비디오 resizeMode cover→contain

---

## 4. 버그 수정 내역

### 기존 버그
| 버그 | 원인 | 수정 |
|------|------|------|
| 아이 사진 등록 후 사라짐 | backend POST에서 photoUri 미저장 | child.ts에 photoUri 필드 추가 |
| 맘스타그램 게시물 등록 후 사라짐 | fetchFeed가 로컬 posts 덮어쓰기 | 최근 60초 로컬 포스트 병합 로직 |
| "네, 좋아해요" 무관 질문으로 차단 | useless.filter에 대화 응답 미고려 | REPLY_PATTERNS 추가 (네/응/예/아니 등) |
| 첫 답변 시 키보드가 UI 가림 | KeyboardAvoidingView 미설정 | behavior="padding" + offset 90 (iOS) |
| 첫 질문이 답변하기 어려움 | 포괄적/추상적 질문 | 예/아니오 형태 + 빠른 답변 버튼 |
| expo-camera 플러그인 크래시 | 미설치 패키지 | 플러그인 제거 |
| datetimepicker 크래시 | Expo config plugin 미지원 | 플러그인 제거 |
| newArchEnabled 크래시 | reanimated 필수 | newArch 복원, edgeToEdge false |
| 탭바 시스템 네비게이션 겹침 | 높이/패딩 부족 | height 90, paddingBottom 30 |
| expo-router 라우트 경고 | 헬퍼 파일이 app/ 안에 위치 | utils/로 이동 |
| 카카오 로그인 브라우저 안닫힘 | WebBrowser API 사용 방식 | dismissBrowser 자동 닫힘 |
| Metro SyntaxError (cry-analyzer) | new Function() 패턴 | 일반 동적 import로 변경 |

### 2026-04-13 신규 버그 수정
| 버그 | 원인 | 수정 방법 |
|------|------|----------|
| **상담 짧은 답변 문맥 무시** ("아직은 없어" → 무관 질문 취급) | `useless.filter.ts`가 대화 중에도 짧은 답변을 차단 | ① 필터를 async로 변경 + `conversationSummaries` 조회하여 10분 내 대화 있으면 짧은 답변 통과 ② `ask.handler.ts`에 Step 7.5 추가: 15자 미만 메시지에 이전 AI 질문 프리픽스 ③ `prompt.builder.ts`에 대화 이어가기 규칙 강화 |
| **임신기록 저장 후 사라짐** (타임라인/목록 비어있음) | Firestore 복합 인덱스 없이 `.where('childId').orderBy('createdAt')` → 쿼리 실패 → 프론트 silent catch → 빈 화면 | `pregnancy.ts` 모든 쿼리에서 `.orderBy()` 제거 + 코드 내 정렬 + `firestore.indexes.json`에 복합 인덱스 추가 |
| **가족피드(맘스타그램) 500 에러** | `momstagram.ts` 피드 쿼리 `.where('userId','in').orderBy('createdAt')` 복합 인덱스 없음 | `.orderBy()` 제거 + 코드 내 정렬 + 인덱스 추가. 댓글/내 게시글 쿼리도 동일 패턴 수정 |
| **formatChild() 건강 정보 누락** | API 응답에 bloodType/momHeight 등 6개 필드 미포함 | `child.ts` formatChild()에 bloodType, specialNotes, momHeight, momWeight, momBloodType, momSpecialNotes 추가 |
| **GDM GET 쿼리 실패** | `.orderBy('date').orderBy('measuredAt')` 이중 orderBy 복합 인덱스 필요 | 두번째 orderBy 제거 + 인덱스 추가 |
| **임신 daily-insight 0개 반환** | `dailyInsight.handler.ts` 미등록 | `coaching/index.ts`에 핸들러 등록 |
| **메인탭 6개 → 5개** | 임당관리/정보편집 탭이 표시됨 | `_layout.tsx`에 `href: null` 추가하여 숨김 |
| **임신정보 삭제 시 오류** | 자녀 삭제 시 pregnancyRecords/momHealthChecks/gdmRecords 미포함 + batch 500개 초과 가능 | `child.ts` DELETE에 3개 컬렉션 추가 + 450개 단위 batch chunking |
| **업로드 "Unexpected end of form"** | Cloud Functions가 body를 pre-parse하여 `req.pipe(busboy)` 실패 | `req.rawBody` (Buffer) → `busboy.end(rawBody)` 방식으로 변경 |
| **Storage 버킷명 오류** | `amatda-parenting.appspot.com` 존재하지 않음 | `amatda-parenting.firebasestorage.app`으로 수정 |
| **baby-tracker.tsx 22 린트 에러** | `if (isPregnant) return` 이후 React hooks 호출 (Rules of Hooks 위반) | early return을 JSX 렌더 직전으로 이동, 모든 hooks를 컴포넌트 최상단에 유지 |
| **pregnancy.tsx Array 린트 경고** | `Array<{...}>` 제네릭 문법 사용 | `{...}[]` 문법으로 변경 |

### 2026-04-12 신규 버그 수정
| 버그 | 원인 | 수정 방법 |
|------|------|----------|
| **첫질문 AI 맥락 무시** | FirstTalkCard에서 "네 좀그래요"만 전송, 원래 질문 미포함 | onSelect 시 `[코치 질문: {질문}] {답변}` 형태로 컨텍스트 프리픽스 추가 (`FirstTalkCard.tsx`) |
| **AI 상담 대화 누적 안됨** | Firestore 복합 인덱스 없이 `orderBy('createdAt')` 사용 → 쿼리 실패 → catch에서 조용히 무시 → 빈 히스토리 → 매번 첫 대화 카드 노출 | `history.handler.ts`에서 orderBy 제거, 전체 조회 후 코드에서 정렬. Timestamp/string 혼합 타입도 `toTimeStr()` 헬퍼로 통일 처리 |
| **홈 메뉴 연령별 미적용** | `ALL_ACTIONS` 하드코딩, `getHomeMenus()` 미사용 | 각 액션에 `ages: AgeGroupKey[]` 속성 추가, `getActionsForAge(ageGroup)` 필터 함수 작성, `AllActionsGrid`에 `ageGroup` prop 전달 |
| **momstagram.ts TS2451** | 가족피드 전환 시 `const posts` 중복 선언 | 기존 `const posts = snap.docs.map(...)` 라인 제거 |
| **home.tsx children prop 린트** | ChildSelector의 prop명이 React 예약어 `children`과 충돌 | prop명 `children` → `items`로 변경 (ChildSelector.tsx + home.tsx 모두) |
| **privacy.tsx 이스케이프** | JSX 내 `"` 미이스케이프 | `&quot;`로 교체 |
| **ui-preview.tsx 이스케이프** | JSX 내 `'` 5개 미이스케이프 | `&apos;`로 교체 |
| **APK 빌드 실패 (Prebuild)** | `amatda-chime.wav` 파일명에 하이픈 → Android 리소스명 규칙 위반 (소문자 a-z, 0-9, 언더스코어만 허용) | `amatda_chime.wav`로 이름 변경 + app.json 참조 수정 |
| **APK 빌드 실패 (Gradle)** | `@sentry/react-native` 플러그인이 organization/project 설정 없이 등록 → Gradle 빌드 차단 | app.json plugins에서 Sentry 임시 제거 (코드는 유지, 설정 완료 후 재추가) |
| **OTA 적용 안됨 (롤백)** | 사용자 APK v1.5.0인데 코드 v2.0.5, 307파일/33000줄 변경 → 오래된 네이티브 코드와 호환 안 돼서 내장 번들로 롤백 | 새 APK v2.0.5 빌드하여 설치 (EAS Build preview 프로필) |

---

## 5. 백엔드 파일 구조

```
backend/src/
├── index.ts                    # Express 진입점
├── config/env.ts               # 환경변수
├── middleware/auth.ts           # JWT 인증
├── routes/
│   ├── auth.ts                 # 로그인/회원가입
│   ├── child.ts                # 자녀 CRUD + photoUri
│   ├── coaching.ts             # AI 상담 (10단계 파이프라인)
│   ├── coaching/
│   │   ├── ask.handler.ts          # 병렬 ask 핸들러
│   │   ├── firstTalk.handler.ts    # 첫 대화 생성
│   │   ├── analyzeMedia.handler.ts # 미디어 분석
│   │   └── history.handler.ts      # 상담 내역 + 마일스톤
│   ├── coparenting.ts          # 공동육아
│   ├── growth.ts               # 성장 기록
│   ├── memories.ts             # 1년전오늘/카드/타임라인
│   ├── momstagram.ts           # 가족 피드 (가족 전용)
│   ├── observation.ts          # 관찰 일기
│   ├── recommendations.ts      # 맞춤 추천
│   ├── retention.ts            # 리텐션 시스템
│   ├── sleep.ts                # 수면 분석
│   ├── sos.ts                  # SOS 응급 (증상체크/해열제/가족알림)
│   ├── pregnancy.ts            # 임신기록/엄마상태/주수별발달/타임라인
│   ├── vaccination.ts          # 예방접종 스케줄/완료기록/D-2,D-1 알림
│   ├── upload.ts               # 파일 업로드 (Firebase Storage)
│   └── subscription.ts         # 구독/결제
├── services/
│   ├── firestore.ts            # Firestore 컬렉션
│   ├── saju.calculator.ts      # 기질 분석 엔진
│   ├── social.auth.ts          # 소셜 로그인
│   ├── coaching.knowledge.ts   # 영유아 DB 140개
│   ├── coaching.knowledge.elementary-*.ts  # 초등 DB 270개
│   ├── growthAnalysis.ts       # 성장 분석
│   ├── passportImage.ts        # 여권 이미지
│   ├── sleep.knowledge.ts      # 수면 지식
│   └── coaching/
│       ├── types.ts              # 공유 타입 + 구독 설정 + 레벨 시스템
│       ├── useless.filter.ts     # 무관 질문 차단
│       ├── red.flag.detector.ts  # 레드플래그 감지
│       ├── db.searcher.ts        # DB 검색
│       ├── context.builder.ts    # 아이 컨텍스트
│       ├── conversation.summarizer.ts  # 대화 요약
│       ├── prompt.builder.ts     # 프롬프트 빌드
│       ├── gemini.client.ts      # Gemini API 클라이언트
│       ├── tracker.parser.ts     # 자연어 → 트래커 자동 파싱
│       ├── auto.diary.ts         # 자동 육아일기 + 감정 점수
│       ├── time.capsule.ts       # 타임캡슐
│       ├── emotion.detector.ts   # 부모 감정 감지
│       ├── milestone.detector.ts # 마일스톤 컨텍스트
│       ├── proactive.insight.ts  # 선제적 인사이트
│       ├── peer.comparison.ts    # 또래 비교 (VIP)
│       └── time.awareness.ts     # 시간 인식
├── utils/
│   ├── masking.ts              # 이름 마스킹
│   ├── response.ts             # 표준 응답
│   └── childAccess.ts          # 자녀 접근 권한
└── data/
    ├── growth-standards.ts     # 성장 기준 데이터
    └── recommendation-seeds.ts # 추천 시드 데이터
```

---

## 6. 프론트엔드 화면 구조

### 탭바 (5개)
홈 / 육아기록 / AI상담 / 가족피드 / 마이

### 주요 화면 (연령별 동적 UI)
- **홈**: 아이 선택, 성장 카운트다운, 육아력 스트릭, 오늘의 한마디, 주간리포트, **연령별 퀵액션** (영아/유아/초등 다른 메뉴), SOS 플로팅 버튼
- **AI 상담**: **연령별 카테고리바**, 채팅(레드플래그/답변/이유/해결/진료/팔로업), 입력(텍스트+사진)
- **육아기록**: **연령별 트래커탭** (영아: 배변/수유/수면, 초등: 식사/수면)
- **가족피드**: 가족 전용 피드 (familyMembers 기반), 좋아요/댓글
- **마이**: 프로필, 자녀카드, 설정, 구독, 개인정보

### 숨겨진 화면
SOS, 기질상세, 성장통계, 수면예측, 놀이학습, 학원추천, 자장가, 공동육아, 새싹부모, 타임라인, 소아과, 추천, 개인정보, 이용약관, 울음분석, 대변분석, 편집, 알림설정, 고객센터, 월별특징, 자녀카드, **임신기록(pregnancy)**, **접종달력(vaccination)**

---

## 7. Firestore 컬렉션
users, children, coachingSessions, followups, learnedKnowledge,
conversationSummaries, dailyTracking, observations, posts, postLikes,
postComments, clinics, clinicReviews, pushSchedules, subscriptions,
onboardingQuestions, foodGuides, academies, faq, recommendationCache,
familyMembers, timeCapsules, pregnancyRecords, momHealthChecks, vaccinations,
gdmRecords, autoDiaries, analysisUsage, milestoneChecks, sleepPredictions,
sleepKnowledgeCache, dailyTraits, milestonePhotos, kakaoOAuthState

---

## 8. 배포 정보
- **API**: https://api-usglfifguq-uc.a.run.app
- **Firebase**: amatda-parenting
- **EAS**: @song9912/amatda (ID: fe4c99cb-994f-4905-93f3-99aa93aea6ab)
- **OTA**: preview 브랜치 (최신 배포: 2026-04-13, Update ID: 0871fccb-3ae0-4ad8-ae32-04342705156d)
- **APK**: EAS Build preview 프로필 (v2.0.5, 빌드 ID: 99d6f1d1-3139-4f7f-8d6f-583d592ac68d)
- **Firebase Storage**: `amatda-parenting.firebasestorage.app` (이미지/동영상 클라우드 저장)
- **Git 커밋 이력** (2026-04-12~13):
  - `ae33933` docs: 임신 모드 프론트엔드 완료 현황 업데이트
  - `8adc7ac` fix: formatChild 건강필드 누락 + GDM 쿼리 인덱스 + 인사이트 핸들러 등록
  - `6d21aca` feat: 임당관리 + 건강정보 등록 + 아이/임신 정보 편집 + 임신모드 전면 개선
  - `ecdd12c` fix: Sentry 플러그인 임시 제거 (미설정으로 Gradle 빌드 실패)
  - `b6b5c0d` fix: amatda-chime → amatda_chime (Android 리소스명 규칙)
  - `2ae3ec3` fix: 첫질문 컨텍스트 누락 + 대화 히스토리 복구 + 홈 연령별 메뉴
  - `9d46cf3` feat: 구독 재설계 + 연령별 동적 UI + 가족피드 + SOS + 자동일기/타임캡슐
- **최신 배포** (2026-04-13 심야):
  - Backend: Firebase Functions 배포 완료 (upload API + delete cascade fix + momstagram query fix)
  - Frontend: OTA preview 배포 완료 (Instagram 임신기록 + Storage 업로드 + 앨범 내보내기 + 린트 수정)
- **최신 배포** (2026-04-16):
  - Backend: Firebase Functions 배포 완료
    - `api` 메모리 256MiB → 512MiB 증가 (OOM 수정: coaching 모듈 import로 269MiB 사용)
    - `fastApp`에서 `/api/coaching` 라우트 제거 (OTA 배포로 모든 클라이언트가 coachingApi URL 사용)
    - `buildChildContext()` 가족 구성원 권한 완화: `useCoaching` 퍼미션 불필요 (accepted familyMember면 허용)
    - `ask.handler.ts` Step 3에 상세 로깅 추가 (userId/childId 출력)
  - 검증: 로그인 HTTP 200 ✅, 코칭 HTTP 200 ✅, OOM 에러 없음 ✅

---

## 8-1. 임산부 지원 (백엔드 완료, 프론트 미완)

### 백엔드 완료
- **임산부 코칭 DB**: 77개 엔트리 (6개 카테고리)
  - `coaching.knowledge.pregnant.ts`: 47개 (입덧15 + 영양12 + 운동10 + 감정10)
  - `coaching.knowledge.pregnant2.ts`: 30개 (검진15 + 출산준비15)
- **DB 라우팅**: `db.searcher.ts`에 `isPregnant` 플래그 분기 추가
- **레드플래그**: `red.flag.detector.ts`에 임산부 전용 룰셋 추가
  - Emergency: 양수파수, 조기진통, 대량출혈, 전자간증, 태동감소, 경련, 탯줄탈출
  - Urgent: 질출혈, 규칙적수축, 심한복통, 급격한부종, 소변급감, 심한구토, 혈압상승
  - Monitor: 간헐적뭉침, 비정상분비물, 소량출혈, 심한입덧
- **프롬프트**: `prompt.builder.ts`에 임산부 전용 시스템 프롬프트 + 런타임 프롬프트 분기
- **컨텍스트**: `context.builder.ts`에서 `isPregnant` 감지 + 주수 자동 계산 (dueDate 역산)
- **응급대응**: `coaching.ts` EMERGENCY 분기에 임산부 전용 메시지
- **카테고리**: symptoms/nutrition/exercise/checkup/birth_prep/emotion 매핑
- **필터**: `useless.filter.ts`에 임산부 관련 키워드 추가

### 임신 모드 프론트엔드 (완료)
- 자녀 등록 시 "임신 중/태어남" 분기 + dueDate 입력
- 임산부용 홈 화면 퀵액션 (임신기록, 출산준비, 주수별발달, 태교음악, **임당관리**)
- 임신 트래커 (체중/혈압/태동/증상/검진/영양제)
- **임당관리(GDM)**: 혈당 기록 CRUD + 통계(평균/최대/최소/주의/위험 횟수) + 날짜별 그룹핑
- **아이/임신부 정보 편집**: child-edit 화면 (정보 수정 + 삭제)
- **건강정보 등록**: 아이(키/몸무게/혈액형/특이사항) + 임산부(키/몸무게/혈액형/특이사항)
- **formatChild() API 응답**: bloodType, specialNotes, momHeight, momWeight, momBloodType, momSpecialNotes 포함
- **프로액티브 인사이트**: 임신 주수별 맞춤 팁 + 산모 활동 추천 + 격려 메시지
- **자동AI일기 + 타임캡슐**: 임산부에서도 사용 가능
- **데이터 내보내기**: 2×2 앨범 스타일 (사진+마일스톤+캡션+날짜, 동영상은 첫프레임 캡처)
- SOS 화면 임산부 응급 증상 추가
- "출산했어요" 전환 플로우 (isPregnant=false, birthDate 입력)

### 프론트엔드 미완 (다음 단계)
- 주수별 태아 발달 화면 (상세 UI)

## 9. 미완성/다음 단계
- CLOVA 보이스 30개 제작 적용
- 푸시 알림 실제 연결 (expo-notifications + FCM)
- 결제 실제 연동 (PG사)
- 스토어 등록 (플레이스토어/앱스토어)
- 육아기록 UI 일러스트 전면 변경
- 톱니바퀴(icon-settings.png) 흰배경 투명화
- Sentry 설정 후 플러그인 재추가
- 타임캡슐 프론트엔드 UI 구현
- 자동육아일기 프론트엔드 표시 강화

---

## 10. 테스트 계정
- **이메일**: test@amatda.com / test1234
- **테스트 아이**: 윤도(20개월 남아 활동형), 승하(8세 여아 조화형)
- **카카오 JS키**: a621098190b12a58275dcb80e39a6c18

---

## 2026-04-30 — 열나열나 개편 + 일러스트/UI 정리 (진행 중)

### 완료
- **열나 → 열나열나 리네이밍** + "지능형 응급 가이드 플랫폼" 개편
  - `frontend/app/(main)/fever.tsx`: 측정 시각 DateTimePicker, 과거 시각 기록 가능
  - 액션 우선 메시지 카드 (`buildActionGuide`): emergency / high+해열제최근 / high+미복용 /
    moderate / mild / recovering 6단계 분기
  - 해열제 최근 복용 기록(`fever_medlog`) 교차 참조 → "N분 후 가능해요" / "지금 바로"
- **홈 메뉴 펄스 링** (`home.tsx`)
  - `useFeverAlert(childId)`: AsyncStorage `fever_history_${childId}` 4시간 내 38℃+ 감지
  - `FeverPulseCircle`: Animated.loop 빨간 링 애니메이션
- **삭제 아이 알림 정리** (push 잔여 알림 제거)
  - `services/pushNotifications.ts`: `cancelAllChildLocalNotifications`,
    `cancelAllPregnancyLocalNotifications`
  - `profile.tsx` + `child-edit.tsx`: 아이 삭제 시 호출
- **커스텀 3D 일러스트 일괄 적용** (이모지 → PNG)
  - `scripts/gen-quick-icons.py`: PIL로 7종 PNG 생성
    (thermometer/sprout/syringe/baby/blood/water/pill, 192×192)
  - 홈 메뉴 + DailyMissionBadges 등 적용
- **OTA 배포**: `fda12ecb-2e52-43f6-9eee-2fbba2b9db62` (production 채널)
- **커밋**: `71921f8 feat(fever): 열나 → 열나열나 + 지능형 응급 가이드 플랫폼`

### 미해결 이슈 (다음 작업)
1. **빨간 펄스 링 오작동**: 측정 기록이 없어도 링이 애니메이션됨
   - 원인 추정: `useFeverAlert`에서 stale AsyncStorage 데이터 / 빈 배열 검증 부족
   - 해결 방향: 배열 길이 체크 + childId 매칭 검증 + 마운트 시 명확한 false 초기화
2. **일러스트 비주얼 어색함**: "검은색 묻은거 처럼" 이상함, 기존 quick-X.png의
   3D 파스텔 아기자기 톤과 통일 안 됨
   - 원인 추정: PIL gradient 어두운 endpoint + core_shadow 진함
   - 해결 방향: 라이트 파스텔 팔레트, 코어 섀도우 약화, 화이트 하이라이트만 유지
3. **DailyMissionBadges 카드 높이 과다**: 위아래 폭 약 50% 줄여야 함
   - 수정 대상: `components/pregnancy/DailyMissionBadges.tsx`
     - `card.paddingVertical: 14 → 7`
     - `RING_SIZE: 56 → 40`, `RING_STROKE: 6 → 5`
     - `cardCountBig: 22 → 18`
     - `ringWrap.marginVertical: 4 → 2`

---

## 2026-04-30 ~ 2026-05-01 — 출시 직전 대규모 UI/UX 개편 + 인증 흐름 정리 (22회 OTA + 5회 Functions 배포)

### 배경
- 사용자 베타 테스트에서 발견된 회귀/UX 이슈 다수
- 임신앨범 ↔ 성장앨범 시각·구조 통일 요청
- 열나열나 화면 정보 과부하 → "초간결·직관적 UI" 전면 개편 요청
- 회원 탈퇴/재가입 동선 깨짐 (별명 화면 스킵 → 자녀등록 직행)
- 패키지명 변경 (`com.amatda.app` → `com.sylabs.amatda`) 후 Google/Naver 로그인 DEVELOPER_ERROR

### 1) 초기 fix 3건 — useFeverAlert · 일러스트 · DailyMissionBadges
- **useFeverAlert 검증 강화** (`frontend/app/(main)/home.tsx`)
  - `Array.isArray` 체크, `typeof number` type guard 추가
  - `ts <= 0 || ts > now` 미래/0 timestamp 거부
  - child 변경 시 즉시 `setIsAlert(false)`로 초기화 → stale 상태 방지
  - 가장 최근 측정값만 평가 (`valid.sort` + `latest`) → 36℃로 다시 측정 시 alert 자동 해제
- **7개 quick 아이콘 재생성** (`scripts/regen-quick-icons.cjs` 신규)
  - gpt-image-1로 thermometer/sprout/syringe/baby/blood/water/pill 신규 생성
  - PIL 스크립트의 검은 톤(core_shadow + ground_shadow) 제거
  - 기존 일관된 3D clay 스타일 적용
- **DailyMissionBadges 컴팩트화** (`frontend/components/pregnancy/DailyMissionBadges.tsx`)
  - 정사각형 카드 → 가로 row 레이아웃 (AI 분석 카드 높이와 동일)
  - paddingVertical 14 → 10, ringSize 56 → 38, 폰트 22 → 15
  - row paddingHorizontal 16 → 4 (그리드와 정렬)

### 2) 임신앨범 일러스트 12개 + 명칭·이모지 매핑 (3D clay 통일)
- **신규 일러스트 12개 생성** (`scripts/regen-pregnancy-icons.cjs`)
  - `contraction-clock.png` — 진통체크 (알람시계+분홍 하트)
  - `preg-test/stethoscope/ultrasound/leaf/ribbon/foot/bag.png`
  - `preg-mood-good/tired/nausea/pain.png` (엄마 상태 4종)
- **PREG_EMOJI_ICON 매핑** (`frontend/app/(main)/pregnancy.tsx`)
  - 시스템 이모지 27종 → 우리 일러스트 require() 매핑
  - `EmojiOrIcon` 헬퍼 컴포넌트 — 매핑 있으면 Image, 없으면 Text fallback
  - backend `MOM_SYMPTOM_PRESETS` 옛 이모지(🫠 😖 💩) 추가 매핑
- **"임신기록" → "임신앨범" 명칭 일괄 변경** (5곳)
  - `app/(main)/pregnancy.tsx` Stack.Screen title
  - `app/(main)/_layout.tsx` 탭 라벨
  - `constants/ageFeatures.ts` 홈 quick action
  - `app/(main)/home.tsx` quick action label
  - `app/(main)/album.tsx` 자동 병합 안내, `growth-stats.tsx` 힌트, `pregnancy.tsx` 빈상태, `components/profile/ProfileMenuList.tsx`
- **진통체크 박스** (`frontend/app/(main)/home.tsx`)
  - 정사각 76×76 줄바꿈 → 가로 row 패딩(10×6) + "진통 체크" 한 줄
  - 이모지 ⏱️ → contraction-clock.png 일러스트
- **mom_health emoji backend fix** (`backend/src/routes/pregnancy.ts`)
  - timeline 응답에서 emoji='🤰' 고정 → 첫 증상의 emoji로 동적 매핑

### 3) 열나열나 4단계 재설계 + UI 전면 개편
- **단계 1 — 시각 다이어트** (`frontend/app/(main)/fever.tsx`)
  - 폰트 30~50% 축소 (screenTitle 26→20, bigTempInput 48→34, levelEmoji 56→36 등)
  - 패딩·라운드 컴팩트화, 흰 베이스 + 포인트 컬러만 (코랄 #FF8C5A)
- **단계 2 — 체온/복용 이력 토글**
  - 메인엔 최신 1건만 표시, "전체 보기 (N건)" 토글로 5건/전체
- **단계 3 — 다음 행동 카드 (단일)**
  - `nextDoseCard` — 가장 빠른 다음 복용 1건만 큰 글씨
  - 같은 종류 + 교차 candidates에서 `Math.min(nextAt)` 선택
  - 교대 복용 스케줄 리스트 제거
- **단계 4 — 약 선택 슬림화 + 재개편**
  - 동적 가이드 헤드라인: "엄마, 당황하지 마세요!\n지금은 [약] [ml]ml 먹일 시간입니다"
  - 큰 용량 디스플레이 — 56pt 숫자 + 22pt "ml" 단위 분리
  - 약 선택 칩 (타이레놀/부루펜) 토글 → 상단 멘트 + 용량 실시간 연동
- **로직·계산식·저장구조 무변경**: `recalcSyrup`, `calcNextDoseAt`, `buildActionGuide`, Firestore 그대로

### 4) 임신앨범 ↔ 성장앨범 시각·구조 통일
- **B 단계 — 시각 통일** (pregnancy.tsx 스타일 정렬)
  - `currentBadge` 추가 ("🤰 현재 임신 N주차" pink pill)
  - `weekBadgeCurrent` 강조 색상 (#C2185B), 카드 본문/날짜 fontWeight: 600
- **C 단계 안전버전 — 표시만 통합** (`frontend/app/(main)/album.tsx`)
  - `PregnancyMemoriesSection` 신규 컴포넌트 (collapsible)
  - 출산 후에도 BabyAlbum 상단에 "🤰 임신앨범 기록 · 출산 전 N건" 섹션
  - **Firestore 스키마 변경 없음** (Rule of Two 안전)
- **100% UI 통일 (재구성)**
  - 임신앨범 페이지 전체 재배치: childLabel, AI 일기 버튼, "{N}장의 기록" 헤더, feedCard(이미지+strip+badge+memo), 임신앨범 만들기 섹션
  - feedCard 스타일 album.tsx에서 그대로 복사 (stripColor: health #E91E63, record #FF8C5A)
- **입출력 100% 통일**
  - 모달 기반 입력 → **인라인 compose 카드** (사진+칩+메모+저장)
  - 한 번 저장 = 한 카드 (이전엔 3+ 카드 분리)
  - `handleSaveUnified` 신설: chip.kind별 saveMomHealth / createRecord 분기
  - 사진 picker: `expo-image-picker` 갤러리 + 4:3 crop
- **마일스톤 emoji 직접 전송 fix** (`backend/src/routes/pregnancy.ts`)
  - frontend `createRecord`에 `milestoneEmoji` 필드 추가
  - backend AUTO_MILESTONES(10개)에 없어도 클라이언트 emoji 우선 사용
- **칩 2줄 분리** — "마일스톤" / "엄마 기분" 라벨별 한 줄씩
- **메모 placeholder** — "하고싶은 이야기나 진료기록을 메모하세요"
- **가족피드 공유 토글** — 자동 공유 → 체크박스 선택
  - backend `shareToFamily=true && mediaUri` 조건일 때만 posts 게시
- **주수별 질문 카드 컴팩트** — 큰 박스 → 가로 한 줄 (이미지 22px)

### 5) 인증 흐름 정리
- **이메일/소셜 가입 시 별명 화면 경유**
  - `(auth)/register.tsx`: 가입 직후 `/onboarding/set-nickname`으로
  - `hooks/useLoginHandlers.ts`: backend response 타입 명시, `isNewUser || !user.nickname`로 분기
- **backend isNewUser 정확화** (`backend/src/routes/auth.ts`)
  - 기존: `isNewUser: childSnap.empty` (자녀 보유 여부 — user 신규성과 무관)
  - 수정: user 문서 새로 생성됐을 때만 `isNewUser=true`
  - response에 `user.nickname`, `needsOnboarding` 추가
- **(auth)/_layout 가드 버그 수정**
  - 인증된 사용자가 `(auth)` 진입 시 home으로 강제 redirect → set-nickname 화면이 영영 안 보임
  - **최종 fix**: `set-nickname.tsx`를 `(auth)` 그룹 밖 `app/onboarding/`으로 이동 → 가드 영향 자체 차단
- **useFocusEffect 시도 → 롤백**
  - useFeverAlert를 useFocusEffect로 시도 (포커스마다 재조회)
  - 앱 hang 발생 (스플래시조차 안 시작) → 즉시 useEffect로 롤백 hotfix

### 6) 회원 탈퇴 + 소셜 unlink — 정석 패턴 A (Backend REST)
- **시도 1 — Frontend native SDK unlink (실패)**
  - 카카오/구글/네이버 SDK 직접 호출 → native crash → 제거
- **최종 — Backend REST API unlink (정석)** (`backend/src/services/social.auth.ts`)
  - `SocialUserInfo`에 `accessToken` 필드 추가
  - `unlinkSocialAccount()` 신설:
    - **카카오**: Admin Key 우선, fallback으로 user access_token
    - **네이버**: `grant_type=delete` + client_id/secret + access_token
    - **구글**: `https://oauth2.googleapis.com/revoke?token=...`
  - `auth.ts /auth/social*` 응답 후 user 문서에 `lastSocialAccessToken` 저장
  - `DELETE /auth/account`에서 user 데이터 삭제 *전*에 unlink 호출 (실패해도 진행)
- **카카오 Admin Key 등록**
  - `backend/.env`: `KAKAO_ADMIN_KEY=88d502f8588a27a665be117d6f70b9d5`
  - `backend/src/config/env.ts`: KAKAO_ADMIN_KEY env 노출
  - ⚠️ **채팅에 노출됨 — 재발급 권장**

### 7) APK 빌드 준비 (패키지명 변경)
- **패키지명**: `com.amatda.app` → `com.sylabs.amatda` (사용자 기존 작업)
- **SHA-1 keystore 동일성 확인**:
  - EAS keystore SHA-1: `A0:6C:19:3A:B3:16:FF:66:5C:B6:93:EC:47:A8:64:42:B2:8A:80:40`
  - google-services.json `com.amatda.app` SHA-1: `a06c193ab316ff665cb693ec47a86442b28a8040` ← 동일
  - **결론**: keystore 변경 없음, 빌드는 1회만 필요
- **Firebase Console**: `com.sylabs.amatda` + SHA-1 등록 후 google-services.json 새로 다운로드 → 적용 확인 (Python 파싱 검증)
- **Google Cloud Console**: OAuth 2.0 Android Client (`com.sylabs.amatda` + SHA-1) — 사용자 등록 완료 ("저장" 클릭 단계)
- **카카오/네이버 콘솔**: 새 패키지 등록 진행 중

### OTA 배포 이력 (이번 세션 22회)
| # | Update Group ID | 내용 |
|---|---|---|
| 1 | 9eb89032 | useFeverAlert 검증 + 카드 축소 + 검은톤 일러스트 재생성 |
| 2 | 8a8b3b86 | 진통체크 → quick-baby 이미지 + DailyMission 카드 재반영 |
| 3 | e7b6febb | useFeverAlert 최신값+해제 / 열나열나 AI글로우 / 임신부 AI카드 숨김 / 물·영양제 컴팩트 |
| 4 | ed7cee15 | fever 4단계 재설계 (시각 다이어트, 토글, 다음 행동, 슬림 약 선택) |
| 5 | 25dc4cba | 임신앨범 일러스트 12개 + 명칭 변경 + 이모지 매핑 |
| 6 | 1b1e193e | 임신기록 잔여 5곳 변경 / 진통체크 가로 / quickCircle 3D / 옛이모지 매핑 |
| 7 | 7ed50338 | 임신앨범 B단계 — 시각 통일 |
| 8 | 83b08fad | C단계 안전버전 — PregnancyMemoriesSection collapsible |
| 9 | 3bd9daa9 | 임신앨범 100% 시각 통일 — feedCard 등 |
| 10 | c1f700fa | 임신앨범 입출력 100% 통일 — 인라인 compose, 한번저장=한카드 |
| 11 | 03013a79 | 열나열나 UI 전면 개편 — 동적 가이드 + 큰 용량 + 약 칩 토글 |
| 12 | ffa32358 | 칩 2줄 분리 + 메모 placeholder + useFocusEffect (이후 롤백) |
| 13 | 62a2e758 | 가족피드 공유 토글 + 별명 설정 + 주수별 질문 컴팩트 |
| 14 | 8b9e54f6 | 마일스톤 emoji 클라이언트 직접 전송 |
| 15 | cf9cefc7 | 소셜 isNewUser 정확화 + nickname 응답 |
| 16 | 0c2351ab | useLoginHandlers 디버그 로그 |
| 17 | e945383b | (auth) layout 가드 set-nickname 예외 |
| 18 | 3355a5d5 | set-nickname → onboarding/ 디렉토리 이동 |
| 19 | fdb45d74 | 회원 탈퇴 시 소셜 unlink (1차 — frontend native) |
| 20 | 41bf3314 | 탈퇴 crash 수정 — fire-and-forget |
| 21 | d831705e | hotfix: useFocusEffect 롤백 |
| 22 | 4d17074f | 소셜 unlink backend REST 일원화 (정석 패턴 A) |

### Backend 배포 (Firebase Functions, 5회)
1. mom_health emoji 첫 증상 매핑
2. shareToFamily 옵션화 + nickname 응답 + isNewUser 정확화
3. milestoneEmoji 클라이언트 우선
4. social isNewUser 정확화 (재배포)
5. 소셜 unlink REST API + lastSocialAccessToken 저장

### 검증
- frontend `npx tsc --noEmit` → 0 에러 (전 변경)
- backend `npx tsc --noEmit` → 0 에러
- backend `firebase deploy --only functions:api` → 모두 성공
- adb logcat으로 hang/crash 진단 (`com.amatda.app`)

### 남은 이슈 (출시 전)
1. **APK 빌드 미실행** — 사용자가 EAS 무료 크레딧 리셋 후 진행 예정 (`eas build -p android --profile preview`)
2. **카카오/네이버 콘솔 등록 확인 필요** — 새 패키지 `com.sylabs.amatda` + SHA-1
3. **Google Cloud Console 저장** — 사용자 화면 캡처에서 입력 완료, "저장" 클릭만 남음
4. **결제 회사 가입 진행 중** — PortOne·카카오페이·네이버페이 키 발급 후 backend `.env` 등록
5. **🚨 카카오 Admin Key 채팅 노출** — `88d502f8...` 재발급 권장
6. **🚨 OpenAI API Key 채팅 노출** (이전) — `sk-proj-...` 재발급 권장
7. **이미 저장된 옛 임신 기록** — emoji=null인 채로 남아 fallback 📌 표시 (마이그레이션 필요, 출시 후)
8. **데이터 모델 통합 (C-2 마이그레이션)** — pregnancyRecords + milestonePhotos → 단일 컬렉션. 출시 후 별도 진행

### 신규/수정 파일 요약

**Frontend**:
- `app/(main)/home.tsx` — useFeverAlert, FeverPulseCircle 글로우, 진통체크 가로, quickCircle 3D
- `app/(main)/fever.tsx` — 4단계 재설계 + UI 전면 개편
- `app/(main)/pregnancy.tsx` — 인라인 compose, feedCard, EmojiOrIcon, 가족피드 토글, 컴팩트 질문
- `app/(main)/album.tsx` — PregnancyMemoriesSection (collapsible)
- `app/(main)/_layout.tsx` — 임신앨범 탭 라벨
- `app/(auth)/_layout.tsx` — set-nickname 예외 가드
- `app/(auth)/register.tsx` — set-nickname 경유
- `app/onboarding/set-nickname.tsx` — **신규** ((auth) 그룹 밖)
- `components/pregnancy/DailyMissionBadges.tsx` — 가로 컴팩트
- `components/home/ChildSelector.tsx` — marginBottom xs
- `components/profile/ProfileMenuList.tsx` — 임신앨범 라벨
- `hooks/useLoginHandlers.ts` — backend response 타입, isNewUser 분기
- `services/api.ts` — createRecord에 milestoneEmoji + shareToFamily
- `services/social-auth.ts` — directLogin nickname null 처리
- `app/(main)/profile.tsx` — 회원 탈퇴 backend 위임 (frontend native SDK 호출 제거)
- `constants/ageFeatures.ts` — 임신앨범 라벨

**Backend**:
- `src/routes/auth.ts` — isNewUser 정확화, nickname 응답, lastSocialAccessToken 저장, DELETE /account에 unlink
- `src/routes/pregnancy.ts` — mom_health emoji 첫 증상 매핑, milestoneEmoji 클라이언트 우선, shareToFamily 옵션
- `src/services/social.auth.ts` — SocialUserInfo.accessToken 추가, unlinkSocialAccount() 신설
- `src/config/env.ts` — KAKAO_ADMIN_KEY 노출
- `.env` — KAKAO_ADMIN_KEY 추가

**Scripts (신규)**:
- `scripts/regen-quick-icons.cjs` — quick 아이콘 7개 gpt-image-1 재생성
- `scripts/regen-pregnancy-icons.cjs` — 임신앨범 일러스트 12개 신규 생성

**Assets (신규 + 재생성, 19개)**:
- `quick-thermometer/sprout/syringe/baby/blood/water/pill.png` (재생성)
- `contraction-clock.png`
- `preg-test/stethoscope/ultrasound/leaf/ribbon/foot/bag.png`
- `preg-mood-good/tired/nausea/pain.png`
