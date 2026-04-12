# CLAUDE.md — 아맞다(A-matda) 핵심 규칙
> 이 파일은 매번 읽는 최소 규칙만 담는다.
> 상세 정보는 분리 파일 참조: PROJECT-STATUS.md, ASSET-LIST.md, VOICE-LIST.md

---

## 프로젝트 한줄 요약
AI 기반 영유아~초등 육아 코칭 앱 (React Native Expo + Firebase + Gemini 2.5 Flash Lite)

## 작업 시작 필수 루틴
- `PROJECT-STATUS.md` + `claude-progress.md` 먼저 읽기
- 완료된 작업 중복 구현 금지 (반드시 확인 후 시작)
- 수정할 파일 목록 먼저 알려주고 시작
- 추측으로 코드 작성 금지 → 반드시 파일 읽은 후 작업

## 핵심 원칙
1. **사주/오행 용어 UI 노출 절대 금지** → '기질', '에너지', '성향'으로만 표현
2. **DB는 참고자료** → AI(Gemini)가 최종 개인화 답변 생성
3. **연령별 분기** → 영유아(0~72개월) / 초등저(73~108) / 초등고(109~144)
4. **실제 동작하는 코드만** → Mock-up/가짜 로딩 금지

## 기술 스택
- Frontend: React Native (Expo SDK 54), TypeScript, expo-router, Zustand
- Backend: Express + TypeScript, Firebase Cloud Functions (Node.js 22)
- Database: Firestore
- AI: Google Gemini 2.5 Flash Lite (API key in .env)
- 배포: EAS Build (APK) + OTA (expo-updates) + Firebase Functions

## 아키텍처 레이어 순서 (의존성 방향 준수)
```
Types → Config → Repository → Service → AI Layer → API Routes → UI
```
이 방향을 역방향으로 참조하지 말 것.

## 응답 생성 파이프라인 순서
```
사용자 입력
  ↓
[1] 위험 키워드 필터 (4단계) ← 최우선, RAG보다 먼저
  ↓
[2] DB 검색 (RAG)
  ↓
[3] 기질 컨텍스트 주입 ← 모든 응답 도입부에 포함
  ↓
[4] Gemini 2.5 Flash Lite 응답 생성
  ↓
[5] 모닝 팔로업 스케줄링 (FCM 무료 티어만)
```

### 위험 키워드 4단계
| 레벨 | 처리 |
|------|------|
| EMERGENCY | AI 응답 없이 즉시 119 안내 |
| HOSPITAL | 병원 방문 권고 |
| EXPERT | 전문가 상담 권고 |
| GENERAL | 일반 AI 응답 |

## 코딩 규칙
1. `any` 타입 금지 → `unknown` + type guard
2. API 응답: `{ success: boolean, data?: T, error?: string }`
3. AI 전송 시 아이 실명 마스킹 (`masking.ts`)
4. 에러 발생 시 5회 자가 수정 시도
5. 유니코드 이스케이프(\uXXXX) 사용 금지
6. 네이티브 모듈 static import 금지 → 동적 import + fallback
7. expo-router: app/ 폴더만 사용 (pages/ 금지)
8. Firestore onSnapshot 반드시 unsubscribe 처리
9. FieldValue.serverTimestamp() 사용 (new Date() 금지)

## ✅ 작업 완료 체크리스트
코드 작성 후 반드시 자가 점검 (실패 시 사람에게 묻지 말고 스스로 수정):
- [ ] 위험 필터가 RAG보다 먼저 실행되는가?
- [ ] UI에 사주/오행/천간/지지 노출 없음
- [ ] 실명 마스킹 (masking.ts) 적용됨
- [ ] any 타입 없음
- [ ] Mock-up/가짜 로딩 없음
- [ ] FCM 무료 티어만 사용 (유료 SMS/이메일 API 없음)
- [ ] `cd backend && npx tsc --noEmit` 타입 에러 없음
- [ ] `cd frontend && npx expo lint` error 항목 스스로 수정
- [ ] Firestore onSnapshot unsubscribe 처리됨
- [ ] `claude-progress.md` 업데이트
- [ ] "완료했습니다" 말하기 전 위 항목 전부 통과 확인

## 오류 발생 시 처리 순서
1. 터미널 로그 전체 읽기
2. 오류 원인 파악
3. 관련 파일만 읽기 (전체 프로젝트 탐색 금지)
4. 수정 → npx tsc --noEmit 재실행 → 에러 없음 확인
5. 5회 시도 후에도 실패 시 사람에게 보고

## 🚫 절대 하지 말 것
- "진행할까요?" 질문
- 채팅창에 코드 길게 출력
- // ... 기존 코드 축약
- UI에 사주/오행/천간/지지 노출
- Vercel/Next.js 관련 스킬 사용 (이 프로젝트는 Expo+Firebase)
- 위험 필터 우회 또는 생략
- 유료 SMS/이메일 API 도입 (모닝 팔로업은 FCM만)
- 추측으로 코드 작성
- pages/ 폴더 생성 (Expo Router는 app/ 폴더만)
- 보안 규칙(rules) 임의 수정

## 빌드 전 체크
```bash
cd backend && npx tsc --noEmit    # 백엔드 타입체크
cd frontend && npx tsc --noEmit   # 프론트 타입체크
cd frontend && npx expo lint      # lint 체크
npm run build && firebase deploy --only functions  # 백엔드 배포
npx eas update --branch preview  # OTA 업데이트 (반드시 preview!)
```

## 커맨드
```bash
# 백엔드 개발
cd backend && npm run dev
# 프론트 개발
cd frontend && npx expo start
# APK 빌드
cd frontend && npx eas build -p android --profile preview
```

## 배포 주의사항
- **OTA는 반드시 `--branch preview`** (APK가 preview 채널로 빌드됨)
- `--branch production`으로 배포하면 APK에서 업데이트 안 됨!
- 버전 올릴 때: app.json의 `version`만 올리고 `runtimeVersion`은 "1.0.0" 고정 유지
- 회사명: SY Labs

## 계정/URL
- API: https://api-usglfifguq-uc.a.run.app
- Firebase: amatda-parenting
- EAS: @song9912/amatda
- 테스트: test@amatda.com / test1234
- 아이: 윤도(20개월 남아 활동형), 승하(8세 여아 조화형)
- 카카오 JavaScript키: a621098190b12a58275dcb80e39a6c18
- 카카오 REST API키: 0aa17590759470d930a9720d273b8a8f

## 상세 정보 (필요할 때만 읽기)
- PROJECT-STATUS.md → 전체 API 목록, 파일 구조, 기능 현황
- ASSET-LIST.md → 에셋 이미지 108개 목록
- VOICE-LIST.md → 보이스 30개 목록
- claude-progress.md → 현재 진행 상태, 완료/미완료 작업