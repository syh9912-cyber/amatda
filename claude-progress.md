# 아맞다(A-matda) 개발 진행 현황
> 최종 업데이트: 2026-04-12

---

## 1. 프로젝트 개요
- **앱 이름**: 아맞다 (A-matda) — "아(이)맞(춤)다(이어리)"
- **목적**: AI 기반 영유아~초등 육아 코칭 앱
- **회사명**: SY Labs
- **기술 스택**: React Native (Expo SDK 54) + Express/Firebase Cloud Functions + Firestore + Gemini 2.5 Flash Lite

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
- **코칭 DB**: 총 410개 (영유아 140 + 초등저 135 + 초등고 135)
- **카테고리**: 울음/수면/식사/대변/사회성/성장/행동/기타
- **무료/유료 차등**: 일 10회/무제한, 답변길이, DB후보수, 맥락유지기간

### 2-4. AI 코칭 첫 대화 (First Talk)
- 아이 등록 후 AI가 기질/월령별 맞춤 첫 질문 생성
- 간단한 예/아니오 형태 질문 ("밤에 자주 깨는 편인가요?")
- 빠른 터치 답변 버튼 3개 + 직접 입력 가능
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

### 2-6. 맘스타그램 (소셜 피드)
- 인스타그램 스타일 피드 (좋아요/댓글/공유)
- 게시물 등록 시 로컬 즉시 반영 + 서버 동기화 (경합 방지)
- 성장 타임라인에서 맘스타그램 동시 공유 토글 기능

### 2-7. 육아 기록 (Baby Tracker)
- 배변/수유/수면 3탭 구성
- 타임라인 뷰 + 날짜 이동
- Firestore dailyTracking 컬렉션 저장

### 2-8. 성장/발달 기능
- 발달 체크리스트 (26개 연령 포인트, 1~144개월)
- 타임라인 마일스톤 27개
- 키/몸무게 날짜별 입력 + 기록 히스토리
- 개월별 발달 특징 화면

### 2-9. 분석기
- 대변 분석기: 사진+특성 선택 → 규칙 기반 분석 (poopAnalysisData.ts)
- 울음 분석기: 녹음+특성 선택 → 규칙 기반 분석 (cryAnalysisData.ts)

### 2-10. 기타 완성 기능
| 기능 | 상태 |
|------|------|
| 추천 시스템 (DB-first + AI 폴백) | ✅ |
| 학습 활동 (5기질 x 6활동 = 30개) | ✅ |
| 아이 카드 (SNS 바이럴용, 여권 스타일) | ✅ |
| 관찰 일기 | ✅ |
| 성장 앨범 | ✅ |
| 학원 추천 (LBS) | ✅ |
| 영양 가이드 | ✅ |
| 기질 날씨 | ✅ |
| 소아과 후기 (별점 4종) | ✅ |
| 구독 시스템 (월4,900/연39,900) | ✅ |
| 리텐션 (스트릭/카운트다운/팁/푸시) | ✅ |
| 고객센터 (FAQ + 메일 문의) | ✅ |

---

## 3. UI/디자인 완성 내역

### 3-1. 에셋 이미지 (135개 생성 완료)
- fal.ai FLUX 모델로 3D Pixar 스타일 자동 생성
- 20개 카테고리: app-icon, mascot, trait, onboarding, tab, category, empty, quick, weather, academy, coaching, profile, feature, premium, mood, analyzer, growth, support, play, passport
- 생성 스크립트: `scripts/generate-assets.mjs`

### 3-2. 전체 앱 emoji → Image 교체 완료
- 탭바 아이콘 5개
- 홈 퀵액션/추천카테고리/헤더 아이콘
- AI 코칭 전체 (코치 아바타, 카테고리바, 체크인, 메시지, 입력, 분석결과)
- 맘스타그램 카메라 아이콘
- 프로필/아바타

### 3-3. 스플래시 화면
- LinearGradient 피치/코랄 배경
- 14개 보케 파티클 + 6개 반짝이 펄스
- 마스코트 바운스 + 글로우 + 텍스트 확장 애니메이션
- SY Labs 푸터

### 3-4. 아이 카드 (SNS 바이럴)
- 프리미엄 다크 네이비 배경 + 골드 데코
- 기질별 컬러 맞춤 + D-day 배지
- react-native-view-shot 캡처 → 공유

### 3-5. 프로필 메뉴 아이콘
- 30x30 → 42x42로 확대

---

## 4. 버그 수정 내역

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
│   │   ├── firstTalk.handler.ts    # 첫 대화 생성
│   │   ├── analyzeMedia.handler.ts # 미디어 분석
│   │   └── history.handler.ts      # 상담 내역
│   ├── memories.ts             # 1년전오늘/카드/타임라인
│   ├── clinic.ts               # 소아과 후기
│   ├── retention.ts            # 리텐션 시스템
│   ├── subscription.ts         # 구독/결제
│   ├── momstagram.ts           # 소셜 피드
│   ├── observation.ts          # 관찰 일기
│   ├── food.ts                 # 영양 가이드
│   └── academy.ts              # 학원 추천
├── services/
│   ├── firestore.ts            # Firestore 컬렉션
│   ├── saju.calculator.ts      # 기질 분석 엔진
│   ├── coaching.knowledge.ts   # 영유아 DB 140개
│   ├── coaching.knowledge.elementary-*.ts  # 초등 DB 270개
│   └── coaching/
│       ├── types.ts              # 공유 타입
│       ├── useless.filter.ts     # 무관 질문 차단
│       ├── red.flag.detector.ts  # 레드플래그 감지
│       ├── db.searcher.ts        # DB 검색
│       ├── context.builder.ts    # 아이 컨텍스트
│       ├── conversation.summarizer.ts  # 대화 요약
│       ├── prompt.builder.ts     # 프롬프트 빌드
│       └── gemini.client.ts      # Gemini API 클라이언트
└── utils/
    ├── masking.ts              # 이름 마스킹
    └── response.ts             # 표준 응답
```

---

## 6. 프론트엔드 화면 구조

### 탭바 (5개)
홈 / 기질분석 / AI상담 / 맘스타그램 / 성장앨범

### 주요 화면
- **홈**: 아이 선택, 성장 카운트다운, 육아력 스트릭, 오늘의 한마디, 주간리포트, 퀵액션
- **AI 상담**: 카테고리바, 채팅(레드플래그/답변/이유/해결/진료/팔로업), 입력(텍스트+사진+음성)
- **기질 분석**: 기질 카드, 기질 상세
- **맘스타그램**: 피드, 좋아요/댓글
- **성장 앨범**: 타임라인, 마일스톤, 맘스타그램 동시 공유 토글

---

## 7. Firestore 컬렉션
users, children, coachingSessions, followups, learnedKnowledge,
conversationSummaries, dailyTracking, observations, posts, postLikes,
postComments, clinics, clinicReviews, pushSchedules, subscriptions,
onboardingQuestions, foodGuides, academies, faq, recommendationCache

---

## 8. 배포 정보
- **API**: https://api-usglfifguq-uc.a.run.app
- **Firebase**: amatda-parenting
- **EAS**: @song9912/amatda
- **OTA**: preview 브랜치 (최신 배포: 2026-04-12)
- **APK**: EAS Build preview 프로필

---

## 9. 미완성/다음 단계
- 개월별 발달 특징 데이터 78개 생성 (monthlyCharacteristics.ts 스텁만 완료)
- CLOVA 보이스 30개 제작 적용
- 푸시 알림 실제 연결 (expo-notifications + FCM)
- 결제 실제 연동 (PG사)
- 스토어 등록 (플레이스토어/앱스토어)
- 육아기록 UI 일러스트 전면 변경
- 톱니바퀴(icon-settings.png) 흰배경 투명화
- 팔로업 알림 시스템 (건강 질문→다음날 피드백)
- 1주일 비활동 시 재접속 유도 알림

---

## 10. 테스트 계정
- **이메일**: test@amatda.com / test1234
- **테스트 아이**: 윤도(20개월 남아 활동형), 승하(8세 여아 조화형)
- **카카오 JS키**: a621098190b12a58275dcb80e39a6c18
