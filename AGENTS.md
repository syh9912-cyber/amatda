# AGENTS.md — 아맞다(A-matda) 핵심 규칙

> 이 파일은 Codex가 **매번 읽는 최소 규칙만** 담는다.
> 상세 구현, 배포, 에셋, 보이스, 환경설정은 분리 문서를 참조한다.
>
> 참조 문서:
> - `PROJECT-STATUS.md`
> - `Codex-progress.md`
> - `DEPLOY.md`
> - `ASSET-LIST.md`
> - `VOICE-LIST.md`
> - `LOCAL-CONFIG.md` 또는 `.env`
>
> **중요:** 이 문서에 실제 API 키, 비밀값, 테스트 계정 비밀번호를 직접 적지 않는다.

---

## 프로젝트 한줄 요약
AI 기반 영유아~초등 육아 코칭 앱  
(React Native Expo + Firebase + Gemini 2.5 Flash Lite)

---

## 작업 시작 필수 루틴
- `PROJECT-STATUS.md` + `Codex-progress.md` 먼저 읽기
- 완료된 작업 중복 구현 금지 (반드시 확인 후 시작)
- 수정할 파일 목록 먼저 알려주고 시작
- 추측으로 코드 작성 금지 → 반드시 관련 파일 읽은 후 작업
- 관련 없는 파일까지 넓게 건드리지 말고, 필요한 범위만 최소 수정
- 민감정보(API 키, 토큰, 계정 비밀번호)는 문서/코드에 직접 추가 금지

---

## 문서 분리 원칙
이 파일은 **반복 실행 규칙**만 담는다.

### 이 파일에 남겨둘 것
- 작업 루틴
- 하네스 검증 루프
- 승인 필요 작업
- 코딩 원칙
- 아키텍처 규칙
- 필수 검증 체크리스트

### 이 파일에서 빼둘 것
- 실제 API 키 / 시크릿 / 토큰
- 테스트 계정 비밀번호
- 장문의 배포 가이드
- 길고 자주 바뀌는 URL/운영값
- 에셋/보이스 상세 목록

---

## 🤖 Codex 자동 실행 프로토콜 (Harness Loop)
> 앞으로 코드를 수정하거나 에러를 잡을 때는 무조건 아래 파이프라인을 반복한다.

1. **[분석 및 보고]**
   - 코드 수정 전 `AGENTS.md`의 규칙과 `Codex-progress.md`의 기존 구현 현황을 대조
   - 수정 계획, 수정 파일 목록, 예상 영향 범위를 먼저 간단히 브리핑

2. **[실행]**
   - 코드 작성
   - 추측 금지
   - 기존 패턴/아키텍처 최대한 유지
   - 임시방편 금지

3. **[스스로 사후 검증]**
   - 사용자에게 완료 보고 전에 반드시 직접 아래 명령을 순차 실행
   - 백엔드 타입체크:
     ```bash
     cd backend && npx tsc --noEmit
     ```
   - 프론트 타입체크:
     ```bash
     cd frontend && npx tsc --noEmit
     ```
   - 린트:
     ```bash
     cd frontend && npx expo lint
     ```

4. **[자동 수정]**
   - 위 검증에서 에러가 발생하면, 5회까지는 사람에게 묻지 말고 규칙에 맞게 자동 수정 후 재검증

5. **[완료 기록]**
   - 작업 완료 후 `Codex-progress.md`에 아래를 기록
     - 수정 파일
     - 작업 목적
     - 원인
     - 해결 방식
     - 검증 결과
     - 남은 이슈

---

## 🚨 치명적 작업 격리 (Rule of Two)
다음 작업은 코드를 작성하거나 실행하기 전에 **반드시 사용자의 명시적 승인**을 먼저 받을 것.

- Firestore 컬렉션/문서 스키마 구조 변경
- AI 파이프라인(`coaching.ts`, `prompt.builder.ts`) 순서 변경
- 프롬프트 핵심 로직 변경
- Firebase Storage 권한 및 업로드 보안 규칙(`storage.rules`) 변경
- 인증 흐름의 핵심 구조 변경
- 실제 운영 환경 변수/시크릿 로드 방식 변경

---

## 🚨 절대 규칙 — 코딩 원칙
> 이 앱은 정식 출시 상용 앱이다.  
> 임시방편·우선 돌아가게만 고치는 방식은 절대 금지.  
> 언제나 **공식 문서 기반의 정석 방식**으로 구현한다.

- 임시방편 금지: "일단 돌아가게" 수준의 코드 금지
- 공식 문서 우선: React Native, Expo, Firebase 공식 패턴 확인 후 구현
- 구조적 해결: 증상만 패치하지 말고 근본 원인을 수정
- 에러를 조용히 삼키지 말 것
- 기존 흐름을 우회하는 예외 처리 남발 금지
- 사용자가 실제 겪는 실패 상태를 숨기지 말 것

### 예시
- 인증 → Expo Router Layout 게이트 패턴 사용  
  (API 인터셉터에서 router 직접 호출 금지)
- 상태 저장 → 원자적 저장  
  (`setTokens + setUser` 분리 호출 금지, `setAuth` 단일 호출)
- 에러 처리 → 사용자에게 명확한 에러 + 재시도 제공  
  (조용히 실패 처리 금지)

---

## 핵심 제품 원칙
1. **사주/오행 용어 UI 노출 절대 금지**
   - 반드시 `기질`, `에너지`, `성향`으로만 표현
2. **DB는 참고자료**
   - AI(Gemini)가 최종 개인화 답변 생성
3. **연령별 분기**
   - 영유아(0~72개월)
   - 초등저(73~108개월)
   - 초등고(109~144개월)
4. **실제 동작하는 코드만**
   - Mock-up / 가짜 로딩 금지
5. **안전 우선**
   - 위험 신호는 일반 코칭보다 우선
6. **실명 보호**
   - AI 전송 시 아이 실명 마스킹 필수

---

## 기술 스택
- Frontend: React Native (Expo SDK 54), TypeScript, expo-router, Zustand
- Backend: Express + TypeScript, Firebase Cloud Functions (Node.js 22)
- Database: Firestore
- AI: Google Gemini 2.5 Flash Lite
- 배포: EAS Build + OTA (expo-updates) + Firebase Functions

---

## 아키텍처 레이어 순서 (의존성 방향 준수)
```txt
Types → Config → Repository → Service → AI Layer → API Routes → UI
```

- 역방향 참조 금지
- UI에서 Repository 직접 호출 금지
- Route에서 무거운 비즈니스 로직 직접 구현 금지
- AI Layer는 Service를 우회해 직접 화면 규칙을 알면 안 됨

---

## 응답 생성 파이프라인 순서
```txt
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

### 위험 필터 절대 규칙
- 위험 필터는 RAG보다 먼저 실행
- 위험 응답은 일반 코칭 톤보다 안전 톤 우선
- 필터를 우회하거나 생략하지 말 것
- "애매하면 일반 응답" 금지 → 위험 가능성 있으면 상위 단계 우선 검토

---

## 코딩 규칙
1. `any` 타입 금지 → `unknown` + type guard 사용
2. API 응답 형식 통일:
   ```ts
   { success: boolean, data?: T, error?: string }
   ```
3. AI 전송 시 아이 실명 마스킹 (`masking.ts`)
4. 에러 발생 시 5회 자가 수정 시도
5. 유니코드 이스케이프(`\uXXXX`) 사용 금지
6. 네이티브 모듈 static import 금지 → 동적 import + fallback
7. expo-router: `app/` 폴더만 사용 (`pages/` 금지)
8. Firestore `onSnapshot` 반드시 unsubscribe 처리
9. `FieldValue.serverTimestamp()` 사용 (`new Date()` 금지)
10. 관련 없는 리팩토링 금지
11. 한 번에 큰 구조 변경 금지 → 작은 단위로 수정 후 검증
12. 새 환경변수 필요 시 코드에 하드코딩 금지 → `.env` / 설정 모듈로 연결
13. 시크릿/키/토큰 로그 출력 금지

---

## 상태/데이터 안전 규칙
- 인증 상태 저장은 원자적으로 처리
- Firestore 저장 구조는 승인 없이 바꾸지 말 것
- 기존 필드 의미를 몰래 변경하지 말 것
- nullable/optional 처리 시 실제 저장 데이터와 타입을 맞출 것
- 로컬 상태와 서버 상태가 어긋날 수 있는 부분은 명시적으로 동기화할 것

---

## 검증 기준
코드 작성 후 반드시 자가 점검한다. 실패 시 사람에게 묻기 전에 먼저 수정한다.

### 1단계: 정적 분석
- [ ] 위험 필터가 RAG보다 먼저 실행되는가?
- [ ] UI에 사주/오행/천간/지지 노출이 없는가?
- [ ] 실명 마스킹(`masking.ts`)이 적용되었는가?
- [ ] `any` 타입이 없는가?
- [ ] Mock-up / 가짜 로딩이 없는가?
- [ ] FCM 무료 티어만 사용하는가?
- [ ] `cd backend && npx tsc --noEmit` 통과
- [ ] `cd frontend && npx tsc --noEmit` 통과
- [ ] `cd frontend && npx expo lint` 통과
- [ ] `onSnapshot` unsubscribe 누락이 없는가?

### 2단계: 실제 동작 검증
> 코드 리뷰만으로 못 잡는 문제를 확인하는 단계

- [ ] 수정한 API 엔드포인트 실제 호출 확인
- [ ] 실제 Firestore 저장 데이터 포맷 확인
- [ ] Firebase Functions 로그 에러/경고 확인
- [ ] 새 인덱스 추가 시 Firebase Console 빌드 완료 확인
- [ ] catch 블록이 에러를 숨기지 않는지 확인
- [ ] OTA 관련 설정이 프로젝트 규칙과 맞는지 확인

### 3단계: 완료 기록
- [ ] `Codex-progress.md` 업데이트
- [ ] 완료 보고 전에 위 항목 전체 통과 확인

---

## 오류 발생 시 처리 순서
1. 터미널 로그 전체 읽기
2. 오류 원인 파악
3. 관련 파일만 읽기 (전체 프로젝트 무차별 탐색 금지)
4. 수정
5. 타입체크 / 린트 재실행
6. 필요 시 실제 호출/실데이터 확인
7. 5회 시도 후에도 실패하면 그때 사람에게 보고

---

## 🚫 절대 하지 말 것
- "진행할까요?"처럼 불필요한 승인 질문
- 채팅창에 코드 길게 출력
- `// ... 기존 코드 축약`
- UI에 사주/오행/천간/지지 노출
- 위험 필터 우회 또는 생략
- 유료 SMS/이메일 API 도입
- 추측으로 코드 작성
- `pages/` 폴더 생성
- 보안 규칙(rules) 임의 수정
- 실제 API 키/비밀번호/토큰을 문서에 직접 기록
- 민감정보를 커밋하거나 로그에 출력

---

## 기본 검증 명령
```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
cd frontend && npx expo lint
```

---

## 기본 개발 커맨드
```bash
# 백엔드 개발
cd backend && npm run dev

# 프론트 개발
cd frontend && npx expo start

# APK 빌드
cd frontend && npx eas build -p android --profile preview
```

---

## 배포 원칙
- OTA는 프로젝트 채널 규칙에 맞는 브랜치로만 배포
- 운영 배포 전 preview 채널 검증 우선
- 버전 관리 규칙은 `DEPLOY.md`를 따른다
- 배포 명령, 채널 정책, 런타임 버전 정책은 이 파일이 아니라 `DEPLOY.md`에서 관리한다

---

## 공개 가능 URL / 식별자 (시크릿 아님)
- API: https://api-usglfifguq-uc.a.run.app
- Firebase 프로젝트: amatda-parenting
- EAS 슬러그: @song9912/amatda

> ⚠️ API 키, 계정 비밀번호, 토큰은 `LOCAL-CONFIG.md`에만 기록한다.
> `LOCAL-CONFIG.md`는 `.gitignore`에 등록되어 git에 올라가지 않는다.

---

## 상세 정보 (필요할 때만 읽기)
- `PROJECT-STATUS.md` → 전체 API 목록, 파일 구조, 기능 현황
- `Codex-progress.md` → 현재 진행 상태, 완료/미완료 작업
- `DEPLOY.md` → 빌드/배포/OTA/버전 정책
- `LOCAL-CONFIG.md` → 테스트 계정, API 키, 카카오 키 등 민감정보 (git 제외)
- `ASSET-LIST.md` → 에셋 이미지 목록
- `VOICE-LIST.md` → 보이스 목록
