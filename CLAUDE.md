# CLAUDE.md — 아맞다(A-matda) 프로젝트 컨텍스트

> 이 파일은 Claude Code가 프로젝트를 이해하고 자율 개발할 수 있도록 작성된 컨텍스트 파일이다.
> 프로젝트 루트(`amatda/`)에 위치시켜라.

---

## 프로젝트 개요

**아맞다(A-matda)**는 아이의 생년월일시를 기반으로 고유 기질을 분석하고, 연령·성별·기질에 맞춘 육아 솔루션(영양, 교육, 활동)을 제공하는 모바일 앱이다.

### 핵심 원칙
1. **사주/오행 용어 UI 노출 절대 금지** → '기질', '에너지', '잠재력', '성향'으로만 표현
2. **LLM 호출 최소화** → 정적 DB(QuestionBank, FoodGuideDict) 조회 우선
3. **연령별 동적 경험** → 영아(0~24개월) / 유아(25~72개월) / 초등(73개월+) 분기
4. **실제 동작하는 코드만** → Mock-up/가짜 로딩 금지

---

## 기술 스택

| 영역 | 스택 |
|------|------|
| Frontend | React Native (Expo Managed SDK 52+), TypeScript Strict, expo-router, Zustand, TanStack Query v5 |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | SQLite (Phase 1~4) → PostgreSQL + pgvector (Phase 5) |
| Auth | JWT (access + refresh) → OAuth 2.0 (Phase 6) |
| AI | OpenAI gpt-4o, Whisper STT (Phase 4) — `MOCK_AI=true` fallback 지원 |
| Queue | Bull (Phase 4 비동기 AI 작업) |

---

## 디렉토리 구조

```
amatda/
├── CLAUDE.md              ← 이 파일
├── README.md              ← Phase 체크리스트 포함
├── .env.example
├── shared/types/          ← 프론트-백 공유 타입
├── backend/
│   ├── prisma/            ← schema.prisma, seed.ts
│   └── src/
│       ├── index.ts       ← Express 진입점 (포트 3001)
│       ├── config/        ← env 설정
│       ├── middleware/    ← auth(JWT), security(helmet,cors,rate-limit)
│       ├── routes/        ← auth, child, question, food, observation
│       ├── services/      ← saju.calculator, age.calculator, auth, ai.queue
│       └── utils/         ← masking(이름 마스킹), response(표준 응답)
└── frontend/
    ├── app/               ← expo-router (파일 기반 라우팅)
    ├── components/        ← ui/, home/, onboarding/
    ├── services/          ← api(axios), auth
    ├── stores/            ← zustand (authStore, childStore)
    ├── hooks/
    └── constants/         ← theme(파스텔톤), ageGroups
```

---

## 커맨드 치트시트

```bash
# 백엔드
cd backend
npm install
npx prisma db push          # SQLite 스키마 적용
npx prisma db seed           # Mock 데이터 시딩
npm run dev                  # ts-node-dev로 개발 서버 (포트 3001)

# 프론트엔드
cd frontend
npm install
npx expo start               # Expo Go 개발 서버

# 린트 & 타입 체크
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Git 커밋 컨벤션
git commit -m "[Phase X][Feat] 기능 설명"
git commit -m "[Phase X][Fix] 수정 설명"
git commit -m "[Phase X][Refactor] 리팩토링 설명"
```

---

## 환경 변수 (.env)

```env
# Backend
DATABASE_URL="file:./dev.db"
JWT_SECRET="amatda-jwt-secret-change-in-production"
JWT_REFRESH_SECRET="amatda-refresh-secret-change-in-production"
PORT=3001

# AI (Phase 4)
OPENAI_API_KEY=""
MOCK_AI=true

# Frontend
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

---

## Mock 데이터 요약

### 테스트 계정
- `test@amatda.com` / `test1234`

### 자녀
| 이름 | 성별 | 생년월일 | 기질 | 연령 구간 | 홈 화면 테마 |
|------|------|----------|------|-----------|--------------|
| 승하 | F | 2017-09-25 03:35 | 탐구형(木) | 초등(84개월+) | 학원+학습 성향 |
| 윤도 | M | 2024-08-23 00:00 | 활동형(火) | 영아(0~24개월) | 이유식+교구 구독 |

### 지역 기준점
- 전라남도 무안군 남악 (위도 34.815, 경도 126.463)
- 도농복합 환경 → 학원 수 부족 → LBS Fallback UI 테스트

---

## Phase 진행 현황

- [ ] **Phase 1**: 프로젝트 초기화, Prisma 스키마, Seed, 사주 연산기
- [ ] **Phase 2**: Core API (Auth JWT, Children CRUD, Questions, Food)
- [ ] **Phase 3**: 프론트 Core (로그인, 온보딩, 홈 화면 다자녀 분기)
- [ ] **Phase 4**: AI 연동 (관찰 일기, Whisper, GPT-4o, observedTraits)
- [ ] **Phase 5**: LBS (지도, pgvector, 구독, 기질 날씨)
- [ ] **Phase 6**: Polish (OAuth 소셜, 푸시, CS 챗봇, 다자녀 궁합)

---

## 코딩 규칙 요약

1. **파일 80줄 초과 시 반드시 분리** (UI, Logic, API, Types)
2. **`any` 타입 금지** → `unknown` + type guard
3. **JSON 필드는 String으로 저장** (SQLite 호환) → 서비스 레이어에서 parse/stringify
4. **API 응답 표준 포맷**: `{ success: boolean, data?: T, error?: string }`
5. **아이 이름 마스킹**: AI API 전송 시 `masking.ts`로 이름 제거
6. **에러 자가 복구**: 최대 5회 시도 후 보고 & 다음 태스크

---

## 사주 연산기 핵심 규칙

- `korean-lunar-calendar` 패키지로 양력→음력 변환
- 천간(10개) × 지지(12개)로 년·월·일·시주 도출
- 오행 매핑 후 5대 지표(wood/fire/earth/metal/water) 0~100 정규화
- **연산 결과의 `pillars` 필드는 백엔드 전용** — 프론트에서 절대 표시하지 않음
- 프론트에서는 `fiveElements`, `dominantType`, `label`만 사용

---

## 홈 화면 렌더링 규칙 요약

```
영아(≤24개월): 이유식 + 수면 + 교구 구독 우선 | 학원 숨김
유아(25~72개월): 감각놀이 + 또래 + 학원 | 교구 배너
초등(73개월+): 학습 성향 + 학원 우선 + 두뇌 영양 | 교구 하단

LBS Fallback (반경 5km 학원 < 3개):
  → "추천 장소 부족" 메시지 + 교구 구독 CTA 승격
```

---

## 주의 사항 (Claude Code 필독)

### 절대 하지 말 것
- 사용자에게 "진행할까요?" 질문
- 채팅창에 코드 길게 출력 (진행 보고만)
- `// ... 기존 코드` 같은 축약으로 파일 작성
- UI에 사주, 오행, 천간, 지지 등 한자/무속 용어 노출
- `any` 타입 사용
- AI API 전송 시 아이 실명 포함

### MCP 사용 규칙
- CLI로 대체 가능한 작업은 반드시 CLI 사용
- MCP는 CLI가 없는 서비스(Figma, Notion 등)에만 사용
- 이 프로젝트는 Expo/React Native + Firebase이며, Vercel/Next.js가 아님
- Vercel 관련 스킬(shadcn, Next.js Cache, Vercel Functions 등)은 사용하지 않음

### 빌드 전 필수 체크
- 빌드 전에 반드시 `npx tsc --noEmit`으로 TypeScript 에러 확인
- 빌드 전에 반드시 모든 화면 파일이 _layout.tsx에 등록되어 있는지 확인
- 빌드 전에 반드시 import된 패키지가 설치되어 있는지 확인
- 빌드 전에 반드시 유니코드 이스케이프(\uXXXX)가 없는지 확인
- 빌드 전에 반드시 웹에서 기본 동작 테스트 (expo start --web)
- 빌드 전에 반드시 Firebase 배포 후 API 테스트 (health, login, children)

### 반드시 할 것
- 기능 1개 완료마다 git commit
- 에러 발생 시 5회까지 자가 수정 시도
- Phase 완료마다 README 체크리스트 업데이트
- 파일 80줄 초과 시 모듈 분리
- 모든 API 응답에 타입 인터페이스 정의