# 아맞다(A-matda) 프로젝트 현황

> AI 기반 영유아~초등 육아 코칭 앱
> 최종 업데이트: 2026-04-07

---

## 기술 스택
- Frontend: React Native (Expo SDK 54), TypeScript, expo-router, Zustand
- Backend: Express + TypeScript, Firebase Cloud Functions (Node.js 22)
- Database: Firestore
- AI: Google Gemini 2.5 Flash Lite
- 배포: EAS Build (APK) + OTA (expo-updates)

## 계정/URL
- Firebase 프로젝트: amatda-parenting
- API: https://api-usglfifguq-uc.a.run.app
- EAS: @song9912/amatda (ID: fe4c99cb-994f-4905-93f3-99aa93aea6ab)
- 테스트 계정: test@amatda.com / test1234
- 테스트 아이: 윤도(20개월 남아 활동형), 승하(8세 여아 조화형)
- Gemini API Key: .env에 설정됨

---

## 완성된 기능 목록

### 코어 기능
| 기능 | API | 상태 |
|------|-----|------|
| 회원가입/로그인 (JWT) | POST /api/auth/login, register | ✅ |
| 자녀 등록/관리 (CRUD) | /api/children | ✅ |
| 사주 기질 분석 (5종) | 온보딩 시 자동 | ✅ |
| 온보딩 설문 (20문항) | /api/onboarding | ✅ |

### AI 코칭 (10단계 파이프라인)
| 단계 | 설명 |
|------|------|
| 1 | 입력 받기 (message, category, childId) |
| 2 | 쓸모없는 질문 차단 (장난/무관/모호) |
| 3 | 레드플래그 검사 (발열/혈변/경련→진료안내) |
| 4 | DB 410개 중 상위 2~4개 참고자료 검색 |
| 5 | 이전 대화 요약 불러오기 (5~8줄) |
| 6 | 최근 3턴 원문 불러오기 |
| 7 | 아이 프로필+기질+최근기록 조합 |
| 8 | System Prompt + Runtime Prompt → Gemini 전송 |
| 9 | 응답 포맷 정리 + 프론트 응답 |
| 10 | 대화 요약 저장 |

### AI 코칭 API
| API | 용도 |
|-----|------|
| POST /api/coaching/ask | 메인 상담 (개인화 답변) |
| GET /api/coaching/history/:childId | 상담 내역 |
| GET /api/coaching/followups/:childId | 팔로업 목록 |
| POST /api/coaching/followup/:id/respond | 팔로업 응답 |
| POST /api/coaching/first-talk | 온보딩 후 AI 첫 대화 |
| POST /api/coaching/weekly-report | 주간 AI 리포트 |
| GET /api/coaching/milestones/:childId | 성장 마일스톤 |
| POST /api/coaching/daily-diary | AI 육아일기 자동생성 |
| POST /api/coaching/parent-mental | 부모 멘탈 감지 |
| POST /api/coaching/future-predict | 기질 기반 미래 예측 |
| POST /api/coaching/now-activity | 실시간 활동 추천 |
| POST /api/coaching/analyze-media | 울음/대변 AI 분석 |

### 코칭 DB (총 410개)
| 연령대 | 파일 | 엔트리 수 |
|--------|------|----------|
| 영유아 (0~6세) | coaching.knowledge.ts | 140개 |
| 초등 저학년 (7~9세) | elementary-low 1/2/3.ts | 135개 (45x3) |
| 초등 고학년 (10~12세) | elementary-high 1/2/3.ts | 135개 (45x3) |

카테고리: 수면, 식사, 행동, 사회성, 성장, 정서, 교육, 건강, 생활습관

### 추억/카드 기능
| API | 용도 |
|-----|------|
| GET /api/memories/year-ago/:childId | 1년 전 오늘 |
| GET /api/memories/child-card/:childId | 아이 디지털 카드(명함) |
| GET /api/memories/timeline/:childId | 성장 타임라인 |

### 소아과 후기
| API | 용도 |
|-----|------|
| GET /api/clinics/nearby?lat=&lng=&radius= | 주변 소아과 |
| POST /api/clinics/review | 후기 작성 (별점4종+한마디) |
| GET /api/clinics/:clinicId/reviews | 병원별 후기 |
| GET /api/clinics/my-reviews | 내 후기 |

별점: 친절도, 대기시간, 편의성, 전문성 (각 1~5)

### 구독 시스템
| API | 용도 |
|-----|------|
| GET /api/subscriptions/premium/plans | 요금제 목록 |
| GET /api/subscriptions/premium/status | 구독 상태 |
| POST /api/subscriptions/premium/start-trial | 체험판 시작 (30일) |
| POST /api/subscriptions/premium/subscribe | 유료 구독 |

- 1달 무료 체험 → 7일 전 경고 → 무료 전환
- 월 4,900원 / 연 39,900원 (32% 할인)
- 결제: 카드, 카카오페이, 네이버페이, 토스, 무통장입금
- 무료 vs 유료: 일10회제한/무제한, 답변길이, DB후보수, 맥락유지기간

### 리텐션 기능
| API | 용도 |
|-----|------|
| GET /api/retention/daily-card/:childId | 오늘의 한마디 (기질맞춤 팁) |
| GET /api/retention/streak/:childId | 육아력 스트릭 (레벨 시스템) |
| GET /api/retention/countdown/:childId | 성장 카운트다운 (D-day) |
| POST /api/retention/push-schedule | 푸시 알림 설정 |
| GET /api/retention/push-content/:childId | 푸시 콘텐츠 생성 |

레벨: 새싹부모(1-3일) → 성장부모(4-7) → 열정부모(8-14) → 베테랑부모(15-30) → 마스터부모(31+)

### 기타 기능
| 기능 | 상태 |
|------|------|
| 맘스타그램 (소셜 피드) | ✅ |
| 관찰 일기 | ✅ |
| 성장 앨범 | ✅ |
| 베이비 트래커 (수유/수면/배변) | ✅ |
| 학원 추천 (LBS) | ✅ |
| 영양 가이드 | ✅ |
| 기질 날씨 | ✅ |

---

## 프론트엔드 화면 구조

### 탭 바 (5개)
홈 / 기질분석 / AI상담 / 맘스타그램 / 성장앨범

### 홈 화면 구성 (위→아래)
1. 아이 선택 + 프로필
2. 성장 카운트다운 ("이 세상에 온 지 592일째")
3. 육아력 스트릭 ("연속 7일! 열정부모 Lv.3")
4. 오늘의 한마디 카드 (공유 가능)
5. 주간 리포트 (월요일 표시)
6. AI 육아일기 (당일 상담 있을 때)
7. 퀵 액션 (기질요약/리포트/일기/학습)
8. 이번 주 추천

### AI 상담 화면 구성
1. 1년 전 오늘 배너 (있을 때만)
2. 팔로업 카드
3. 체크인 카드 (첫 방문)
4. 카테고리 바 (울음/수면/식사/대변/사회성/성장/행동/기타)
5. 채팅 메시지 (부모/코치)
6. 코치 메시지 구성: 레드플래그(빨강) → 답변 → 이유(노랑) → 해결방법(민트) → 진료안내(파랑) → 팔로업(보라) → 맞춤한마디
7. 입력 (텍스트 + 사진 + 음성)

---

## 백엔드 파일 구조

```
backend/src/
├── index.ts                    # Express 진입점
├── config/env.ts               # 환경변수
├── middleware/auth.ts           # JWT 인증
├── routes/
│   ├── auth.ts                 # 로그인/회원가입
│   ├── child.ts                # 자녀 CRUD
│   ├── coaching.ts             # AI 상담 (10단계) + 킬러기능 5개
│   ├── memories.ts             # 1년전오늘/아이카드/타임라인
│   ├── clinic.ts               # 소아과 후기
│   ├── retention.ts            # 리텐션 (카운트다운/스트릭/팁/푸시)
│   ├── subscription.ts         # 구독/결제
│   ├── momstagram.ts           # 소셜 피드
│   ├── observation.ts          # 관찰 일기
│   ├── food.ts                 # 영양 가이드
│   ├── academy.ts              # 학원 추천
│   └── ...
├── services/
│   ├── firestore.ts            # Firestore 컬렉션
│   ├── saju.calculator.ts      # 기질 분석 엔진
│   ├── coaching.knowledge.ts   # 영유아 DB (140개)
│   ├── coaching.knowledge.elementary-low.ts   # 초등저 (45개)
│   ├── coaching.knowledge.elementary-low2.ts  # 초등저 (45개)
│   ├── coaching.knowledge.elementary-low3.ts  # 초등저 (45개)
│   ├── coaching.knowledge.elementary-high.ts  # 초등고 (45개)
│   ├── coaching.knowledge.elementary-high2.ts # 초등고 (45개)
│   ├── coaching.knowledge.elementary-high3.ts # 초등고 (45개)
│   └── coaching/
│       ├── types.ts              # 공유 타입 + 티어 설정
│       ├── useless.filter.ts     # 무관질문 차단
│       ├── red.flag.detector.ts  # 레드플래그 감지
│       ├── db.searcher.ts        # DB 검색 (연령별 분기)
│       ├── context.builder.ts    # 아이 컨텍스트 빌드
│       ├── conversation.summarizer.ts  # 대화 요약
│       └── prompt.builder.ts     # 프롬프트 빌드
└── utils/
    ├── masking.ts              # 이름 마스킹
    └── response.ts             # 표준 응답
```

## Firestore 컬렉션
users, children, coachingSessions, followups, learnedKnowledge,
conversationSummaries, dailyTracking, observations, posts, postLikes,
postComments, clinics, clinicReviews, pushSchedules, subscriptions,
onboardingQuestions, foodGuides, academies, faq, ads

---

## 제작 대기 목록

### 에셋 이미지 (ASSET-LIST.md)
- 총 108개 (캐릭터/기질/온보딩/탭바/카테고리/빈상태/날씨/학원/코칭/프로필/구독/감정)

### 보이스 음성 (VOICE-LIST.md)
- 총 30개 (온보딩5/매일인사6/AI상담8/특별기능7/수면4)
- CLOVA Voice 제작 예정, frontend/assets/voice/ 디렉토리 준비됨

---

## 최근 빌드/배포
- Firebase API: 배포 완료
- OTA: production 브랜치 배포 완료
- APK: https://expo.dev/accounts/song9912/projects/amatda/builds/a5165ec1-2a66-44e7-9300-bf851000ae0f

## 테스트 결과
- 전체 API: 24/24 PASS
- AI 상담 시나리오: 20개 테스트 완료 (기질맞춤 개인화 확인)

---

## 다음 단계 (미완성)
1. 에셋 이미지 108개 제작 적용 (이모지→커스텀 일러스트)
2. CLOVA 보이스 30개 제작 적용
3. 푸시 알림 실제 연결 (expo-notifications)
4. 결제 실제 연동 (PG사 연동)
5. 소셜 로그인 (구글/카카오/네이버) 실제 연동
6. 프론트엔드 전체 UI 고퀄 디자인 적용
7. 스토어 등록 (플레이스토어/앱스토어)
