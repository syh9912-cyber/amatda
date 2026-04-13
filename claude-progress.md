# 아맞다(A-matda) 개발 진행 현황
> 최종 업데이트: 2026-04-13

---

## 1. 프로젝트 개요
- **앱 이름**: 아맞다 (A-matda) — "아(이)맞(춤)다(이어리)"
- **목적**: AI 기반 영유아~초등 육아 코칭 앱
- **회사명**: SY Labs
- **기술 스택**: React Native (Expo SDK 54) + Express/Firebase Cloud Functions + Firestore + Gemini 2.5 Flash Lite
- **현재 버전**: 2.1.0 (runtimeVersion: 1.0.0)

---

## 2. 완성된 핵심 기능

### 2-1. 인증/회원
- 이메일 회원가입/로그인 (JWT)
- 카카오 소셜 로그인 (WebBrowser.openBrowserAsync + 자동 닫힘)
- 비밀번호 설정/변경 (이중확인 모달)
- 프로필 수정 (닉네임/비밀번호)

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
familyMembers, timeCapsules, pregnancyRecords, momHealthChecks, vaccinations

---

## 8. 배포 정보
- **API**: https://api-usglfifguq-uc.a.run.app
- **Firebase**: amatda-parenting
- **EAS**: @song9912/amatda (ID: fe4c99cb-994f-4905-93f3-99aa93aea6ab)
- **OTA**: preview 브랜치 (최신 배포: 2026-04-12)
- **APK**: EAS Build preview 프로필 (v2.0.5, 빌드 ID: 99d6f1d1-3139-4f7f-8d6f-583d592ac68d)
- **Git 커밋 이력** (2026-04-12):
  - `9d46cf3` feat: 구독 재설계 + 연령별 동적 UI + 가족피드 + SOS + 자동일기/타임캡슐
  - `2ae3ec3` fix: 첫질문 컨텍스트 누락 + 대화 히스토리 복구 + 홈 연령별 메뉴
  - `b6b5c0d` fix: amatda-chime → amatda_chime (Android 리소스명 규칙)
  - `ecdd12c` fix: Sentry 플러그인 임시 제거 (미설정으로 Gradle 빌드 실패)

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
- **데이터 내보내기**: 임신 타임라인 + 마일스톤 포함
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
