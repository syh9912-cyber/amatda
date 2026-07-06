# 아맞다(A-matda) 개발 진행 현황
> 최종 업데이트: 2026-07-07 — 유저별 AI API 호출횟수/비용 추적 → 관리자 대시보드 반영

---

## 2026-07-07 — 유저별 AI(Gemini/OpenAI) 호출횟수·비용 추적

### 목적
가입자별 API 호출횟수·요금을 웹에서 확인하고 싶다는 요청. 기존엔 호출 "횟수"만
일부(rateLimits/analysisUsage, 기능별) 세고 있었고 토큰·비용은 전혀 기록 안 됨.
Gemini/OpenAI 호출부가 앱 전체 17곳에 흩어져 있고 userId를 모르는 순수 유틸이라,
사용자 승인 하에 AsyncLocalStorage로 컨텍스트를 전파해 **호출부 2곳(gemini/openai
client)만** 수정하는 방식으로 진행(나머지 17곳 무변경).

### 구현
- `backend/src/utils/requestContext.ts`(신규) — Node 공식 AsyncLocalStorage로
  요청의 userId를 비동기 체인 전체에 전파(Sentry 등도 쓰는 표준 패턴).
- `backend/src/middleware/auth.ts` — `req.userId` 설정 직후 `setContextUserId()`
  **1줄 추가**. JWT 검증 로직 자체는 무변경.
- `backend/src/utils/apiUsage.ts`(신규) — `recordApiUsage()`(fire-and-forget,
  Firestore 쓰기 실패해도 AI 응답 경로 안 막음) + `getUsageSummaryMap()`(전체
  유저 집계를 쿼리 1회로, N+1 방지). 요금표: Gemini 2.5 Flash-Lite $0.10/$0.40
  (input/output, per 1M), GPT-5-nano $0.05/$0.40 — WebSearch로 2026-07 공식
  요금 확인. gemini-3.1-flash-lite(과부하 폴백)는 공식요금 미확인이라 코드 주석
  "비슷한 비용" 기준 2.5-flash-lite와 동일 추정, 미등록 모델은 0으로 기록(무단
  추정 금지).
- `backend/src/services/firestore.ts` — 신규 컬렉션 `apiUsageLogs`(호출 1건=
  문서1개, 원본기록), `apiUsageDaily`(문서ID `{userId}_{YYYY-MM-DD}`, 유저별
  일별 집계 — 대시보드 빠른 조회용).
- `backend/src/services/coaching/gemini.client.ts` / `openai.client.ts` —
  응답의 `usageMetadata`/`usage`를 받은 직후(성공 경로) `recordApiUsage()` 호출.
  프롬프트 빌드·재시도·모델 폴백 순서는 전혀 안 건드림. OpenAI는 기존에 `usage`
  필드 자체를 안 읽고 있어서 `OpenAIResponseShape`에 추가.
- `backend/src/routes/admin.ts` — `getUsageSummaryMap()`으로 유저 목록에
  `apiCallCount`/`apiTotalTokens`/`apiCostUsd` 병합, summary에 전체 합계 추가.
  API 사용량은 가입일 필터(days)와 별개 시간축이라 항상 전체 누적으로 집계.
- `public/admin-users.html` — 테이블에 "API 호출"/"API 비용"(USD + 참고용 원화
  환산) 컬럼, 요약 카드에 전체 호출수/누적비용 추가.

### 검증 결과
- `backend npx tsc --noEmit` 0 errors.
- 배포 후 **실제 엔드투엔드 검증**: 테스트 계정으로 실제 코칭 질문 1건 전송(POST
  /api/coaching/ask) → 관리자 API에서 해당 계정 `apiCallCount:2`(ask.handler가
  내부적으로 Gemini 2회 호출하는 구조와 일치), `apiTotalTokens:4536`,
  `apiCostUsd:0.0006687`로 정확히 반영 확인. AsyncLocalStorage가 중첩 비동기
  호출(route→handler→client) 전체에 걸쳐 정상 전파됨을 실증.
- Firestore 스키마 신규 추가(사용자 승인 완료), firestore.rules 무변경(Admin SDK
  경로 그대로).

### 남은 이슈
- 폴백 모델(gemini-3.1-flash-lite) 요금은 추정치 — 공식 요금표 공개되면 갱신 필요.
- KRW 환산은 고정 환율(1400원/$, 하드코딩) 참고치일 뿐 실제 청구와 다를 수 있음.

---

## 2026-07-07 — 관리자 대시보드(가입자 목록 + 구독상태) 신설

### 목적
가입자별 무료/체험/유료 상태를 웹에서 바로 확인하고 싶다는 요청. 기존엔 조회용
스크립트(`recent-signups.cjs`)만 있었음. 기존 `requireAdmin`(Firebase custom claim)은
claim 부여 코드가 전무해 사실상 미사용 상태라 재사용 불가 — 사용자 승인 하에
**단일 관리자 키** 방식의 완전히 별도 게이트를 신설(기존 JWT 인증 흐름 무변경).

### 구현
- `backend/src/config/env.ts` — `ADMIN_DASHBOARD_KEY` 추가(E() 헬퍼, 미설정 시
  기동은 안 막고 라우트 호출 시 503 fail-closed).
- `backend/src/middleware/adminDashboardAuth.ts`(신규) — `x-admin-key` 헤더를
  `crypto.timingSafeEqual`로 비교하는 단일 게이트. 기존 authMiddleware/requireAdmin과
  무관.
- `backend/src/routes/admin.ts`(신규) — `GET /api/admin/users?days=&limit=`.
  `subscription.ts`의 프리미엄 판정 로직(trialStartedAt+7일/premiumExpiresAt)을
  읽기 전용으로 재사용해 FREE/TRIAL/PAID 산출, 요약 카운트 포함. Firestore
  `orderBy(createdAt desc)` + 선택적 `where(createdAt >= cutoff)`.
- `backend/src/index.ts` — `/api/admin` 마운트, `REGISTERED_SECRETS`에
  `ADMIN_DASHBOARD_KEY` 추가(Cloud Functions Secret Manager 주입).
- `public/admin-users.html`(신규) — 정적 단일 페이지(빌드 불필요). 비밀번호
  게이트(세션스토리지) → 기간(7/30/90/전체) + 이메일·닉네임 검색 → 테이블(가입일시·
  방식·이메일·닉네임·상태뱃지·최근접속·uid) + 요약 카드. Firebase Hosting으로 배포,
  `firebase.json` rewrite는 추가 안 함(직접 파일명 접근만, 기존 checkout.html 패턴).
- 관리자 키: `node crypto`로 생성 → `backend/.env.local`(로컬, gitignore) +
  `firebase functions:secrets:set`(프로덕션 Secret Manager) 양쪽에 반영, 평문은
  코드/문서 어디에도 기록하지 않음(사용자에게 1회 채팅으로만 전달).
- 부가: `backend/scripts/recent-signups.cjs`(신규) — CLI 조회용 스크립트(같은
  목적, 웹 대시보드와 별개로 유지).

### 검증 결과
- `backend npx tsc --noEmit` 0 errors.
- 배포 후 실제 호출 확인: 관리자 키 정상 응답(실데이터), 키 없이 호출 시 401,
  `admin-users.html` 200 정상 서빙.
- Firestore 스키마 변경 없음(기존 필드만 읽음), firestore.rules 무변경(백엔드가
  Admin SDK로 접근하는 기존 아키텍처 그대로).

### 남은 이슈
- 검색은 클라이언트 사이드(가져온 배치 내에서만) — 유저 수가 많아지면 서버사이드
  검색/페이지네이션 필요.
- URL은 비공개 유지(관리자 키만으로 보호) — 필요 시 IP 제한 등 추가 가능.

---

## 2026-07-07 — [P0] OTA 후 흰화면/크래시 진짜 원인: expo-localization static import

### 목적/원인
"OTA 후 흰화면/강제종료" 장애를 여러 세션에 걸쳐 reloadAsync 문제로 오진하고
스플래시·부팅게이트를 반복 수정했으나 재발. **실기기 adb logcat로 진짜 원인 확정**:
`Cannot find native module 'ExpoLocalization'` → ExpoRoot의 ErrorBoundary undefined
→ 부팅 크래시(흰화면). expo-localization(네이티브 모듈)을 static import 했는데
설치된 스토어 빌드(vc13, rt2.9.1) 네이티브엔 없음. OTA는 네이티브를 못 넣으므로
로드 시점 크래시. expo-router가 시작 시 모든 라우트를 require → route 파일 import도 크래시.

### 해결 방식
- 수정 파일: `i18n/index.ts`, `app/(main)/fever.tsx`, `app/voice.tsx` (커밋 df1eb3e)
- static import 제거, 런타임 `require('expo-localization')`를 try/catch로 감싸 없으면
  ko/undefined 폴백 (CLAUDE.md 규칙 6). i18n에 getDeviceRegionCode 안전 헬퍼 신설.
- 장애 대응 순서: 크래시 루프 중 `eas update:roll-back-to-embedded`(양 runtime)로 중단
  → fix 발행(rt2.9.2 9c70ce42 / rt2.9.1 1b5799c4)이 롤백을 덮어씀.

### 검증 결과 (실기기 Galaxy S24, rt2.9.1)
- adb logcat: fix 전후 `ExpoLocalization`/`FATAL` 0건.
- OTA 전환 관찰: CheckCompleteAvailable→Download→DownloadComplete→isRestarting→
  재실행 시 `CheckCompleteUnavailable`(이미 최신 fix 번들, 롤백 벗어남) = 정상 적용 확정.
- frontend tsc 0 / expo lint 0 errors.

### 남은 이슈 / 후속
- 스토어 라이브가 vc13(2.9.1) 옛 빌드라 대부분 사용자 rt2.9.1. fix OTA 받으면 구빌드가
  forced-reload 1회(홈으로 나갔다 옴) 후 fix 번들 안착.
- expo-localization 네이티브 없는 빌드에선 언어 자동감지 비활성(ko 폴백). 진짜 감지는
  새 네이티브 빌드 필요 — production 빌드 vc14(0d471dbb) 시작해둠(모든 fix+네이티브 포함).
- 교훈은 memory `ota-native-module-crash`에 기록.

---

## 2026-07-06 — 스플래시 fail-safe 버그 수정 (성공 시에만 완료 + 재시도)

### 목적/원인
강제 reload 제거 배포 후에도 "그 번들로 갈아타는 마지막 1회 reload" 전환에서 흰 화면
재발. 원인: 앞서 넣은 splash fail-safe의 버그 — `navigate()`가 이동 **시도 전에**
`hasNavigated=true`로 박아, OTA reload 직후 navigation tree 미마운트 상태에서
`router.replace`가 throw하면 재시도 없이 **영구 정지**. 또 단발 `setTimeout(4000)`
이라 그 1회 실패 시 복구 불가.

### 해결 방식
- 수정 파일: `frontend/app/splash.tsx`
- `navigate()`: `router.replace` **성공했을 때만** `hasNavigated=true`. 실패(라우터
  미준비)면 false 유지 → 재시도 대상.
- fail-safe를 단발 타이머 → **재시도 인터벌**로 교체: 정상 애니메이션(~2.5s)이 끝났어야
  할 3.5s 이후부터 0.6s 간격으로 `navigate()` 재시도 → 라우터 준비되는 즉시 성공·정지.
  최대 15s 상한(무한 방지). 정상 부팅 땐 애니메이션 콜백이 3.5s 이전에 성공 → 인터벌 no-op
  (스플래시 애니메이션 정상 노출, 조기 이탈 없음).

### 검증 결과
- `frontend tsc` 0 / `expo lint` 0 errors (splash 신규 경고 없음).

### 사용자 즉시 조치
- 현재 흰 화면에 갇혀 있으면 앱 **완전 종료(force-close) 후 재실행** → 콜드 스타트로
  강제 reload 없는 번들 진입 → 이후 재발 없음.

---

## 2026-07-06 — OTA 강제 reload 제거 → 다음 실행 시 자동 적용

### 목적/원인
OTA 적용 직후 안드로이드 네이티브 크래시(OS 다이얼로그, 일회성·자가복구) 보고.
Sentry에 JS 에러 없음 → 네이티브 크래시로 확인. `_layout.tsx`의 `useOTAUpdate`가
세션 도중 `Updates.reloadAsync()`를 강제 호출하는 커스텀 레이어가 원인 —
안드로이드/Hermes/newArch 조합에서 reloadAsync 자체가 간헐 네이티브 크래시를 냄.
이 강제 reload가 앞선 스플래시 흰 화면 갇힘의 진원지이기도 함. 사용자 결정: 강제
reload 제거하고 expo-updates 기본 동작(다음 실행 시 적용)에 맡김.

### 해결 방식
- 수정 파일: `frontend/app/_layout.tsx`
- `useOTAUpdate` 재작성: `checkForUpdateAsync` + `fetchUpdateAsync`(백그라운드
  다운로드)만 수행, `reloadAsync()` 호출 제거. 받아둔 업데이트는 app.json
  (checkAutomatically ON_LOAD + fallbackToCacheTimeout 0) 설정대로 다음 콜드
  스타트 때 자동 적용.
- 강제 reload UX 잔재 제거: `UpdateScreen` 컴포넌트·`upS` 스타일·`UpdateStatus`
  타입·`getStatusText`·진행률/스킵 상태 전부 삭제. `AuthGate`에서 UpdateScreen
  분기 제거(이제 폰트/hydrate 로딩만 게이트). 미사용 import(Animated/Easing/
  Dimensions/Image/TouchableOpacity/useTranslation/TFunction/MASCOT_HAPPY) 정리.
- 트레이드오프: OTA가 "즉시"가 아니라 "다음 앱 실행"에 반영. 대신 세션 도중 네이티브
  reload가 사라져 크래시·흰화면 위험 원천 제거.
- 전환 주의: 이 새 번들로 넘어가는 마지막 1회는 구버전의 강제 reload를 거침(불가피).
  그 1회는 배포된 splash fail-safe가 흰화면을 막고, 이후부터 강제 reload 없음.

### 검증 결과
- `frontend tsc` 0 / `expo lint` 0 errors (신규 경고 없음).

### 남은 이슈
- 미사용 i18n 키 `rootLayout.update.*` 3로케일에 잔존(무해) — 다음 정리 때 제거 가능.

---

## 2026-07-06 — [P0] OTA reload 후 스플래시 흰 화면에 갇히는 문제

### 목적/원인
OTA 업데이트 적용(reloadAsync) 직후 앱이 순백 화면에서 멈추고, 수동 재시작해야
정상 실행되는 회귀. `app/splash.tsx`가 화면 전환을 **오직 애니메이션 완료 콜백**
(`Animated.sequence(...).start(() => navigate())`)에만 의존한 것이 근본 원인.
reloadAsync 직후엔 네이티브 애니메이션 모듈 재초기화 타이밍상 이 완료 콜백이
유실될 수 있어 `navigate()`가 호출되지 않음 → 스플래시 배경(#F2F2F7, 거의 흰색)만
남고 텍스트는 opacity 0 → 흰 화면. 콜드 재시작은 teardown이 없어 정상(=재시작하면 됨).

### 해결 방식
- 수정 파일: `frontend/app/splash.tsx`
- `hasNavigated` ref로 `navigate()`를 idempotent 처리 (애니메이션 콜백 + fail-safe
  타이머 중복 이동 방지).
- 마운트 effect에 fail-safe `setTimeout(navigate, 4000)` 추가 — 애니메이션 콜백이
  유실돼도 최대 4초 후 반드시 이동(전체 애니메이션 ~2.5s라 정상 시엔 콜백이 먼저 →
  타이머는 no-op). unmount 시 clearTimeout.
- 이 fix가 담긴 OTA를 적용하는 reload의 착지 지점(새 splash)이 이미 보호되므로,
  업데이트 전달 그 자체도 안전.

### 검증 결과
- `frontend tsc` 0 / `expo lint` 0 errors (splash 신규 경고 없음).

### 남은 이슈
- 없음. (필요 시 useOTAUpdate의 foreground 재체크 중복도 추후 점검 가능하나 이번 증상과 무관)

---

## 2026-07-06 — 프로모 코드 기능 (팔로워 N개월 무료 이용권)

### 목적/원인
인플루언서 마케팅: 인플루언서에게 1년 무료(기존 grant-premium.cjs 수동 지급),
그 팔로워에게는 "코드 입력 시 3개월 무료"를 자동 지급하기 위한 redeem 기능.
기존 앱엔 7일 체험만 있고 프로모/쿠폰 redeem 기능이 없어 신규 구현.
Firestore 신규 컬렉션 2개 = Rule of Two 대상 → **사용자 명시 승인 후** 진행.

### 해결 방식 (수정 파일)
- `backend/src/services/firestore.ts` — 컬렉션 2개 추가: `promoCodes`(코드 정의),
  `promoRedemptions`(유저당 코드 1회 중복방지 기록)
- `backend/src/routes/subscription.ts` — `POST /premium/redeem-code` 신설.
  `db.runTransaction`으로 원자적 처리: 코드 존재·active·만료·한도(maxRedemptions)·
  유저당 중복(promoRedemptions/{userId}_{CODE}) 검증 → 통과 시 redeemedCount++ +
  사용기록 set + 유저 프리미엄 연장. 기존 만료일 남아있으면 그 뒤로 이어붙임
  (subscription.ts가 읽는 기존 필드 subscriptionTier/premiumStartedAt/premiumExpiresAt
  재사용 — 부여 로직 grant-premium.cjs와 동일 규칙).
- `backend/scripts/create-promo-code.cjs` — 코드 발급/비활성/조회 스크립트(신규).
- `frontend/services/api.ts` — `premiumApi.redeemCode(code)`.
- `frontend/app/(main)/subscription.tsx` — 체험 버튼 아래 "프로모 코드 입력" UI
  (TextInput+버튼) + handleRedeemCode. 서버 에러는 한국어 고정이라 ko UI에서만
  원문 노출, 그 외 로케일은 일반 실패 메시지(chatbot.tsx 기존 패턴 준용).
- `frontend/i18n/locales/{ko,ja,zh-Hant}.json` — `subscription.promo` 6키 추가.

### 검증 결과
- `backend tsc` 0 / `frontend tsc` 0 / `expo lint` 0 errors(기존 96 warnings 유지,
  수정 파일 신규 경고 0) / 스크립트 `node --check` OK.
- i18n 3로케일 leaf 5188 동일, KEY parity 0, 신규 한글잔존/깨짐 0.

### 남은 이슈 / 배포 필요
- **백엔드 배포 필요**: 엔드포인트는 `firebase deploy --only functions` 후 활성.
  프론트 UI는 OTA 가능.
- Firestore 신규 컬렉션은 첫 쓰기 시 자동 생성(마이그레이션 불필요). 앱은 백엔드
  admin SDK로만 접근 → firestore.rules 변경 불필요.
- 코드 발급: `node scripts/create-promo-code.cjs <CODE> <months> <maxRedemptions> [label]`.

---

## 2026-07-05 — 비한국어 응급번호 숨김 + i18n 정밀 감사(불변식 검증)

### 목적/원인
2.9.2 출시 전 언어 회귀 재점검 중, 기존 검증(tsc/lint/키 개수)이 못 잡는 런타임
파손 지점을 잡기 위해 **불변식 기반 감사**(플레이스홀더 parity·한글잔존·U+FFFD·간체혼입·
빈값) 신규 도입. 감사 결과 fever(발열) 화면이 유일하게 게이팅 없이 ja/zh에 노출되며
고열 시 지역 응급번호(일본/대만 119, 홍콩 999)를 그대로 표시함을 발견.
제품 원칙(긴급 안내는 한국 의료체계 의존 → SOS·예방접종·진통탭은 ko 전용 Redirect)과
불일치. 사용자 결정: 비한국어에서 응급번호 숫자는 숨기고 "즉시 응급전화" 일반 문구만 노출.

### 해결 방식
- 수정 파일: `frontend/i18n/locales/ja.json`, `frontend/i18n/locales/zh-Hant.json`
  (코드/로직 무변경 — JSON 값 문자열만 치환. ko.json은 119 유지, 무변경)
- 비한국어에 **실제 노출되는** 키만 선별 수정:
  - fever 8키(emergencyCallShort/Full·level.danger/emergency.advice·emergency.label·
    actionGuide.emergency.headline·alert.callFailedMessage/DeviceMessage) + fever.medicine.disclaimer(ja)
  - guides.chatbot.page4.note, guides.laborMonitor.page3.desc/warn
  - ja는 "119"를 "救急"으로, zh는 "{{tel}}"/"119"를 "緊急電話"로 치환
- 게이팅으로 비한국어 미노출인 곳은 그대로 둠: sos.*(Redirect), laborMonitor 진통탭
  본문(kick 탭 강제라 미노출), onboardingKakaoChannel.*(Redirect)
- 원탭 전화 버튼(`getEmergencyTel` 다이얼)은 유지 — 숫자는 화면에서 숨기되, 탭 시 OS
  다이얼러에 정확한 지역번호가 뜨도록. 코드가 넘기는 `{ tel }`은 문자열에 `{{tel}}`이
  없어 무해하게 무시됨.

### 검증 결과
- i18n 불변식 감사: PLACEHOLDER fever {{tel}} 10건 → 0건(남은 2건 nutrition.title
  {{particle}}은 한국어 조사용·의도적), HANGUL/BROKEN/ESCAPE 0, 키 parity 0,
  SIMPLIFIED 4건은 감사 스크립트 오탐(번체 `繁`을 간체목록에 오등록·실제 간체 0),
  EMPTY 1건 kickHintSuffix는 중국어 어순상 의도.
- 비한국어 노출 키 전부 숫자/tel 제거 확인, ko 119 유지 확인.
- `frontend npx tsc --noEmit` 0 / `backend npx tsc --noEmit` 0 / `expo lint` 0 errors.

### 남은 이슈
- 감사 스크립트 SIMPLIFIED 휴리스틱 오탐(`繁` 오등록) — 스크래치패드 스크립트라 영향 없음.

---

## 2026-07-05 — 출산가방 공유 웹페이지 + 가족초대 랜딩 ja/zh-Hant 다국어화

### 목적/원인
앱 밖에서 열리는 두 웹 서피스가 한국어 고정: (1) 백엔드 렌더 출산가방 공유 HTML
(`GET /api/birthbag-share/:token`), (2) Firebase Hosting 정적 `public/invite.html`.
일본/대만·홍콩 사용자가 공유한 링크를 받은 가족도 한국어 페이지를 보게 됨.

### 해결 방식
- 수정 파일: `backend/src/routes/birthbag-share.ts`, `frontend/app/(main)/birth-bag.tsx`,
  `frontend/app/(main)/coparenting.tsx`, `frontend/services/api.ts`, `public/invite.html`
- 출산가방: POST 바디에 `lang`('ko'|'ja'|'zh-Hant', 그 외 ko 폴백) 수용 →
  `share_birthbag/{token}` 문서에 `lang` 필드 저장 → GET HTML 렌더러가 저장된 lang으로
  `STRINGS`(34키 × 3언어) 조회 렌더. `<html lang>` 속성도 반영. 만료/404 HTML도 다국어.
  앱명 표기: ko 아맞다 / ja なるほど育児 / zh-Hant 育兒答. 사용자 입력 항목 라벨은 번역 X.
- 프론트: `generateShareLink` payload에 `lang: i18n.language` 추가(+ api.ts 타입 확장),
  coparenting 초대 URL에 `&lang=${i18n.language}` 부가.
- invite.html: 인라인 STRINGS(ja/zh-Hant × 8키)로 `lang` 쿼리 파라미터에 따라 텍스트 교체,
  `document.documentElement.lang` 설정. ko는 마크업 기본값 그대로(무변경). 딥링크/스토어
  감지 로직 무변경, 외부 요청 없음.
- JSON-only 에러 메시지(rate-limit, `/data`, item POST)는 한국어 유지 — 앱이 소비하는
  API 응답이라 사용자 노출 HTML 아님.

### 검증 결과
- `backend npx tsc --noEmit` 0 / `frontend npx tsc --noEmit` 0 / `npx expo lint` 0 errors
  (터치한 파일 신규 경고 0 — birth-bag `router`, coparenting `BackButton` 미사용 경고는 기존)
- 스크립트 검증: ko HTML 출력 기존 렌더러와 byte-identical(3개 샘플 + notFound),
  ja/zh-Hant 렌더 시 크롬 문자열 한글 잔존 0(인라인 JS 주석 제외), invite.html 태그 균형 OK,
  lang 파라미터 없음/미지원 언어 시 한국어 기본 유지, 딥링크 href 정상.

## 2026-07-05 — 발달 체크리스트(growth-stats 마일스톤) ja/zh-Hant 다국어화

### 목적/원인
`app/(main)/growth-stats.tsx`의 발달 체크리스트가 일본어/중국어 사용자에게 한국어로 노출.
`getDefaultMilestones()` 80개 항목(label/domain/description) 하드코딩 + API의 한국어
label/domain/nextMilestone 원문 렌더 + DOMAIN_STYLE 한국어 키 매핑이 원인.
추가로 d6-2 라벨에 U+FFFD 깨진 문자('자기 이름을 ��요') 존재.

### 해결 방식
- 수정 파일: `frontend/app/(main)/growth-stats.tsx`,
  `frontend/i18n/locales/{ko,ja,zh-Hant}.json`
- 로케일 JSON에 최상위 `milestonesChecklist` 블록 신설 — `domains` 7키(grossMotor/
  fineMotor/language/cognitive/social/emotional/selfCare) + `items` 80키(d0-1~d7-10,
  각 label/description). ko 값은 기존 한국어 문자열과 동일(깨진 d6-2는 '자기 이름을 써요'로 복원).
- `getDefaultMilestones(months, t)`로 재작성 — 코드에는 id+도메인(한국어 canonical)
  카탈로그(`MILESTONE_CATALOG`)만 두고 표시 텍스트는 `t()`로 조회.
- 백엔드 한국어 데이터는 표시 시점 번역(albumMilestoneI18n 패턴):
  `i18n.getFixedT('ko')` 기반 한국어 label→id 역참조 맵(`koLabelToId`)으로
  API 항목/`nextMilestone` 번역, 모르는 라벨은 원문 유지(nextMilestone은 ko에서만 원문 표시).
- `getDomainTag()`가 `MILESTONE_DOMAIN_KEY`로 도메인 표시명 번역, DOMAIN_STYLE은
  한국어 키 유지(백엔드 원문 기준). 영역별 요약 집계 키는 도메인 원문으로 유지.

### 검증 결과
- `frontend npx tsc --noEmit` 0 errors, `npx expo lint` growth-stats 신규 경고 0
- 3개 로케일 leaf 수 동일(5060) + deep key parity 정확히 일치, items 80/80/80
- growth-stats.tsx 내 U+FFFD 잔존 없음

## 2026-07-02 — 일본/대만·홍콩 출시 대비 전체 화면 다국어화(i18n)

### 목적
`ja`(일본어)/`zh-Hant`(대만·홍콩용 번체 중국어) 지원 확대를 위해 프론트엔드 전체
(`app/`, `components/`, `features/`, `services/`, `stores/`, `utils/`, `constants/`)에서
하드코딩된 한국어 문자열을 `react-i18next` `t()` 호출로 전환. 페이지 단위로 순차 진행,
누락분은 발견 즉시 후속 태스크로 마무리.

### 수정 범위 (요약)
- **화면(app/)**: main/onboarding/auth 전체 스크린 약 60개+ 완료 (album, growth-stats, fever,
  pregnancy, mom-group, birth-bag, labor-monitor, sos, voice/voice-settings, gdm, privacy/terms,
  subscription, coparenting, mom-wellness, lullaby, child-edit, vaccination, trait-detail,
  onboarding 10종, momstagram/-post, ai-analysis, chatbot, poop-analyzer, edit-profile,
  recommendations 3종, mom-location-setup, profile, splash/support, notification-settings,
  timer, diary, alarm-settings, register/login, nutrition, clinic, monthly-characteristic,
  play-learning, home.tsx, baby-tracker.tsx)
- **components/** 전체(common/ads/coaching/profile/ui/trait/home/pregnancy/album/
  baby-tracker/diary/momstagram/onboarding/payment/vaccination/report) — 62개 파일
- **features/guide/*** 20개 도움말 캐러셀 콘텐츠 전체 (화면별 "?" 버튼 안내 팝업)
- **constants/**: `onboardingQuestions.ts`(온보딩 기질설문 60문항 전체), `dailyQuestions.ts`
  (일기 "오늘의 질문" 콘텐츠) — 둘 다 처음엔 "대용량 참고자료"로 오분류돼 건너뛸 뻔했으나
  실제로는 모든 신규 사용자가 보는 핵심 인터랙티브 콘텐츠임을 확인 후 번역
- **services/**: `pushNotifications.ts`(OS 푸시알림 제목/본문, 임신주차 알림 포함),
  `otaCheck.ts`, `checkup.ts`, `social-auth.ts`, `deliveryHospital.ts`(SOS 분만병원 연락),
  `payment.ts`(결제수단/상품명), `api.ts`/`imageUpload.ts`(에러 메시지 — 실제 표시 여부 개별 확인)
- **utils/**: `imagePicker.ts`, `traitReportHtml.ts`(기질 리포트 PDF 공유)
- **stores/**: `momstagramStore.ts`(익명/나 기본 표시명)
- **hooks/**: `useLoginHandlers.ts`(소셜/이메일 로그인 실패 메시지)

### 핵심 원칙 (Rule of Two 미해당 — 문자열 교체만, 로직 변경 없음)
- 결제(`payment.ts`)/SOS 통화(`deliveryHospital.ts`)/인증(`social-auth.ts`) 파일은
  표시 문자열만 `t()`로 교체, 결제 처리·통화 우선순위·인증 흐름 로직은 전혀 건드리지 않음.
- Firestore 저장/매칭용 리터럴(`PostCategory`, `dominantType` 키, 배지 라벨 등)은 원문 유지 —
  표시되는 라벨만 번역, 저장/조회 키는 그대로.
- 죽은 코드(미사용 export)로 확인된 항목은 번역하지 않고 그대로 둠
  (예: `voice-settings.tsx`의 `BIXBY_GUIDE`/`GOOGLE_GUIDE`, `ageFeatures.ts`의
  `ELEMENT_BOOST_ACTIVITIES`, `baby-tracker.tsx`의 `FEEDING_OPTIONS`/`SleepSessionCard`).
- 사주/오행 등 역술 용어는 어디에도 노출하지 않음(기질/에너지/성향 표현만 사용) — 전 구간 확인.
- zh 번역은 번체(대만·홍콩)만 사용 — 서브에이전트가 간체를 섞어 쓰는 실수가 반복돼
  매 배치마다 문자 단위 재검증 절차를 프롬프트에 명시.

### 검증
- `cd frontend && npx tsc --noEmit` / `npx expo lint` 매 배치마다 통과 확인, 최종 전체 통과.
- `cd backend && npx tsc --noEmit` 통과(백엔드는 이번 작업 대상 아님, 회귀 없음 확인).
- `i18n/locales/{ko,ja,zh-Hant}.json` 3개 파일 키 개수 매 배치마다 일치 확인(최종 4259개 동일).
- 각 배치마다 정규식 스윕 2종(따옴표 문자열 + JSX 텍스트)으로 잔여 한국어 확인 —
  남은 건 전부 주석/죽은 코드/Firestore 리터럴/대용량 참고자료뿐임을 개별 확인.

### 남은 이슈 (후속 확인 필요, 별도 세션 스폰됨)
1. **`app/voice.tsx` 음성 기록 기능**: 음성인식이 한국어 문법 매칭 기반이라 일본/대만·홍콩
   출시 시 이 기능을 그대로 노출할지, 로케일 게이트를 걸지 제품 결정 필요.
   (`'왼쪽'`/`'오른쪽'` 등 일부 값이 `baby-tracker.tsx`에서 원문 그대로 노출됨)
2. **`components/report/EditorialCover.tsx`, `poop-analyzer.tsx`**: `\uXXXX` 유니코드 이스케이프
   사용(CLAUDE.md 규칙 5 위반, 이번 세션 이전부터 있던 기존 코드) — 리터럴 한글로 교체 필요.
3. **`features/coaching/CategoryBar.tsx`** 등 일부 파일에서 확인된 대용량 상수(`foodRecommendations.ts`,
   `monthlyCharacteristics.ts`, `playActivities.ts`, `learningActivities.ts`, `cryAnalysisData.ts`,
   `poopAnalysisData.ts`)는 기존 원칙대로 번역 대상에서 제외(AI 참고자료 성격) — 필요 시 재검토.

---

## 2026-06-23 — 신규 기능: 예측 알람 + 6개월 설문 게이트

### Q1 — 기질 설문 6개월 게이트 (OTA)
- 6개월 미만은 행동 설문 답하기 어려움 → `questions.tsx`에서 `months < 6`이면 설문 스킵,
  `analyze([])`(생년월일 기반 기질)로 분석결과 직행. 6개월+엔 다시분석으로 정밀화. 커밋 `0702c78`.

### Q2 — 예측 알람 (수유/수면/기상, 최근 3일 패턴, 서버 푸시)
- **동작:** 데이터 입력 시 다음날부터 자동, 데이터 없으면 미발송. 슬롯시각 30분 전 Expo Push.
- **백엔드** (커밋 backend): `services/predictiveAlarm.ts`(3일 기록→클러스터링→대표 슬롯,
  수유 다회는 비슷한 시간끼리 묶음), `utils/predictiveAlarmSweep.ts`(15분 cron, 창 매칭+일별 중복방지,
  pushSchedules doc에 predictiveSent로 dedup), `child.ts` GET/PUT `/:id/alarm-settings`,
  `index.ts` predictiveAlarmSweep onSchedule(15분) 등록. child에 `predictiveAlarm` 필드 추가.
- **프론트** (OTA): `alarm-settings.tsx` 화면(전체 on/off + 알림시점 분 + 슬롯별 개별 on/off,
  변경 즉시 저장) + 아기시간 액션행 `⏰알람설정` 버튼. Modal-in-ScrollView 회피 위해 별도 화면.
- 배포: 백엔드 deploy + OTA rt2.9.1(`c54e7562`)/rt2.9.2(`b4f4cfec`).
- ⚠️ 향후 최적화: cron이 매 15분 전체 pushSchedules 순회(자녀당 child+3일 read) — 사용자 늘면
  enabled 인덱스/배치 최적화 필요. 현재 소규모라 무방.

### 보류
- 자장가 백그라운드 재생 = UIBackgroundModes(네이티브) 필요 → 다음 빌드에. (OTA 불가)

---

## 2026-06-23 — iOS 홈 터치 먹통 재발 수정 (P0, OTA)

### 증상
- 사용자: iPhone 설치 후 "홈 화면에서 아무것도 안 눌러짐" (저번 SOS 증상과 동일).

### 원인
- 2026-06-03에 고친 **RN iOS Modal-in-ScrollView 버그**의 재발.
- `home.tsx` 601줄 `<HospitalRegisterPrompt>`(내부 `<Modal>` 2개)가 **ScrollView 안**에
  남아 있었음 — 당시 다른 모달 5개는 밖으로 뺐으나 이것만 누락(또는 이후 추가).
- 임신부 모드(30주+/고위험 24주+, 병원 미등록)에서 이 팝업을 닫으면 홈 하위 콘텐츠
  탭이 죽음(스크롤·SOS FAB만 됨).

### 수정
- `frontend/app/(main)/home.tsx` — `<HospitalRegisterPrompt>`를 `</ScrollView>` 밖
  (모달 영역, OnboardingGuide 옆)으로 이동. 순수 JSX 이동, 로직 동일. 커밋 `af0d004`.

### 배포 (OTA, 네이티브 재빌드 불필요)
- ⚠️ app.json이 2.9.2로 올라가 있어, **runtime 2.9.1·2.9.2 둘 다** publish:
  - rt 2.9.1 (현재 라이브 빌드33) → Update `b2948e43`
  - rt 2.9.2 (빌드35/추후) → Update `817d831e`
- app.json은 2.9.2로 원복(커밋 상태 유지).
- 교훈: 앞으로 ScrollView 안에 Modal 추가 금지(주석 규칙 home.tsx 747~749). [[ota-needs-eas-env]]

### 후속 — 진짜 원인은 "모달 2개 동시 노출" (일반모드·자녀없음·첫 로그인)
- 사용자 추가 제보: 임신부 아니고 자녀 없는 일반모드인데 **첫 로그인만 하면** 먹통.
- 원인: 첫 실행 가이드 `OnboardingGuide`(=`GuideCarousel`, `<Modal>`)와 방금 다시 켠
  **테스터 공지 팝업(`AnnouncementPopup`=Modal)이 동시에 노출** → iOS는 Modal 2개
  동시에 뜨면 터치 응답이 죽음. (둘 다 ScrollView 밖이지만 "동시 노출"이 별개 문제)
- 수정: `home.tsx` `checkAnnouncement`에 가드 — 가이드 완료(`amatda_onboarding_guide_shown`
  ==='1') 전엔 공지 안 띄움. 커밋 `eabd03d`.
- 배포: OTA rt2.9.1(`4824df8d`) + rt2.9.2(`a011fa21`).

---

## 2026-06-22 — 가입 후 카카오 채널 추가 화면 복구 (release/v2.9.0, OTA)

### 증상
- 신규 회원가입 시 카카오 채널 추가 동의/화면이 안 뜨고, 채널 추가 후 와야 할
  카카오톡 환영 메시지도 안 옴 (네이버 로그인으로 테스트, 로그인 자체는 정상).

### 원인
- `6/3 출시 준비 단순화 커밋(86900ce)`에서 `consent.tsx`가 가입 완료 후
  `notification-permission?next=home`으로 보내도록 바뀌어 **kakao-channel 화면을
  완전히 스킵**. (주석엔 →kakao-channel로 남아있었으나 코드만 드리프트)

### 수정
- `frontend/app/onboarding/consent.tsx` — 신규 가입(이메일/소셜)은 `next=kakao-channel`,
  재동의(reauth)는 `next=home` 유지.
- `frontend/app/onboarding/kakao-channel.tsx` — 완료 후 제거된 `set-nickname` 대신
  `/(main)/home`으로. 복구 흐름: 동의 → 알림 priming → 카톡 채널 추가 → 홈.
- 커밋 `2c7faef`.

### 배포
- JS 라우팅 변경이라 **OTA로 배포** (재심사 불필요). `eas update --branch production`
  → Update group `957603c0`, runtime 2.9.1, iOS+Android.

### 남은 이슈 (코드 아님 — 카카오 콘솔)
- 채널 추가 후 **자동 환영 메시지**는 카카오 채널 관리자센터의 자동응답/웰컴(또는 챗봇)
  설정이 켜져 있어야 발송됨. 사용자 콘솔 확인 필요.
- 우리 방식은 가입 직후 별도 채널 추가 화면(웹 URL)이며, "카카오 싱크 로그인 안
  동의항목" 방식과는 다름.

### 후속 — 광고 유닛ID 누락 회귀 복구 (같은 날, OTA)
- 위 카카오 OTA 직후 iOS에서 "광고 유닛아이디 미설정" 노출.
- **원인:** `eas update`(OTA)는 `eas.json` 빌드 프로필 `env`를 읽지 않음. 광고 유닛
  ID(`EXPO_PUBLIC_ADMOB_BANNER_IOS` 등 4개)가 eas.json에만 있고 **EAS 서버 환경엔
  없어서** OTA 번들에서 빠짐. (빌드 번들엔 있었으나 OTA가 덮어씀)
- **수정:** EAS `production` 환경에 광고 유닛 ID 4개 추가(plaintext, 공개 ID):
  `EXPO_PUBLIC_ADMOB_BANNER_IOS/ANDROID`, `EXPO_PUBLIC_ADMOB_MEDIUM_IOS/ANDROID`.
  이후 OTA 재배포 → Update group `cda0ab3c`. (빌드는 기존대로 eas.json env가 동일값
  override → 충돌 없음)
- **교훈:** 앞으로 EXPO_PUBLIC_* 신규 추가 시 OTA도 쓰면 eas.json뿐 아니라 EAS
  환경에도 같이 넣어야 함.
- iOS 광고가 여전히 빈 영역이면(미설정 아님) → AdMob 콘솔 게재 대기(no-fill) 이슈로
  별도 확인.

### 후속2 — 채널 화면이 "기존 회원"에겐 안 뜨던 문제 (같은 날, OTA)
- 진단표식(ota6) 결과 `next=home` 확인 → 가입이 **신규가 아니라 재동의(reauth) 경로**로
  진입. 즉 백엔드가 isNewUser=false(기존 회원)로 판정 → (main) 게이트가
  `consent?reauth=1` 강제 → next=home → 채널 스킵.
- 원인: 탈퇴 후 재가입했지만 그 소셜 계정이 실제로 안 지워짐(또는 동일 이메일 잔존
  계정 매칭). 진짜 신규 가입(isNewUser=true) 경로는 코드상 정상(채널 노출 확인).
- **사용자 결정:** 재동의 흐름에도 채널 노출. → `consent.tsx` 모든 경로
  `next=kakao-channel`로 통일(isReauth 분기 제거). 진단표식 제거.
- 커밋 `a68fb64`, OTA Update group `3886e9db`.
- 미해결 가능성: 탈퇴가 실제 삭제를 안 하는 케이스(백엔드 cascadeDelete는 코드상
  정상). 필요 시 탈퇴 시 에러/로그 추적 별도 진행.

---

## 2026-06-16 — Apple 5차 거절 대응 (Submission 083a5ae0) (release/v2.9.0)

### 2.1(b) 결제 503 — 근본 원인은 코드 버그였음
- `backend/src/index.ts`의 `REGISTERED_SECRETS`에 Apple 시크릿이 **누락**돼 있어
  Secret Manager에 키가 있어도 함수 process.env에 미주입 → `isAppleIAPAvailable()`
  항상 false → 영수증 검증 503. → 4개(APPLE_ISSUER_ID/KEY_ID/PRIVATE_KEY/BUNDLE_ID)
  등록 추가. 커밋 `e9f4c2a`.
- 사용자에게 노출되던 raw "AxiosError 503" → 친화 메시지로(`payment.ts`). `ad335b9`.
- **운영 조치(사용자 완료)**: Secret Manager에 Apple 시크릿 4개 생성 + 백엔드 배포
  (`npm run deploy`, 스크립트를 `npx firebase-tools`로 수정 `ac375a9`) + Paid Apps
  Agreement. **샌드박스 결제 통과 확인 완료** → 503 해결.

### 1.4.1 의료정보 출처 — 상담이모(AI 챗)에 출처 추가
- 면책 고지 하단에 질병관리청·대한소아청소년과학회 링크 상시 노출. 나머지 14개
  의료 화면은 이미 MedicalCitation 적용됨. 커밋 `8ba5c03`.

### 1.2 UGC — 무관용 EULA 명시
- 가입 약관 동의 화면(로그인 전)에 커뮤니티 무관용 원칙 + 신고·차단 제공 명시.
  커밋 `02431a5`. (기존 신고/차단/실명화/욕설필터와 함께)

### 빌드/제출
- **빌드30**(2.9.1, build 30) EAS production 빌드 → **TestFlight 업로드 완료**.
- **1.2 화면 녹화(30.mp4) 검증 완료** — ①로그인 전 EULA+무관용 ②🚩신고 ③🚫차단
  3요건 모두 포함 확인(`바탕화면/아맞다수정/아이폰심사/30.mp4`).
- 회신문 초안: `APPLE-REPLY-2026-06-15.md` (영문 3건 대응).
- **남은 사용자 작업**: App Store Connect에서 빌드30 선택 + 영상 첨부 + 회신 전송 → 제출.

### 수익모델 분석 결론 (배너 광고만으론 본전~약간 적자)
- AI 한도: 상담 무료 10회/일, 분석 무료 3회/월. 광고: AdMob 배너 전용.
- 보수적 추정: AI비용(상담 ₩1.3/회) vs 배너수익(eCPM ₩800) → 가중평균 1인당 월 ≈ −₩6.
  헤비 무료유저가 구조적 적자(AI비용↑·광고노출↓ 비례 안 함).

### 📌 승인 후 작업 — 보상형(rewarded) 광고로 무료 상담 수익화
- 아이디어: 무료 상담 시 **보상형 영상광고**(긴 광고)로 비용 충당. 수익이 AI 사용량에
  비례해 구조적 적자 해소(보상형 eCPM ₩5,000~15,000 = 상담 4~8회분 커버).
- UX: 하루 2~3회 무광고 → 이후 "광고 보고 +1회"(opt-in). 매 상담 강제 금지.
- **반드시 심사 승인 후** 별도 빌드로 (지금 심사 중 광고 surface 추가는 리스크).
- 구현 메모: ① `react-native-google-mobile-ads` RewardedAd ② AdMob 보상형 광고단위
  생성+연결 ③ 광고 시청 완료 → 백엔드 보상 검증 후 상담 quota +1(위변조 방지)
  ④ `FREE_DAILY_LIMIT` 로직 조정(기본 2~3회 + 보상형 추가).
- 대안 레버: 무료 상담 한도 10→3회/일(`FREE_DAILY_LIMIT`), 입력 토큰 축소(RAG 4→2,
  contextDays 7→3, AI 파이프라인 변경=Rule of Two), 유료 전환 1~2%면 흑자.

---

## 2026-06-15 — 화면 감사 Tier 2 (나머지 High) 수정 (release/v2.9.0)

AUDIT-2026-06-14.md의 High 36건 중 사용자 영향 있는 항목을 배치별 tsc/lint+커밋으로 처리.

### 커밋
- `f6f1736` 온보딩: analysis-report 무한 재요청 루프(fetchAttempted ref)+에러/재시도,
  questions/intake-form 빈 catch→captureError+재시도, result dominantType 방어 매핑,
  kakao-channel openURL race→AppState 복귀 후 진행. (consent 다크패턴은 검토상 준수→무변경)
- `469c511` 영양·성장: 조사 을/를(받침 판정), 이름 폴백, 가짜 추천도% 제거,
  백분위 문구 구간별 교정, 성장분석 가짜 진행률 제거.
- `2c68a51` 타이머: 진행링 SVG 실동작, 완료 알림 stale closure.
- `5e87443` 공동육아: 가족 카운트-목록 일치, 초대 SMS phoneDigits 캡처.
- `4888342` 홈(임산부 접종달력 9개 허용)·산모진단(questions.length)·접종(임계값 통일)·
  프로필(별명 검증 통일+역할 즉시 저장).
- `3645e3c` 커뮤니티: 맘스톡 공감 likedIds 토글+활성스타일, 가족피드 가짜 푸터로딩.
- `a4c9606` 임신(빈상태/로드실패)·임당(카드 게이팅/미래시각)·진통(진행중 포함/kick 정규화).
- `76ef6bc` 구독(무료체험 버튼 파생판정)·AI분석(가짜 2초 제거)·자장가(울음감지 기본트랙).
- `4923178` 음성기록: Siri 텍스트 경로 무한 듣기 + 에러 시 재시도 숨김.

### 보류(별도 결정/검증 필요)
- baby-tracker 67/68/69: 도달 불가 데드코드(기본 분유량 모달·handlePatternAnalysis+3초
  가짜로딩·분석 피커). 사용자 영향 없음 → 제거 vs 진입점 연결은 제품 결정 필요.
- lullaby 77: 녹음 중 화면 이탈 시 녹음 유실. unmount 비동기 저장 필요 → 오디오
  라이프사이클 리스크로 디바이스 검증 후 작업 권장.
- momstagram 64: 무한스크롤 소스/표시 리스트 불일치 → 스토어 구조 변경 = Rule of Two 승인 필요.
- Medium 58 / Low 65 + 공통패턴(includeFontPadding 등)은 미착수.

### OTA
- Tier 1+2 커밋 미배포 — 배포는 일괄 예정(사용자 확인 후).

---

## 2026-06-15 — 화면 감사 1순위(Tier 1) 수정 완료 (release/v2.9.0)

전체 화면 감사 보고서(`AUDIT-2026-06-14.md`, High 36/Medium 58/Low 65) 중
**최우선(무한 스피너·사주오행·안전 직결)** 을 배치별 tsc/lint 검증 + 배치별 커밋으로 처리.

### 무한 스피너 4건 — 커밋 `0200fce`
- `monthly-characteristic` / `diary` / `intake-form` / `recommendation-detail`:
  selectedChild 미선택 시 early-return으로 로딩이 영구 true로 남던 회귀.
  early-return·useEffect else 분기에서 setLoading(false)+빈 데이터 처리. (coparenting과 동일 패턴)

### 사주/오행 노출 3건 — 검사 결과 오탐, 변경 없음
- `result.tsx`/`momstagram-post.tsx`: dominantType은 enum(`탐구형` 등) 한글값,
  `EditorialCover`/result 차트는 fiveElements 키를 성향 라벨(탐구/활동/안정/결단/지혜)로 매핑.
  → 실제 UI에 오행/천간/지지 노출 없음.

### 안전 직결 — 커밋 `5297b93`, `80f2b09`
- `fever`: 해열제 재복용 간격을 약 종류별(아세트아미노펜 4h·이부프로펜 6h)로 계산.
  기존 240분 하드코딩은 이부프로펜을 4h만에 "복용 가능"으로 오안내. (`5297b93`)
- `fever`: 회복추세 비교 대상을 history[1](직전 기록)로 교정. 기존 `Date.now()-1` 필터는
  현재 측정값을 자기 자신과 비교 → '열 내리는 중' 카드가 영구 미표시. (`5297b93`)
- `sos`: 증상검사 시작 시 setResult(null)+빈 응답 명시 처리. data 없을 때 직전 '응급'
  카드 잔류하던 버그 수정. (`5297b93`)
- `poop`/`cry` 위험도 강등: 서버 likelihood가 enum과 불일치 시 `?? '보통'`으로 떨어져
  '높음' 빨강 경고색이 사라지던 의료화면 안전버그 → `resolveLikelihoodConfig`('높' 우선
  포함 매칭) 도입. analyzeMedia poop mock의 장감염/염증 보통→높음도 교정. (`5297b93`, `80f2b09`)

### 남은 항목
- Tier 2(나머지 High ~30): voice·timer·growth-stats·nutrition·pregnancy·labor-monitor·
  edit-profile 등 로직/UX. Tier 3(Medium/Low) 다수. Low/코스메틱은 사용자 합의로 후순위.
- OTA 배포: Tier 1 커밋 미배포(배포는 배치 종료 후 일괄 예정).

---

## 2026-06-14 — iOS 4차 거절(1.4.1 / 1.2 / 2.1a) 대응 — 처리 완료

### 코드 수정 (release/v2.9.0)
- **1.2 (UGC 익명)** — 맘스톡 '익명으로 쓰기'(글·댓글) 기능 **완전 제거** → 항상 실명(닉네임). 익명 보기 탭 제거. 18+ 등급 회피. + **욕설/금칙어 1차 필터**(`BANNED_WORDS`, `containsBannedWord`) 게시·댓글 등록 시 차단. (기존 차단/신고/약관 유지)
  - 파일: `frontend/app/(main)/mom-group.tsx` — writeAnonymous/commentAnonymous state·토글·탭·reset 제거, createPost/createComment anonymous=false 고정, BANNED_WORDS 필터 추가. 커밋 `bbe20db`.
- **맘스톡 색상 버그** — 내동네에서 전국 폴백 글(isFallback)까지 강조배경이 깔리던 문제 → `isHighlight = isPinTop || p.isOfficial`로 변경(공지·고정 글만 강조). 커밋 `3d5c2dd`.
- 검증: 프론트 tsc 통과, expo lint 신규 이슈 0.

### Firestore 데이터 수정 (service-account.json + firebase-admin, 즉시 라이브·빌드 무관)
- **2.1a 콘텐츠 시드** — 맘스톡 월방 **2024-08**에 실명 글 8개 + 댓글 8개 시드(다양한 카테고리, 욕설 없음). 데모 계정 월방이 2024-08이라 매칭.
- **공지 상단고정** — 공식 공지 2개(`isOfficial=true`)가 `isPinned=false`라 최신글에 밀림 → `isPinned=true`로 변경(전 방 상단 고정).
- **전국 필터** — 글에 `babyBirthYear`가 0/26개라 '전국(나이별)' 필터가 전부 걸러냄 → 월방 groupKey(YYYY-MM)에서 출생연도 추출해 20개 글 **babyBirthYear 백필**. 전국(2023~2025) 쿼리 13개 노출 확인.
- **테스트 글 2개** — groupKey 2025-01 / babyBirthYear 2025 / 무안 남악 좌표(lat~34.81, lng~126.46) — 동네·전국·월방 매칭 테스트용.

### 빌드/배포
- **iOS 빌드 29** (v2.9.1, 런타임 2.9.1) EAS 빌드 완료 + `--auto-submit`로 App Store Connect 업로드. 익명/욕설 수정 포함. 사용자가 빌드29로 심사 제출.
- **OTA(production, 2.9.1)** — 색상 수정 발행(빌드29 런타임 일치 → 빌드29가 수신). 커밋 3d5c2dd.

### ⚠️ 사용자 ASC 액션(빌드로 안 고쳐지는 메타데이터 — 미확인)
- **1.4.1** App Store '설명(description)'에 의료 면책 문구 추가 (한/영 문구 전달함).
- **2.1a** App Review Information에 데모 계정 `syh9912@naver.com`(+비번, 네이버 2FA 해제) 기입 + 회신문("맘스톡 월방>2024년 8월에 글 많음, 내동네는 위치기반") 답장.

### 참고 — 비(非)앱 산출물 (바탕화면, git 외부)
- `바탕화면/아맞다 수연/` : 인스타 홍보 카드뉴스 5세트(맘스톡·가족육아·열나·AI분석·기질분석) — AI 실사 표지 + 실제 앱 화면 사용법.
- `바탕화면/지원사업/` : 2026 혁신 소상공인 AI 활용지원 사업 — SY Labs(사장님ON+아맞다) 사업계획서·서식2 양식형·발표 슬라이드·체크리스트(docx/pdf).
- `Downloads/상표출원_신청서_에스와이랩스(작성본).hwp` : 전남TP 소상공인 IP(상표)출원 지원 신청서 — 아맞다 상표출원, HWP COM 자동 작성.

---

## 2026-06-13 — 가족피드(momstagram) 작성폼 미초기화 수정

- 증상: 가족피드에 게시물 올린 뒤 '+'로 새 글을 열면 직전 글/사진/카테고리가 그대로 남아있음.
- 원인: 피드의 '+'(FAB·헤더)가 `router.push('/(main)/momstagram-post')`로 파라미터 없이 진입하는데, 작성 화면이 게시 후 `router.back()`만 하고 폼 상태(content/imageUri/category/isPrivate)를 비우지 않음. 화면 인스턴스가 재사용되며 이전 state가 유지됨(카테고리 '여행'이 남은 게 근거 — params로는 전달 안 되는 값).
- 수정: `resetForm()` 헬퍼 추가, 공개·나만보기 게시 성공 직후 호출해 폼 초기화. prefill 진입(마운트 시 1회 적용)은 영향 없음.
- 검증: 프론트 `tsc --noEmit` 통과, `expo lint` momstagram-post.tsx 신규 이슈 0.
- 파일: `frontend/app/(main)/momstagram-post.tsx`

---

## 2026-06-13 — 공동육아(coparenting) 무한 로딩 스피너 수정

- 증상: 초대 링크로 연결 후 "연결되었습니다" 팝업은 뜨는데 화면이 가운데 스피너만 계속 돌고 전환 안 됨. 뒤로가기는 정상.
- 원인: `coparenting.tsx`의 `loadMembers`가 `if (!selectedChild) return;`로 early-return하면서 `setLoading(false)`를 호출하지 않음. 등록된 아이가 없는 피초대자는 `selectedChild`가 null이라 `loading=true`가 영구 유지됨(다른 모든 경로는 `finally`에서 해제됨).
- 수정: (1) early-return 시 `setMembers([]) + setLoading(false)` 처리. (2) `!selectedChild`일 때 무한 로딩 대신 "먼저 아이를 등록해주세요" 안내 화면 + 초대 코드 입력 버튼 노출. emptyState 스타일 추가.
- 검증: 프론트 `tsc --noEmit` 통과, `expo lint` 신규 에러/경고 0(coparenting.tsx 기준).
- 파일: `frontend/app/(main)/coparenting.tsx`

---

## 2026-06-12 — iOS 3차 거절 (빌드 27, 2.3.2 + 2.1b + 1.2) 대응

지난 G4·1.4.1은 통과. 새 3개:

### 1.2 (UGC): 맘스톡에 사용자 차단 기능 없음 → 추가 완료
- 원인: mom-group(맘스톡)은 신고만 있고 차단 없음(momstagram엔 있었음). 리뷰어 스샷 근거.
- 백엔드(mom-group.ts): getBlockedUserIds 헬퍼 + /posts·/posts/radius 피드 차단 필터 + POST/DELETE /users/:uid/block, GET /users/blocked 라우트. 차단 시 postId 함께 받으면 자동 신고 접수(개발자 통지) — Apple "notify developer" 충족. userBlocks 컬렉션은 momstagram과 공유.
- 프론트: momGroupApi.blockUser/unblockUser/getBlockedUsers. mom-group.tsx 게시글 상세에 "🚫 차단" 버튼 + handleBlockUser(즉시 setPosts 필터로 피드에서 제거 + 상세 닫기) — "remove instantly" 충족.
- 배포: 백엔드 functions:api 배포 완료(--project amatda-parenting), OTA(production) 완료, 빌드28 진행 중. tsc(백·프) 통과, lint 0.

### 2.3.2 (홍보이미지 중복): 월간/연간 동일 이미지 → 삭제 완료
- ASC 구독(아맞다 VIP) 월간·연간 프로모션 이미지가 동일(VIP_구독이미지)이라 거절.
- 조치: 크롬으로 두 구독의 거절된 프로모션 이미지 모두 삭제(Apple 권고대로 — 프로모션 안 하면 삭제 가능). 완료.

### 2.1(b) IAP 결제 실패 ("requestPurchase failed / Unable to Complete Request")
- 확인(비즈니스 페이지): 유료 앱 계약=활성, 은행=활성, 미국 세금양식=활성. **대한민국 세금 양식=대기 중(2026.6.5 제출)**.
- 구독 상태 "개발자 조치 필요"는 프로모션 이미지 거절 때문 → 이미지 삭제로 해소 예상.
- 핵심: 구독 안내문 "구독을 앱 버전과 함께 제출(버전 페이지 '앱 내 구입 및 구독' 섹션에서 선택)" → 구독이 제출에 미연결이라 샌드박스 결제 불가 가능성. 재제출(빌드28) 시 구독 함께 선택 필요.

### 남은 작업
- 빌드28 완료 → eas submit → 버전 페이지에서 빌드28 선택 + **구독 2개 선택(앱 내 구입 및 구독)** + 재제출.
- 1.2: 실기기 화면녹화(EULA 동의 → 신고 → 차단) 촬영해 심사 메모(Review Notes)에 첨부 — Apple 요구.
- 2.1b: 대한민국 세금 양식 '대기 중' 처리 확인(IAP 차단 요인 가능).

---

## 2026-06-10 — iOS 2차 거절 (빌드 25, G4 + 1.4.1) 대응

리뷰 기기: iPhone 17 Pro Max + iPad Pro 11" (M4). 2개 항목 잔존.

### G4 (Design): "additional menu 확장 시 아래로 스크롤 불가"
- **원인 확정**: baby-tracker.tsx 기록추가 시트(AddRecordModal) — sheet `maxHeight: '85%'` 인데 내부 ScrollView 가 `scrollBody: { flexGrow: 0 }` 만 있고 **flexShrink 없음** → 내용이 길면 ScrollView가 내용 높이 그대로 유지된 채 시트 밖으로 잘림. ScrollView 자신은 overflow가 없다고 판단해 **스크롤 미동작** + ScrollView 밖(시트 하단)의 "기록 저장" 버튼도 화면 밖으로 밀림. iPad 호환모드(세로공간 작음)에서 쉽게 재현.
- **수정**: `scrollBody: { flexGrow: 0, flexShrink: 1 }` — 내용 길면 ScrollView가 줄어들어 스크롤 생기고 저장 버튼 항상 고정 노출.
- **추가 방어**: components/ui/CenterModal.tsx — card에 `maxHeight: '85%'` + children을 ScrollView(alignSelf stretch, flexShrink 1, contentContainerStyle alignItems center)로 래핑. 사용처 3곳(공지팝업·home 모달2) 모두 세로공간 부족 시 스크롤.

### 1.4.1 (의료 출처): 빌드25에 어제 OTA분(7화면)이 미내장이 원인
- 빌드25는 출처 7화면 OTA(0b05228b) **이전에** 빌드됨 → 리뷰어 첫 실행 = 내장번들(출처 없음). 빌드26에 전부 내장으로 해결.
- **추가 출처 3화면**(재거절 방어): pregnancy.tsx(아이사랑·산부인과학회), monthly-characteristic.tsx(KDCA·소아과학회 + 발달차이 면책), recommendation-detail.tsx(KDCA·식약처 + AI생성 참고용 면책). → 출처 표기 총 14화면.

### G4 진짜 원인 — 리뷰어 첨부 스크린샷으로 확정 (로그인 화면)
- 리뷰어 캡처 = iPad 로그인 화면 하단 잘림 (Google 버튼 반쯤 잘리고 카카오/네이버/회원가입 접근 불가).
- **원인**: app/(auth)/login.tsx:33 — 스타일명만 `scroll`인 **일반 View** (ScrollView 아님) → 세로공간 부족 기기에서 스크롤 자체 불가.
- **수정**: ScrollView 전환 (contentContainerStyle flexGrow:1 — footer marginTop:'auto' 유지, keyboardShouldPersistTaps). register.tsx 는 이미 ScrollView 라 무관.
- baby-tracker 시트 flexShrink + CenterModal maxHeight 수정도 유효한 G4 방어로 유지.

### 배포
- OTA(production): group 7b561e21 (시트/출처) + group b916af05 (로그인 ScrollView) — 기존 빌드 24/25 사용자에게도 적용.
- 빌드 26은 로그인 수정 미포함이라 **취소**(b4cf8e81). 모든 수정 포함 **빌드 27** 재빌드 → ASC 제출 → 빌드 교체 + 리뷰어 회신 + 재심사 (진행 중).
- 검증: tsc 통과, lint 에러 0.

## 2026-06-09 — iOS App Review 거절 대응 (Submission 083a5ae0, build 1.0(24))

Apple이 iPad Air(M3)에서 심사, 6개 가이드라인 위반으로 거절. 원인 분석 후 수정.

### 거절 사유 → 원인 → 조치
- **2.1(a) 버그** (아이 디지털카드·기질분석 빈 화면 / 맞춤추천 무한로딩)
  - 근본원인: 심사 계정에 `selectedChild`가 없음(자녀 미등록). 자녀 없으면 프로필 메뉴가 PARENTING 항목으로 기본 표시 → 전부 실패.
    - child-card.tsx / trait-detail.tsx: `if (!child) return null` → 새하얀 화면
    - recommendation-list.tsx: useEffect early-return으로 `loading=true` 고정 → 무한 스피너
  - 조치: 세 화면 모두 "아이를 먼저 등록해주세요 + 홈으로 가기" 안내 화면으로 교체. recommendation-list는 no-child 시 `setLoading(false)`.
  - 추가: child-card 공유 실패 문구 "APK 설치 후 이용해주세요" → 중립 문구.
- **2.3.10 Android/Google Play 언급(바이너리)**
  - subscription.tsx 2곳(구독중 alert·약관고지) → Platform 분기로 iOS는 App Store 문구만.
  - cry-analyzer.tsx "APK/Expo Go" alert → 중립 문구. voice-settings Siri 설명의 "안드로이드는…" → iOS에서 숨김. (안드로이드 단축 섹션은 이미 Platform.OS==='android' 게이트)
- **5.3.2 콘테스트/추첨 + 2.2 베타**
  - 원인: Firestore `announcements` 활성 공지 "🎁 출시기념 테스터 100명 모집 + 우수리뷰어 신세계상품권 5만원".
  - 조치: 해당 공지 active=false 비활성화(완료). kakao-channel "베타 기능 사전 체험" → "새 기능 소식 우선 안내".
- **1.4.1 의료정보 출처 누락**
  - 신규 `components/common/MedicalCitation.tsx` 작성(출처+링크+면책).
  - 배치: growth-stats(성장통계=KDCA/WHO, 주수별발달=아이사랑/산부인과학회), gdm(당뇨병학회/식약처), mom-wellness(EPDS/국가정신건강포털), pregnancy-journey-detail(시기별 가이드=아이사랑/산부인과학회).
- **4 Design (iPad 복잡)**: iPhone 전용 유지(supportsTablet=false) 결정. 버그 수정 + 리뷰어 회신으로 대응.

### 검증
- frontend `tsc --noEmit` 통과, `expo lint` 에러 0(경고 100 기존).

### 재제출 완료 (2026-06-10)
- iOS 빌드 25(2.9.1) EAS 빌드 + eas submit → ASC 업로드 완료. 빌드 25 첨부 후 재제출.
- 상태: "🟡 1.0 심사 대기 중". 리뷰어 회신(6개 항목 영어) 게시 완료.
- 데모 계정 syh9912@naver.com: 아이+기질분석 완료 확인. 테스트 안내(메모) "반드시 데모 계정 사용/Apple 로그인=빈 계정" 버전으로 교체.
- App Store 설명·키워드·프로모션: Android 언급 없음 확인(메타데이터 clean).
- 추첨 공지 비활성화 유지.

### 재심사 중 주의
- Gemini 결제 잔액 유지(소진 시 AI 실패→2.1a 재거절). 추첨 공지 재활성화 금지. 데모 계정 데이터 유지.

### 2026-06-10 추가 — 전체 점검 후 심사대응 패키지 1 (OTA group 0b05228b)
4개 영역 병렬 감사(심사 컴플라이언스/의료출처/결제·정책/시스템) 후 1차 패키지 적용:
- **의료출처(1.4.1) 7개 화면 추가**: fever(소아과학회·KDCA), sos(소방청119·KDCA·적십자), vaccination(예방접종도우미 nip.kdca.go.kr·소아과학회), poop-analyzer, cry-analyzer(소아과학회·KDCA), labor-monitor(산부인과학회·아이사랑), nutrition(식약처·복지부) — MedicalCitation 컴포넌트 재사용.
- **lullaby.tsx**: 음원 미확보(source:null) 트랙 7개(드라이기/반짝반짝/오르골/모차르트K448/비발디봄/바흐아리아/파헬벨캐논) 목록에서 filter 제외 — "준비 중" 미완성 인상(2.1a/2.2) 제거. `*_ALL` 배열 + filter 분리(타입 보존). 음원 추가 시 source 채우면 자동 재노출.
- **kakao-channel.tsx**: "출시 기념 쿠폰" → "육아 꿀팁 콘텐츠" (5.3.2 보수 대응).
- **voice.tsx**: 로컬 저장 실패 시 "기록 완료!" 위장 제거 → setError+phase('error') 재시도 화면.
- 검증: tsc 통과, lint 에러 0. OTA(production, iOS+Android) 배포 완료.

### 감사에서 발견된 잔여 이슈 (통과 후 1주 내 권장)
- P0: tracker.ts voice-parse/photo-parse Gemini 불가 시 fallback 없음(즉시 에러) — Google Cloud 예산 알림 설정 필수.
- P1: storage.ts putDay/putSessions fire-and-forget(재설치 시 미동기 기록 유실 가능) — 재시도 큐 권장.
- P1: 백엔드 new Date() 광범위(serverTimestamp 규칙 위반) — 단계적 전환.
- P2: payment.ts:114 `as any` 1곳, voice-parse sanitizeForPrompt 인젝션 방어 한정적.
- 오탐 정정: app.json buildNumber/versionCode 불일치는 appVersionSource:remote라 무시됨(비문제).
- 사장님 확인 필요: 데모 계정으로 놀이학습·추천 4종 열어 빈 화면("준비 중") 없는지.

---

## 2026-06-08 — 편집 모달 키보드 fix + 맘스톡 공식계정 전환 + iOS 구독 제출 준비

### A. 분유/기록 편집 모달 키보드 가림 fix (프로덕션 OTA 완료)
- 증상(iOS): `baby-tracker.tsx` 타임라인 편집 모달에서 양(ml) number-pad가 저장 버튼을 가리고, 카드 탭/바깥 탭으로 닫을 수 없어 저장 불가
- 원인: 해당 모달만 `KeyboardAvoidingView` 미적용 + 내부 카드 onPress 없음(키보드 dismiss 불가) + number-pad엔 완료키 없음
- 수정: 같은 화면 다른 모달과 동일 패턴 적용 — `KeyboardAvoidingView(behavior=ios?'padding')`로 감싸 저장 버튼 노출 + 카드 탭 시 `Keyboard.dismiss()`. `Keyboard` import 추가
- 검증: `frontend tsc` ✅ EXIT=0, `expo lint` ✅ EXIT=0 / OTA: `--branch production` runtime 2.9.1 (group 2c93f24b)

### B. 맘스톡 공식 계정 전환 (서버 데이터, 앱 업데이트 불필요)
- 기존 공식 계정 = `test@amatda.com`(uid AIJX…, LOCAL) — 사용자 개인계정(syh9912@naver.com)으론 남의 글이라 삭제 버튼 미표시였음
- 변경: `users/zE6jtDczy3sY0yPLX2Ey`(syh9912@naver.com, 네이버, 닉네임 와이돈츄).isOfficial=true / `test@amatda.com`.isOfficial=false
- 공식 시드글 10개(`_seedKey`) `userId` → syh9912 uid로 이전 (nickname "아맞다 공식"·isOfficial=true 유지 → 표시 불변, 삭제권한만 이전). 삭제권한은 `momGroupPosts.userId === req.userId` 기준
- 임시 스크립트 사용 후 삭제, dry→apply 검증 완료

### C. iOS 인앱 구독 (App Store Connect)
- 구독 2종(premium_yearly ₩39,900 / premium_monthly ₩3,900) 현지화·가격·심사스크린샷(1242×2688)·1024 프로모 이미지·심사메모 채워 "제출 준비 완료"
- 앱 버전 1.0 "앱 내 구입 또는 구독" 섹션에 두 구독 연결 완료
- 남은 항목(사용자): 스크린샷 0/10, 빌드 연결, 데모 로그인 계정(아이 프로필 있는 별도 계정), 연락처, 개인정보 설문

### D. 공동육아 초대 SMS 공유 버그 fix (iOS)
- 증상(iOS): 문자 공유 시 받는사람=앱주소, 본문=빈칸
- 원인: `coparenting.tsx:218` `sms:${phone}${encodeURIComponent('?body='+message)}` — `?body=` 구분자까지 인코딩(`%3Fbody%3D`)되어 iOS가 뒤 URL 전체를 수신자로 인식. + iOS는 본문 구분자가 `&`인데 `?` 사용
- 수정: `const sep = Platform.OS==='ios'?'&':'?'; sms:${phone}${sep}body=${encodeURIComponent(message)}` (메시지만 인코딩) + `canOpenURL` 체크 후 실패 시 `Share.share` 폴백. `Platform` import 추가
- 검증: `tsc` ✅ EXIT=0 / `lint` ✅ 0 errors

### E. iOS 전체 점검 — 키보드 가림 모달 4곳 추가 fix (탐색 에이전트 2개 병렬)
- iOS 숫자키보드(완료키 없음)가 저장 버튼을 가리는 동일 유형 버그를 전수 점검 → 고위험 4곳 `KeyboardAvoidingView` + (ScrollView는)`keyboardShouldPersistTaps="handled"` 적용:
  - `coparenting.tsx` 가족 초대 모달(phone-pad)
  - `components/home/NextCheckupModal.tsx` 검진일정(number-pad)
  - `components/pregnancy/HospitalRegisterModal.tsx` 병원등록(phone-pad, 풀스크린+ScrollView)
  - `gdm.tsx` 혈당 기록 모달(decimal-pad)
- 검증: `tsc` ✅ EXIT=0 / `lint` ✅ 0 errors
- 참고: Apple 로그인(SocialLoginButtons)·Share API·mailto 인코딩(support/DataRetention)은 점검 결과 이상 없음

### F. 🟡 항목 추가 수정 (저위험 iOS 정리)
- `nutrition.tsx` 유튜브 `Linking.openURL` → `.catch(Alert)` 폴백 추가 (Alert import)
- `poop-analyzer.tsx` 카메라 권한 거부 시 조용히 return → 안내 Alert 추가
- `voice-settings.tsx` 뒤로가기 버튼 절대배치 `top:44` → `Math.max(insets.top+4, 44)` (다이내믹아일랜드 대응, `useSafeAreaInsets`). 기존 기기는 44 유지
- 오탐으로 판정해 **미수정**: `poop-analyzer` photoRemoveBtn `top:10`(사진 박스 기준, 화면상단 아님) / `_layout` mascotGlow `top:10`(마스코트 장식) / `voice-settings` Bixby `intent://`(가이드 목록은 SIRI만 노출돼 호출 불가한 dead code) / `lullaby` 마이크 권한(이미 Alert 존재)
- 검증: `tsc` ✅ EXIT=0 / `lint` ✅ 0 errors

### G. 임당 식단 모달 키보드 가림 fix + 임신부 모드 전수 점검 (사용자 보고)
- 증상(iOS): 임당(gdm) **식단 기록 모달**에서 decimal-pad가 "식단 저장" 버튼을 가려 저장 불가 (keyboardShouldPersistTaps만 있고 KAV 없어서 — 앞서 "중위험"으로 봤으나 실제 막힘 확인)
- 수정: `gdm.tsx` 식단 모달 `modalOverlay` View → `KeyboardAvoidingView(behavior=ios?'padding')` 교체
- 임신부 모드 전수 점검(에이전트): 혈당 모달·출산가방 AddItemModal·병원등록·다음검진 모달은 **이미 KAV 적용됨**, mom-wellness(EPDS 버튼선택)·labor-monitor·임신앨범은 숫자입력 모달 없음 → 추가 수정 불필요
- 검증: `tsc` ✅ EXIT=0 / `lint` ✅ 0 errors

### H. iOS App Privacy(앱이 수집하는 개인정보) 설문 작성·게시 (크롬)
- 개인정보 처리방침 URL: `https://amatda-parenting.web.app/privacy`
- 코드 감사 기반 15개 데이터 유형 신고 + 목적/신원연결/추적여부 설정 후 게시. **앱 추적(ATT)=사용 안 함**(비개인화 광고 `requestNonPersonalizedAdsOnly`, ATT 호출 없음, Firebase Analytics는 uid만)
- 연결: 건강/민감정보(임신)/연락처(이름·이메일·전화)/위치(정밀)/사용자콘텐츠(사진·기타)/사용자ID/구입내역/제품상호작용/충돌·실적데이터
- 미연결: 기기ID·광고데이터(AdMob 비개인화, 제3자 광고 목적)

### I. iOS 출시 마무리 — 앱정보·가격·빌드·제출 (크롬)
- 콘텐츠 권한="예(권한 있음)" / 연령등급=**13+**(UGC·의료정보·광고) / 카테고리=라이프스타일+건강및피트니스 / 가격=무료(전 국가)
- **iPhone 전용 + ATT 제거 리빌드**: `app.json` `supportsTablet:false`, AdMob 플러그인 `userTrackingUsageDescription` 제거 → 빌드 24(`336dd2f3`) → ASC 업로드 → 버전 빌드 23→24 교체로 iPad·추적 오류 해결
- **iOS 앱 1.0 (빌드 24) 심사 제출 완료** → "심사 대기 중" (구독 연간/월간 동반 제출)
- 출시국가: 현재 대한민국(검토 필요 — 전세계 확장 가능)

### J. Android 사진/동영상 권한 정책 위반 fix (expo-media-library 제거)
- 증상: Play Console "READ_MEDIA_IMAGES/VIDEO 잘못된 사용" — 비핵심/일회성 미디어 접근엔 시스템 사진 선택기만 허용
- 원인: `components/album/RecentPhotosGrid.tsx`가 `expo-media-library`(getAssetsAsync)로 갤러리 전체를 읽어 READ_MEDIA_IMAGES 요구 (얼굴감지 자동선택 기능)
- 수정: RecentPhotosGrid를 **시스템 사진 선택기(`pickMultipleFromLibrary`) 전용 래퍼로 재작성** (호출부 album.tsx 무변경) + `app.json`에서 expo-media-library 플러그인 제거 + `npm uninstall expo-media-library`. blockedPermissions(READ_MEDIA_IMAGES/VIDEO)는 유지
- 기능 영향: 앨범 사진 추가(여러 장 포함) 정상 / "얼굴 사진만 자동선택" 편의기능만 제거(정책상 유지 불가). 얼굴감지 잔재 코드/토글 0건 확인
- 검증: `tsc` ✅ EXIT=0 / `lint` ✅ 0 errors / Android 프로덕션 리빌드 진행 중(vc11)
- 통신판매업 신고: 신규/간이과세자면 면제 가능성 높음(직전년도 거래 50회 미만 or 간이과세자) → Play Console이 번호 강제하는지 확인 필요

---

## 2026-06-07 출시 준비 — 공지 팝업 · 베타 문구 · 웹 가격 동기화 · 아기시간 개선 (OTA/배포 완료)

### 신규 기능
- **시작 공지 팝업** (원격 Firestore 제어):
  - 신규 컬렉션 `announcements` + `GET /api/announcement/active` (admin SDK, 클라 직접접근 X → firestore.rules 무변경)
  - 콘솔에서 `active`·`startAt`/`endAt`·`priority`로 노출/기간 제어, 앱 업데이트 불필요
  - 홈 첫 진입 시 이미지+제목+본문+링크버튼(구글폼) 팝업, "오늘/일주일 보지 않기" 체크박스(AsyncStorage)
  - 파일: `backend/src/routes/announcement.ts`, `frontend/components/common/AnnouncementPopup.tsx`, home 연동
- **베타 테스터 공지 생성** (Firestore doc `U5cdAwiyVnDD0PIiMVbg`): 100명 모집 / 우수리뷰어 10명×5만원 / 모집 6.8~14 / 발표 6.15(팝업+개별연락) / 구글폼 `forms.gle/yRigYK7fSxWeqVke7`
  - 카카오 챗봇 베타 카드(`kakao.ts`)도 동일 문구로 동기화·배포

### 아기시간 / 패턴 그래프 수정
- 사진 파서: 상대날짜(어제/dayRef) 보정 + note에서 기상시각 추출(endTime) + cross-day endTime 표식
- 리뷰 화면: 기록별 어제/오늘 날짜 토글
- AI 오늘 일기: 컬렉션 버그(dailyTracking→babyTrackerDays) + 날짜 폴백 + 실명 토큰치환 + 길이 단축
- 24h 패턴(DayClock): 베이비빌리식 라디얼(필터칩·1시간 눈금) + cross-day 수면 그래프 오작동 수정 + 날짜 네비
- 진행중 수면 LIVE 세션 등록(사진/음성)

### 웹/가격 동기화
- **refund.html·amatda.html 연간가 33,900→39,900 (28%→15% 할인)** 잔재 수정 + Firebase Hosting 배포
- 홈/로딩/스플래시 배경 순백 통일

---

## 2026-06-06 임신모드 가이드 4종 + 아이콘/헤더 수정 + 기간요약 탭 분리 (프로덕션 OTA 완료)

### 작업
- **임신모드 가이드 4종 신규** (스포트라이트, 각 3페이지, 의료성 3종 면책 포함):
  - `gdmGuide.tsx`(임당): 혈당 시점·기준선 → 식단 AI 사진분석 → 주간리포트+면책. 아이콘 quick-blood/icon-camera/quick-report.
  - `momWellnessGuide.tsx`(마음진단): 매일 기분일기 → EPDS 점수해석 → 가족공유+위기상담(1577-0199/1393)+면책. icon-heart.
  - `laborMonitorGuide.tsx`(진통·태동): 진통 시작/종료 → 가진통/진진통·5-1-1 → 태동카운트+응급면책. icon-hospital/quick-baby/icon-redflag.
  - `birthBagGuide.tsx`(출산가방): 분만/산후 맞춤목록 → 상태/담당태그·진행률 → 아빠모드·공유. icon-share.
  - 연결: gdm(native headerRight), mom-wellness/labor-monitor(ScreenHeader right), birth-bag(공유버튼 옆 row). 첫방문 자동(`shouldAutoShowGuide`)+'?'.
- **맘스톡 이모지→기존 에셋**: 월방 quick-timeline, 내동네 cat-social, 익명 icon-lock, 신고 icon-redflag.
- **성장앨범·AI분석 '?' 잘림 수정**: native Stack.Screen headerRight를 `<View style={{marginRight:14}}>`로 감싸 안쪽으로.
- **아기시간 기간요약 → 2개 독립 토글 분리**: ①기간 분석(7/14/1달 표) ②하루 패턴·24시간(DayClock 원형). 각각 따로 펴고 접힘. 둘 중 하나 열리면 광고. 상태 `clockSectionOpen` 추가.

### 검증 / 배포
- `tsc` ✓ 0 에러 / `lint` ✓ 0 에러. 크롬으로 4종 가이드 + 맘스톡 교체 아이콘 실제 PNG 렌더 확인.
- `eas update --branch production` — android+ios. group 59c2ca73-5cf9-44c1-91ce-f438fda2ebd0, runtime 2.9.1.

### 가이드 총괄 (14개 화면)
첫실행·아기시간·상담이모·공동육아·성장·SOS·기질·성장앨범·AI분석·맘스톡 + **임당·마음진단·진통/태동·출산가방**.

---

## 2026-06-06 기간요약 24시간 원형차트 + 가이드 아이콘 교체 (프로덕션 OTA 완료)

### 작업
- **`components/baby-tracker/DayClock.tsx` 신규** — 하루 24시간 원형 패턴 차트 (react-native-svg). 베이비빌리 '패턴' 개선판:
  - 0시 12시방향·시계방향, 2h 눈금 + 0/6/12/18 라벨.
  - 수면 = 시작~종료 **호(arc)**, 단발기록(수유/배변/투약) = 링 바깥 **색점**.
  - 가운데 날짜 + 핵심요약(수유 N·수면 Nh), 범례, 빈 상태 안내. records만으로 자체 집계.
  - `baby-tracker.tsx` 기간요약 펼침 영역 상단에 `<DayClock records={allRecordsSorted} dateLabel=.../>` 렌더 (기존 일별 표는 아래 유지 → 하루 패턴 + 다기간 추세 둘 다).
  - 색상 = TRACKER_COLORS 톤(배변 #6AAFBB, 수유 #E6B84D, 수면 #B8A0D2, 투약 #558B2F).
- **가이드 이모지 → 커스텀 아이콘**:
  - `albumGuide.tsx`: 👣🗣😊 → milestone-body/talk/heart, 📖 → album-cover.png, 그리드 이모지 → 파스텔 placeholder, PDF는 텍스트 배지.
  - `aiAnalysisGuide.tsx`: 📊💩🔊 → quick-report/cat-poop/cat-crying, 📷🎙️ → icon-camera/icon-mic.

### 검증 / 배포
- `tsc` ✓ 0 에러 / `lint` ✓ 0 에러. 크롬으로 DayClock SVG(샘플 하루) + 실제 PNG 아이콘 렌더 확인.
- `eas update --branch production` — android+ios. group 643676ec-d845-437e-a813-600a73bef0ef, runtime 2.9.1.

### 남은 이슈 / 후속
- 맘스톡(📅📍🙈🚨) + 오래된 가이드(첫실행/상담이모 등)의 이모지는 딱 맞는 커스텀 에셋 부재로 미교체 — 에셋 확보 후 추가 교체 가능.

---

## 2026-06-06 가이드 추가 — 성장앨범·AI분석·맘스톡 + 기질 정리 (프로덕션 OTA 완료)

### 작업
- **기질 가이드**: 마지막 의미없는 🌷 "참고로만 봐주세요" 페이지 제거 (4→3페이지).
- **신규 가이드 3종** (스포트라이트 스타일, 핵심 3페이지·군더더기 없음):
  - `features/guide/albumGuide.tsx` (성장앨범): 사진 기록 → 발달단계(마일스톤) 자동 제안 → PDF 앨범.
  - `features/guide/aiAnalysisGuide.tsx` (AI분석): 3종(육아패턴/대변/울음) → 기록만 하면 패턴 자동분석 → 사진·녹음 분석 + 촬영/녹음 팁 + 연령 안내 + 참고용 면책.
  - `features/guide/momGroupGuide.tsx` (맘스톡): 월방/내동네 → 글쓰기·카테고리 → 익명·신고 안전장치.
- **화면 연결** (첫방문 자동 `shouldAutoShowGuide` + 헤더 '?' `GuideButton`):
  - `ai-analysis.tsx`: Stack.Screen headerRight + GuideCarousel (accent 보라).
  - `album.tsx`(BabyAlbum): headerRight + GuideCarousel.
  - `mom-group.tsx`: **기존 옛 모달 가이드(GUIDE_PAGES/guideStep) 제거 → 새 GuideCarousel로 교체**, 헤더 우측에 '?'+🔍 나란히.

### 검증 / 배포
- `tsc` ✓ 0 에러 / `expo lint` ✓ 0 에러(남은 경고는 전부 기존). 크롬 HTML 렌더로 3종 목업 확인.
- `eas update --branch production` — android+ios. group d4d1803b-c962-4631-88d8-237fae119987, runtime 2.9.1.

### 가이드 총괄 (10개 화면 통일)
첫실행 · 아기시간 · 상담이모 · 공동육아 · 성장 · SOS · 기질 · **성장앨범 · AI분석 · 맘스톡**

---

## 2026-06-06 가이드 전면 개편 — 스포트라이트 코치마크 (프로덕션 OTA 완료)

### 작업 목적
- 기존 가이드(흰 모달 카드 + 목업)가 "대충"해 보임 → 베이비빌리류 **스포트라이트 코치마크**(실제 화면 반투명 딤 + 점선 화살표 + 떠 있는 카드)로 고급화. 7개 가이드 톤 통일.

### 핵심 변경
- **`components/common/GuideCarousel.tsx` 전면 재작성** (공용 쉘):
  - 반투명 딤(rgba(18,17,24,0.66)) + 상단(건너뛰기·진행점·다음›) + 흰 캡션 + **점선 화살표(▾, 순수 View)** + 밝게 떠 있는 카드(그림자) + 페이드·슬라이드 전환. 하단 "← 이전" 미니멀.
  - `GuidePage` API 100% 호환 → 콘텐츠 파일 미변경으로 6개 화면 자동 적용.
- **`components/baby-tracker/BabyTrackerGuide.tsx`**: 자체 쉘 제거 → 목업 5종 유지하고 `GuideCarousel` 위임(통일). 미사용 import/스타일 정리.
- **색감 톤다운**(촌스러움 제거): `GUIDE_C` + 베이비트래커 `C` 팔레트 채도↓ 파스텔화(accent #FF8C5A→#F0976C, blue/gold/purple/green/red 전부 뮤트). 퀵버튼 연한 파스텔+다크텍스트. SOS 4단계는 구분 유지·채도만↓.
- **글씨 Medium**: 제목 800(→앱 폰트패처 Medium), 설명 500, 내비 600/700. (얇음↔두꺼움 3회 반복 후 Medium 확정)
- 화면별 강조색 동기화: sos #E5564B→#DB6A5F, coparenting #8B72BE→#9D8CC6, growth #5E9A4E→#7CA46E, GuideButton 기본 #FF8C5A→#F0976C.

### 구조적 수정 (HTML 미리보기로 못 잡는 RN 이슈)
- 카드 그림자를 배경 없는 래퍼(cardWrap)→배경 있는 카드(mockFrame)로 이동 — **Android elevation은 배경 있는 뷰에만 그림자 렌더**되므로 양 플랫폼 일관 확보.

### 검증 / 배포
- 크롬으로 **HTML 1:1 미리보기 렌더·스크린샷**하여 화면/구조/레퍼런스 일치 점검(3회 반복).
- `npx tsc --noEmit` ✓ 0 에러 / `npx expo lint` ✓ 0 에러.
- `eas update --branch production` — android+ios 발행. group 2034153f-80b6-41b3-a83b-8406e8d5572a, runtime 2.9.1.

### 적용 가이드 (7)
첫실행(OnboardingGuide) · 아기시간 · 상담이모 · 공동육아 · 성장 · SOS · 기질

### 남은 이슈
- 없음. (추후 더 두껍게/얇게 미세조정 요청 시 GuideCarousel title/desc fontWeight만 조정)

---

## 2026-06-06 상세 작업 로그 (세션 풀 기록)

> 아래 두 작업(카카오 챗봇 개편 / 연간가 39,900원)의 **세부 진행 과정·이슈·결정**을 빠짐없이 기록.

### A. 카카오 챗봇 — 작업 흐름
1. 사용자가 "회원가입 시 카톡 안내문구 너가 쓴 거 수정해야 함" → 발신원 2개로 분리 확인:
   - **채널 추가 자동 환영 메시지** = 카카오 관리자 콘솔 설정(코드 아님) → 손 안 댐.
   - **챗봇 스킬 응답** = `backend/src/routes/kakao.ts` (내가 작성한 부분) → 여기 수정.
2. 챗봇 블록 구조 확인: `/skill/menu`, `/skill/qa`(Gemini), `/skill/emergency`, `/skill/faq`, `/skill/beta`, `/skill/fallback`, `/health`.
3. 시점 지난 문구 4곳 수정(아래 변경 표 참조).
4. 베타 카드 처리 방침을 사용자에게 질문(AskUserQuestion) → 답변:
   - 베타 블록: **"마감일 연장해서 계속 모집"**
   - 신청 링크: **"구글폼으로 연결"**
5. 구글폼 신규 생성(아래 C) → 단축 URL 확보 → 버튼에 연결.
6. 타입체크 → api 함수만 배포 → grep로 8개 변경 라이브 확인.

### B. 카카오 챗봇 — 변경 라인 상세 (kakao.ts)
| 위치 | 이전 | 이후 |
|------|------|------|
| L130 메뉴카드 | "6월 6일 정식 출시!" | "드디어 정식 출시되었어요 🎉" |
| L269 FAQ 비용 | "월 9,900원 (출시기념 1년 무료)" | "월 3,900원 / 연 39,900원 (연간 15% 할인)" |
| L270 FAQ 다운로드 | "(6월 6일 출시)" | '"아맞다" 검색 후 다운로드' |
| L300 베타 혜택 | "프리미엄 1년 무료 (12만원 상당)" | "프리미엄 1년 무료 (39,900원 상당)" |
| L305-307 베타 마감/리뷰 | "~6월 5일 마감 / 선정 6월 6일" | "리뷰 1회 이상 필수 / ~6월 13일 자정 마감 / 선정 6월 14일 개별 연락" |
| L309 신청하기 버튼 | 홈페이지 webLink | `https://forms.gle/yRigYK7fSxWeqVke7` |
> 참고: 앱 다운로드 버튼은 `https://sylabs.kr/amatda` 유지(미변경).

### C. 구글폼 — 생성 상세
- 생성 수단: 구글폼 **Gemini AI 폼빌더**("만들기"→"양식 만들기")로 초안 생성 후 수정.
- 폼 ID: `1S2Vp83OK2irbSwOZlmnQ7CwSTpgjxVMphtkIA1VbMR4`
- 제목: **"아맞다 베타 테스터 신청"**
- 문항(8): 이름\*, 전화번호\*, 자녀개월수, 임신개월수, 휴대폰기종\*, SNS주소\*, 리뷰동의(체크)\*, 개인정보동의(체크)\* — (\* = 필수)
- 게시: "게시"(공개) → 응답 권한 "링크가 있는 누구나" → "URL 단축" → **forms.gle/yRigYK7fSxWeqVke7**
- 발생 이슈: 전화번호 문항 "필수" 토글이 안 켜진 듯 보임 → 원인 (1) 클릭 좌표가 라벨에 맞음, (2) 편집 중엔 빨간 별표가 가려짐 → 파란 토글(ON)이 실제 상태. ref 클릭으로 ON 확인해 해결.
- 응답 확인: 폼 편집화면 "응답" 탭 또는 스프레드시트 연동.

### D. 연간가 39,900원 — 작업 흐름 / 스토어
1. 코드 9곳 동기화(아래 "수정 파일" 참조) — 모두 39,900 / 15% / 월 3,325.
2. **Google Play Console**: 일괄 "Set prices" 다이얼로그가 39,900→40,000으로 **반올림**(price-ending rounding) → 행별 인라인 "가격 수정" 에디터로 39900 직접 입력 → "변경사항 저장" → "신규 정기결제 사용자에게만 적용" 확인.
3. **App Store Connect**: ₩39,900이 기본 가격대 드롭다운엔 "결과 없음" → "추가 가격 보기"(확장 900 price points) 로드 → ₩39,900.00 선택 → 대한민국 기준 확정, 175개국 자동 환산.
4. **보안 결정**: ASC 로그인 페이지(authResult=FAILED) 등장 시 비밀번호 입력 **거부**(자격증명 입력 금지 규칙) → 사용자가 직접 로그인 후 진행.
5. 백엔드 6개 함수 배포 + 프로덕션 OTA(android+ios, group 7fb0abca, runtime 2.9.1).

### E. 미해결 / 후속
- iOS 구독(premium_yearly/monthly) "메타데이터 누락됨" — 가격은 들어갔으나 **현지화(표시명/설명)** 보완 + 유료앱 계약 활성화해야 IAP 심사 제출 가능. (가격 작업과 별개, 사용자 작업 대기)
- Play 가격 변경은 신규 구독자만 적용(기존 구독자 없음 — 클린).

---

## 2026-06-06 카카오 챗봇 문구 개편 + 베타 신청 구글폼

### 작업 목적
- 카카오 채널 챗봇(`backend/src/routes/kakao.ts`)에 시점 지난 문구 정리 + 베타 모집 재정비.

### 변경 (kakao.ts)
- 메뉴 카드: "6월 6일 정식 출시!" → "드디어 정식 출시되었어요 🎉" (날짜 비의존)
- FAQ 다운로드: "(6월 6일 출시)" → '구글 플레이 / 앱 스토어에서 "아맞다" 검색 후 다운로드'
- 베타 카드: 마감 ~6/5 → **~6/13**, 선정 연락 6/6 → **6/14**, **"리뷰 1회 이상 필수"** 문구 추가
- 베타 "📝 신청하기" 버튼: 홈페이지 → **구글폼** `https://forms.gle/yRigYK7fSxWeqVke7`

### 구글폼 (크롬 자동화로 생성·게시)
- 폼: "아맞다 베타 테스터 신청" (Gemini 폼빌더로 생성, 계정 juhyun/주현 송)
- 8문항: 이름*, 전화번호*, 자녀개월수, 임신개월수, 휴대폰기종*, SNS주소*, 리뷰동의(체크)*, 개인정보동의(체크)*
- 게시 완료(링크가 있는 누구나 응답) → 단축링크 forms.gle/yRigYK7fSxWeqVke7
- 편집 URL: docs.google.com/forms/d/1S2Vp83OK2irbSwOZlmnQ7CwSTpgjxVMphtkIA1VbMR4/edit

### 배포
- `npx tsc --noEmit` ✓
- `firebase deploy --only functions:api --project amatda-parenting` — api 함수 업데이트 성공.
- (프론트 무관 — 카카오는 백엔드 응답이라 OTA 불필요)

---

## 2026-06-06 프리미엄 연간 구독가 변경 (33,900 → 39,900원)

### 작업 목적
- 카카오 챗봇 베타 카드의 "프리미엄 1년 무료 (12만원 상당)" 문구가 실제가(33,900)와 안 맞아 정정 요청.
- 추가로 사용자가 연간가를 39,900원으로 인상 결정 → 코드 + 스토어 전부 동기화.

### 수정 파일 (코드 9곳 — 모두 39,900 / 할인율 15% / 월환산 3,325원)
- `backend/src/routes/payment.ts` — premium_yearly price 33900→39900
- `backend/src/routes/subscription.ts` — price 39900, monthlyPrice 3325, "15% 할인" x2, "월 3,325원꼴"
- `backend/src/routes/kakao.ts` — 챗봇 FAQ "월 3,900 / 연 39,900 (15% 할인)", 베타카드 "39,900원 상당" (※ FAQ 기존 "월 9,900" 오타도 3,900으로 정정)
- `frontend/app/(main)/subscription.tsx` — price/priceLabel/discount/월환산/priceKRW
- `frontend/services/payment.ts` — premium_yearly price 39900
- `frontend/app/(main)/terms.tsx` — 이용약관 "VIP 연간(39,900원/년)"

### 스토어 (크롬 자동화로 직접 변경)
- **Google Play Console** — premium_yearly 기본요금제(yearly/대한민국) KRW 33,900 → **39,900** 저장.
  - 주의: 일괄 "Set prices"는 40,000으로 반올림됨 → 행별 인라인 "가격 수정"으로 정확히 39,900 입력해야 함.
- **App Store Connect** — premium_yearly 구독가 **대한민국 ₩39,900** 신규 설정 (175개국 자동 환산).
  - ₩39,900은 기본 가격대엔 없고 "추가 가격 보기"(확장 900 price points)에서 선택.
  - ⚠️ iOS 구독은 아직 "메타데이터 누락됨" — 가격은 들어갔으나 현지화(표시명/설명) 보완해야 심사 제출 가능. (가격 작업과 별개)

### 검증 / 배포
- `cd backend && npx tsc --noEmit` ✓ / `cd frontend && npx tsc --noEmit` ✓
- 남은 33900/2825/28% 흔적 0건 확인.
- 백엔드: `firebase deploy --only functions --project amatda-parenting` — 6개 함수 전부 성공.
- 프론트: `eas update --branch production` — android+ios 발행 (group 7fb0abca, runtime 2.9.1).

### 남은 이슈
- iOS premium_yearly/monthly "메타데이터 누락됨" — IAP 심사 제출 전 현지화 필요 (유료앱 계약 활성화 대기와 별개).
- Play 가격 변경은 신규 구독자에게만 적용(기존 구독자 없음 — 클린).

---

## 2026-06-05 아기시간(baby-tracker) — 공동육아 작성자 표기 ("엄마가 기록함")

### 작업 목적
- 초대받은 가족(엄마/아빠/조부모 등)이 아기시간에 기록하면, 타임라인 카드에
  "엄마가 기록함" / "아빠가 기록함" 처럼 작성자를 표시.
- 소유자(owner) 본인 기록 / 옛 기록은 라벨 미표시(graceful) — 요구사항대로.

### 스키마 변경 (사용자 승인 받음 — Rule of Two)
- `TrackerRecord` / 백엔드 `TrackerRecordSchema`에 optional 2필드 추가:
  - `authorId?: string` — 작성자 userId
  - `authorLabel?: string` — 비정규화 닉네임("엄마"/"아빠"). 작성 시점 스냅샷.
- 둘 다 optional → 옛 데이터/소유자 기록엔 없음 → 라벨 미표시.

### 해결 방식
- 신규 헬퍼 `features/baby-tracker/author.ts`:
  - `resolveAuthorMeta(childId)` — `GET /coparenting/my-permissions/:childId` 조회.
    role==='owner'·nickname 없음·403/오프라인 → null(라벨없음). 멤버면 `{authorId, authorLabel:nickname}`.
    `${userId}:${childId}` 키로 세션 내 캐싱.
  - `stampAuthor(record, meta)` — **신규 기록 생성 시점에만** 주입(배열 일괄 stamp 금지 — 남의 기록 덮어쓰기 방지).
- `baby-tracker.tsx`: 마운트 시 `authorMeta` 1회 조회. 생성 경로 전부 stamp:
  `handleAddRecord`(빠른추가/타이머-quick/분유원터치/폼저장), 수면기상(타이머·일반), 모유종료, 커스텀.
  편집/이동 경로는 `...editRecord` spread 로 원작성자 보존(재stamp 안 함).
  `TimelineEntry` 렌더에 `record.authorLabel` 있으면 "{라벨}가 기록함" 캡션 표시.
- `PhotoLogReview.tsx`(사진 일괄), `voice.tsx`(음성 일괄)도 저장 직전 `resolveAuthorMeta` → stamp.
- 홈 `DenseStatsRow`는 개별 기록이 아닌 집계만 렌더 → 작성자 표시 대상 아님(변경 없음).

### 검증 결과
- `cd backend && npx tsc --noEmit` 통과 (0 에러)
- `cd frontend && npx tsc --noEmit` 통과 (0 에러)
- `cd frontend && npx expo lint` — 0 errors (기존 미사용 변수 warning만 잔존, 신규 코드 무관)

### 배포 (2026-06-05 완료)
- 프론트 OTA: `eas update --branch preview` 완료 (런타임 2.9.1, Android/iOS).
  update group `21af6dc0-dfed-44dc-b8de-334b70d222ed`.
- 백엔드: `firebase deploy --only functions --project amatda-parenting` 완료.
  - 1차 배포에서 `api` 함수가 "No changes detected"로 skip되어, `--only functions:api`로 재배포 →
    "Successful update operation" 확인 (해시 캐시 quirk).
  - 헬스체크: `PUT /api/baby-tracker/test/days/...` → HTTP 401 "인증이 필요합니다" (라우트/인증 정상).

### 남은 이슈
- 엑셀 import(BabyTime 과거 데이터 일괄)는 "본인 과거기록 이관" 성격이라 작성자 미주입(의도적).
- 실기기 E2E 확인(초대받은 가족 계정으로 기록 → 소유자 화면에 "엄마가 기록함" 노출)은 사용자 단말에서.

---

## 2026-06-05 공동육아 invitee 화면 — 연결상태/역할/권한 표시 (UX 회귀)

### 증상
- 초대를 수락한 사람(invitee, 예: 엄마)의 공동육아 화면에 "가족과 함께 ...의 성장을 기록하세요"
  문구만 뜨고, 본인이 그 아이에 어떤 역할/권한으로 연결됐는지 알 수 없음.
- 더 나아가 `coparenting.tsx`의 "나 (소유자)" 카드가 `isOwner` 무관하게 무조건 렌더되어
  invitee도 자신을 "소유자"로 잘못 표시.

### 원인
- 화면이 owner 중심으로만 설계됨. invitee 분기(자기 역할/권한 표시) 부재.

### 해결 방식 (frontend 1파일만 수정: `app/(main)/coparenting.tsx`)
- 백엔드는 변경 불필요 — 이미 invitee 접근 지원:
  - `getAccessibleChildIds`가 공유받은 아이를 `GET /children`에 포함 → invitee childStore에 공유 아이 표시됨.
  - `GET /coparenting/members/:childId`가 invitee(accepted)도 호출 가능, `isOwner:false` + 전체 멤버 반환.
- `authStore.userId`로 members 목록에서 "나"(`inviteeUserId === userId`) 식별.
- `isOwner` 분기 렌더:
  - owner: 기존 "나(소유자)" + "연결된 가족" + 초대/권한수정/삭제.
  - invitee: **연결상태 카드**("당신은 [아이]의 공동육아에 [역할]로 연결되어 있어요" + 표시이름 + 연결됨 뱃지)
    + **내 권한 목록**(허용/제한 표시, 읽기 전용) + **함께하는 가족**(읽기 전용).
- "초대 코드 입력" 버튼·혜택 카드는 공유, 초대하기 버튼은 owner 전용.

### 검증 결과
- `cd frontend && npx tsc --noEmit` 통과 (0 에러)
- `cd frontend && npx expo lint` — coparenting.tsx 경고/에러 0 (기존 타 파일 warning만 잔존)

### 남은 이슈
- OTA 배포(production/preview)는 사용자 확인 후 진행 — 작업트리에 v2.9.0 다른 수정 다수 포함됨.

---

## 2026-06-03 iOS 첫 빌드 회귀 — 홈 화면 터치 먹통 수정 (P0)

### 증상
- iOS TestFlight 빌드에서 **홈 탭만** 모든 콘텐츠 탭(터치) 무반응. 스크롤은 정상.
  SOS 플로팅 버튼(ScrollView 밖)만 눌림. 다른 탭(아기시간/상담이모/가족피드/마이) 정상.
- "가이드/팝업을 닫은 뒤부터" 발생, 앱 재시작 시 일시 해소(닫기 전까지만).

### 원인 (구조적)
- **RN iOS 알려진 버그**: `<Modal>` 을 `<ScrollView>` **안**에 렌더하면, 그 모달을 닫은 뒤
  iOS 에서 하위 콘텐츠의 탭 응답(hit-test)이 죽음(스크롤은 유지). Android 는 영향 없음 → 첫 iOS 빌드라 표면화.
- `app/(main)/home.tsx` 가 ScrollView 안에 Modal 5개 렌더 중이었음:
  OnboardingGuide(첫진입 가이드), ProactivePopup, NextCheckupModal, 체험만료/출산 CenterModal.

### 해결 (정석)
- `app/(main)/home.tsx` — Modal 5개를 전부 **ScrollView 밖, 화면 루트(container 직속 형제)** 로 이동.
  Modal 은 자체 네이티브 윈도우로 떠서 트리 위치를 옮겨도 외형·동작 동일, iOS 터치 버그만 제거.
  (RN/Expo 공식 권장 패턴.) 로직/핸들러/상태 변경 없음 — 순수 JSX 구조 이동.

### 검증
- babel 파싱 OK(JSX 균형·문법 정상). 타입/식별자 변화 없어 tsc 영향 없음(sandbox 미설치로 tsc 직접 실행 불가).
- **JS-only 변경 → OTA(expo-updates)로 배포 가능, 네이티브 재빌드 불필요.**

### 전체 탭 감사 결과 (Modal-in-ScrollView)
- **home** — RN Modal 5개 ScrollView 안 → 밖 이동 (실제 버그, 수정).
- baby-tracker — clean (Modal들 이미 ScrollView 밖 / "Modal 안 ScrollView"는 정상).
- chatbot(상담이모) — clean (Modal 없음).
- momstagram(가족피드) — clean (Modal이 FlatList 밖, 내부 ScrollView 정상).
- **profile(마이)** — `PasswordModal`은 RN Modal 아님(인라인 `position:absolute` 전체화면 오버레이).
  Modal-dismiss 터치버그는 아니나, root ScrollView 안이라 열면 스크롤 콘텐츠 기준 배치돼 화면 못 덮는 별개 결함 →
  `<View flex:1>` 로 감싸고 PasswordModal 을 ScrollView 밖으로 이동 + `View` import 추가. (검증: babel 파싱 OK)

## 2026-06-03 iOS 자녀 등록 화면 뒤로가기 없음 (P1)
- 증상: iOS엔 하드웨어 뒤로가기 없는데 `app/onboarding/child-info.tsx`에 뒤로 버튼 없음 → 진입 후 못 빠져나옴.
  원인: `app/onboarding/_layout.tsx`가 전 화면 `headerShown:false` + child-info에 자체 뒤로 UI 없음.
- 해결: child-info `<Stack.Screen>`에 `headerShown:true` + 앱 톤 헤더(배경 크림/그림자 제거/tint=text/`headerBackTitle:'뒤로'`)
  → 네이티브 뒤로 버튼 + 엣지 스와이프 + 노치 안전영역 일괄 확보. (검증: babel 파싱 OK)
- 후속 점검(미적용): set-nickname/intake-form/kakao-channel/analysis-report 도 뒤로 없음 →
  forward-only 의도(consent/notification-permission/result)와 구분해 선별 추가 검토 필요. 사용자 판단 대기.

## 2026-06-03 iOS 사진기록(PhotoLogReview) 취소버튼 안전영역 (P1)
- 증상: 아기시간 "📷 사진기록" 화면(`PhotoLogReview`, 전체화면 Modal)에서 취소 버튼이 iOS 상태바(시계) 영역에 깔려 클릭 불가.
- 원인: Modal `container`에 안전영역 상단 inset 없음 → `header`(취소)가 y=0(노치 밑)에서 시작.
- 해결: `components/baby-tracker/PhotoLogReview.tsx` — `useSafeAreaInsets()` 추가,
  `container`에 `paddingTop: Math.max(insets.top, iOS?44:0)` 적용(modal 내 insets 0 폴백 보장). Platform import 추가. (검증: babel OK)
- 후속(미적용): 동일 Modal 하단 액션 버튼 home indicator 겹침 가능 → 필요 시 `insets.bottom` 보강 검토.

### 2026-06-03 사진기록 날짜 — 설명 + 편집 기능 추가 (OTA)
- 문의: 사진(알림장) 기록이 오늘(6/3) 입력인데 6/2로 저장됨.
- 원인(버그 아님): `backend/src/routes/tracker.ts` photo-parse 프롬프트가 "알림장에 날짜 보이면 그 날짜 사용".
  AI가 알림장 사진 속 날짜(6/2)를 읽은 것. 프론트 clientDate/백엔드 KST 계산은 정상(6/3).
- 사용자 선택 = 날짜 직접 수정 가능하게.
- `components/baby-tracker/PhotoLogReview.tsx` — 확인화면 상단에 **날짜 바**(TextInput + "오늘" 버튼) 추가.
  `setAllDates`/`setAllToday` 로 모든 기록 날짜 일괄 변경(사진 1장=보통 하루). 배포: update group b8ca06b3.

### 2026-06-03 가족 초대 링크(딥링크) — 무료 MVP (OTA + Hosting)
- 요구: 초대코드 손입력 대신, 링크 누르면 앱 있으면 자동참여 / 없으면 스토어+설치후 재탭.
- Branch 안 씀(유료 절벽). 무료 방식 = 커스텀 스킴(amatda://, 기설정) + Firebase Hosting 랜딩 + "설치 후 링크 재탭".
- 신규 `public/invite.html` — `?code=XXX` 읽어 `amatda://coparenting?inviteCode=XXX` 자동 열기 시도 + 스토어 버튼 + 재탭 안내 + 코드 표시(폴백). `firebase.json` `/invite` rewrite 추가.
- `app/(main)/coparenting.tsx`(OTA): `useLocalSearchParams` 로 `inviteCode` 수신 → 자동 `accept()` (실패 시 코드 채워 수동). 공유 메시지를 `https://amatda-parenting.web.app/invite?code=` 링크로 변경. (APP_STORE_LINK 상수 제거)
- 배포: Firebase Hosting 배포 완료(https://amatda-parenting.web.app/invite) + OTA(production 5718064a / preview f44b6ea5).
- 한계(MVP): 커스텀 스킴이라 iOS Safari 자동열기 시 프롬프트 가능. 완전 매끄럽게(유니버설 링크)는 재빌드 필요 — 추후. iOS 신규설치 deferred 100%자동은 Branch 필요(현재는 "재탭"으로 무료 우회).

### 2026-06-03 기질(오행) 점수 0점 제거 — 기본점수 방식 (백엔드 배포)
- 문의: 새 아이 기질 분석에 0점이 너무 많음(예 20·0·50·25·0). "0점 없게" 규칙이 빠져있었음.
- 원인: `saju.calculator.ts` `normalizeElements` 가 글자수/8×100(%) 변환이라 없는 오행=0%. floor 없음.
  (사주 8글자=천간4+지지4 카운트는 정상)
- 수정(사용자 선택=기본50): **각 오행 = 50 + 글자수×10 (최대 100)**. 없는 기운=50, 2글자=70, 4글자=90. 0 제거.
  - 합100 가정하던 디스플레이 없음 확인: TraitBars/result=우세기준(val/max), EditorialCover=값 그대로(0~100). 모두 OK.
  - AI 코칭은 dominantType만 사용(숫자 무관) → 영향 없음. dominant=최다글자라 그대로 유지.
- 배포: 백엔드 Functions 배포 완료(api/coachingApi 등).
- ⚠️ **기존 아이는 innateData가 등록 시 저장돼 있어 옛 점수 유지** → 새 점수 보려면 **신규 등록** 또는 **"다시 분석"**(홈 기질카드/trait-detail) 필요.

### 2026-06-03 분석결과 표지 색/안전영역 + 레이아웃 정석 (진행중)
- analysis-report 표지가 다크브라운(`#1A0E0B` 하드코딩)이라 trait-detail의 기질별 네이비와 불일치 →
  `TYPE_GRADIENT[dominantType][0]` 사용 + `useSafeAreaInsets`로 상단/하단 패딩(상태바·네비바 겹침 해결). OTA 완료(364a8e65/preview 6a9327f9).
- **정석 리팩토링 완료(사용자 동의=스크롤형)**: EditorialCover `fullScreen`을 자연높이로(`flex:1`+`space-between` 제거).
  - trait-detail: flexBody → `ScrollView`(넘치면 스크롤·안 잘림) + `AdSlot` flex 형제(안 겹침) + `coverRef`를 안쪽 View로(공유 캡처 전체 유지) + `compact`/`adsActive`/`useShowAds` 제거.
  - analysis-report: `ScrollView` + **"다시 분석하기" 버튼 추가**(첫분석 화면에도) + 안전영역.
  - 배포: OTA production bcd05e70 / preview d05c8bda.
- 점수(미해결, 사용자 #2 우선): 25/13/36=등록 시 저장된 구 % 값. 신 공식은 **신규 등록 아이엔 적용**되나 기존 아이는 사주 재계산 트리거 필요(다시분석=질문만 재실시, 사주 점수 재계산 X). → 추후 "다시분석 시 사주 재계산" 배선 or 신규아이 등록으로 확인.

### 2026-06-03 아이 삭제 stuck 버그 (백엔드 배포)
- 증상: 한 아이 삭제 무반응(첫 시도) → 재시도 시 "삭제에 실패했습니다", 그 아이만 영구 삭제 불가(다른 아이는 정상).
- 원인: `child.ts` DELETE 가 관련 30개 컬렉션을 `Promise.all`로 조회 → 하나라도 실패하면 전체 reject →
  자녀 doc 도 batch 에 묶여있어 안 지워짐 → 영구 stuck. (데이터 많은 아이가 첫 시도 타임아웃/실패 시 발생)
- 수정: ① **자녀 doc 먼저 `delete()`**(즉시 사라짐, stuck 방지) ② 관련 조회 `Promise.allSettled`(실패 쿼리 무시·로깅)
  ③ 배치 commit 각각 try/catch(best-effort). → 관련 정리 일부 실패해도 자녀는 삭제됨.
- 배포: 백엔드 api 함수. 앱 업데이트 불필요 — **그 stuck 아이 다시 삭제하면 됨.**

### 네이버 로그인 — 해결됨 (사용자 확인)
- 네이버 개발자센터 iOS 환경(URL Scheme `naverlogin` + Bundle ID `com.sylabs.amatda`) 등록 → 정상 동작. 코드/빌드 무관(콘솔측).

### 온보딩 뒤로가기 추가 후속 점검 결과
- set-nickname / kakao-channel / analysis-report: 모두 `router.replace`로 진입(forward-only) → history 없어 뒤로 버튼 자체가 안 뜸 → 추가 불필요(설계상 정상).
- intake-form: 참조 0건(데드 라우트 의심) → 별도 정리 대상.
- 결론: 실제 push 진입(홈→)인 child-info만 뒤로 필요했고 이미 수정.

## 2026-06-03 OTA env 이슈 + 앨범 일괄추가 취소버튼
- **web 번들 실패**: `eas update`가 web까지 export → `react-native-google-mobile-ads`가 web 미지원 → 실패.
  해결: `app.json`에 `platforms: ["ios","android"]` 추가(web export 제외). app.config.js 보존 확인.
- **iOS 광고가 회색 목업 박스**: `eas update`가 로컬 `.env`(`EXPO_PUBLIC_ADS_MOCK=true`, 광고ID 없음)를 번들 → AdSlot 목업 표시.
  안드로이드는 EAS 빌드 번들(ADS_MOCK=false)이라 정상 테스트광고. 
  해결방침(사용자 선택=구글 테스트광고): OTA 실행 시 환경변수 인라인 오버라이드(`.env`는 개발용 보존):
  `$env:EXPO_PUBLIC_ADS_MOCK="false"` + 구글 테스트 배너 ID(android 6300978111 / ios 2934735716). medium 은 배너ID 폴백.
  ※ 근본 후속: eas update용 production 환경변수를 EAS 호스팅(env)으로 이전 검토.
- **앨범 일괄추가 취소버튼 안전영역**: `components/album/BatchPhotoReview.tsx` — PhotoLogReview와 동일 패턴
  (`useSafeAreaInsets` + container `paddingTop`). (검증: babel OK)

### 🆕 iOS Siri 앱 명령(App Intents) 추가 — "시리야, 아맞다 육아" (네이티브, 다음 빌드)
- 목적: 수동 단축어 설정 없이 시리로 음성기록 직행. 사용자 선택 = "아맞다 육아".
- 신규 `plugins/withIosSiriShortcut.js` (Expo config plugin):
  - prebuild 시 `ios/<project>/AmatdaSiriShortcut.swift` 생성 + Xcode 빌드소스 등록(멱등).
  - Swift(App Intents, iOS16+): `AmatdaVoiceRecordIntent.perform → OpenURLIntent("amatda://voice?from=siri")`
    → 앱 열림 → expo-router `/voice` → 텍스트 없는 진입(Case 2) → 음성인식 자동 시작.
  - `AmatdaAppShortcuts` 문구: "아맞다 육아"/"아맞다 기록"/"아맞다 음성 기록"/"아맞다 음성".
- `app.json` plugins 에 `"./plugins/withIosSiriShortcut"` 등록. (검증: app.config.js 반영 OK, 플러그인 로드 OK)
- 제약(사용자 안내됨): Apple 규칙상 문구에 앱이름 필수 + 앱이름 단독("아맞다")은 "앱 열기"와 충돌·일반실행과 구분 불가
  → 동작어 붙인 "아맞다 육아"가 음성기록 직행. 다중입력(여러 행동)은 동일 AI 파싱이라 그대로 작동.
- ⚠️ **OTA 불가 — 새 네이티브 빌드 + TestFlight 재제출부터 적용.** 여기서 컴파일 검증 불가(빌드해봐야 확인).
  권장: production 재제출 전 preview 빌드로 App Intents 정상 빌드 확인.
- 가이드 동기화: `app/(main)/voice-settings.tsx` SIRI_GUIDE 를 새 방식으로 교체 —
  "설정 없이 '시리야, 아맞다 육아'" 주력 + 다중입력 예시 + 인식 문구 안내, 기존 수동 단축어("육아")는 (선택) 스텝으로 보존.
  섹션 타이틀/트리거 배너 문구도 갱신. (검증: babel 파싱 OK)
- **빌드 #1(75ddaf3e) 실패**: `OpenURLIntent` 이 iOS 18.0+ 전용인데 `@available(iOS 16.0)` 로 가드 → XCODE_BUILD_ERROR.
  수정: Swift 두 struct `@available(iOS 18.0, *)` 로 상향. 가이드 문구도 iOS 18 이상으로 갱신.
  (앱 자체는 deploymentTarget 16.0 유지·동작, Siri 명령만 18+. 구형은 수동 가이드로 커버.)
- **빌드 #2(b9bf07a1) → build 16 제출**: 빌드/제출 성공했으나 **실기기 실행 시 에러**:
  "The provided URL scheme `amatda` is unsupported; launch is prohibited" — `OpenURLIntent` 이 시리/단축어
  컨텍스트에서 커스텀 앱 스킴 실행을 차단당함. (단축어 자체는 "음성 기록"으로 정상 등록·색인됨)
- **수정(방식 변경)**: OpenURLIntent 제거 →
  - Swift: `openAppWhenRun = true` 로 앱만 전면에 띄우고 `NSUserDefaults("amatda_siri_voice_pending")` 플래그 기록. iOS 16+ 로 복귀.
  - RN: 신규 `hooks/useSiriVoiceLaunch.ts` — react-native `Settings`(=NSUserDefaults) 로 플래그 감지(mount + AppState active)
    → `router.push('/voice')` → 텍스트 없는 진입(Case 2) → 녹음 자동 시작. `app/_layout.tsx` RootLayout 에서 호출.
  - 가이드 문구 iOS 16 으로 복귀. (네이티브 모듈/AppDelegate 수정 불필요 — RN 내장 Settings 활용)
- **빌드 #3(0d7673e3) 성공 → build 17 TestFlight 제출 완료** (submission 349736cb).
  플래그 방식이라 "scheme prohibited" 에러 회피. Apple 처리 후 설치 가능.
  ※ 실기기 검증 대기: "시리야 아맞다 육아" → 앱 열림 + /voice 이동 + 녹음. (워밍업: 설치 후 앱 1회 실행 → 시리 색인)
  콜드런치 타이밍은 변수 — 일반(백그라운드→시리 호출) 케이스는 동작 예상.
- **실기기 결과**: "아맞다 육아" → 앱·음성화면 정상 진입 확인! 단 **말하기 전에 화면이 조기 종료**되는 문제 →
  Siri 핸드오프 직후 오디오 세션 충돌로 인식 error → `error` 핸들러가 자동으로 baby-tracker 이탈하던 것이 원인.
- **수정(OTA, JS-only)** `app/voice.tsx`:
  - 첫 입력(텍스트≥2) 전에는 **자동 종료 금지** — error/무음 end 시 baby-tracker 이탈 대신 **재시작(듣기 유지)**, 최대 15회.
  - 실제 입력 들어오면 재시작 카운터 리셋. 상단 "완료" 버튼으로만 수동 이탈.
  - **Siri 진입 시 시작 지연 800ms**(오디오 세션 settle). restartCountRef 추가.
  - 배포: update group **2235784a-3873-4063-b2cf-20a6cbeeee72** (runtime 2.9.1).

### ✅ OTA v5 배포 (2026-06-03) — 앨범 "사진 선택" 그리드 취소버튼 (실제 화면)
- v4 로 PhotoLogReview(사진기록)는 고쳐졌으나 앨범은 그대로 → "여러 장 추가" 플로우의 **첫 화면이 RecentPhotosGrid("사진 선택" 그리드)**
  였고, BatchPhotoReview(확인화면)가 아니었음. 즉 그동안 잘못된 컴포넌트를 고침.
- `components/album/RecentPhotosGrid.tsx` — container 에 고정 상단 패딩(`iOS 60 / Android StatusBar.currentHeight`) 추가. Platform/StatusBar import.
- 사전 스캔: 추가 전체화면 slide 모달 후보 = `components/pregnancy/HospitalRegisterModal.tsx`(임신부 전용) 1건만 → 미적용(추후 점검).
- 배포: update group **bae36fd3-7ff2-4314-ab71-07e34c5aa268** (runtime 2.9.1, android+ios).

### ✅ OTA v4 배포 (2026-06-03) — 모달 취소버튼 최종 수정
- v3 에서 광고는 해결(Test Ad 확인). 그러나 모달 취소버튼은 SafeAreaProvider+SafeAreaView 로도 실패 →
  **New Architecture(Fabric)에서 RN Modal 내 safe-area-context 측정이 깨지는 알려진 버그**로 확정.
- 측정 의존 전면 포기 → **고정 상단 패딩** `Platform.OS==='ios' ? 60 : (StatusBar.currentHeight ?? 24)`.
  iOS 60pt 가 노치(~47)·다이내믹아일랜드(~59) 모두 덮음. 측정/Provider 무의존이라 적용 시 확정 동작.
  PhotoLogReview/BatchPhotoReview 둘 다. safe-area-context import 제거, Platform/StatusBar 사용.
- 배포: update group **b2215482-ee82-4196-857b-e35b112160bc** (runtime 2.9.1, android+ios).

### ✅ OTA v3 배포 (2026-06-03) — v2 잔여 2건(광고·모달취소) 재수정
- v2 적용됨(자녀등록 뒤로 동작 확인=headerLeft v2). 그러나 광고·모달취소 여전히 실패. 원인·재수정:
  - **광고**: `.env` 만 고치면 AdSlot.tsx(미변경)가 **Metro 변환 캐시**의 옛 `ADS_MOCK=true` 인라인값 재사용 →
    `eas update --clear-cache` 로 강제 재변환(=.env false 새로 박힘). (.env 외 override 파일 없음 확인)
  - **모달 취소버튼**: `useSafeAreaInsets()` 는 RN Modal 내부에서 0, `initialWindowMetrics` 는 New Arch 에서 null →
    **모달 내부에 `SafeAreaProvider` + `SafeAreaView edges={['top']}`** (라이브러리 공식 권장). PhotoLogReview/BatchPhotoReview 둘 다.
    부수: 두 파일 Platform/insets/initialWindowMetrics import 정리.
- 배포: update group **5c934473-a9ef-463f-82b9-1e4accd84f60** (runtime 2.9.1, android+ios, --clear-cache).

### ✅ OTA v2 배포 (2026-06-03) — v1 회귀 3건 재수정
- v1(bdd5d069)은 적용됐으나 3건이 잘못 고쳐짐(광고 회색박스/자녀등록 뒤로X/모달취소 위쪽). 원인·재수정:
  - **광고**: 인라인 `$env:` 오버라이드가 `.env`에 밀림(Expo가 .env 우선) → `.env` 직접 `ADS_MOCK=false`+구글 테스트 배너ID 추가.
  - **자녀등록 뒤로**: child-info 가 onboarding 스택 첫 화면이라 네이티브 자동 뒤로버튼 미표시 →
    `Stack.Screen.headerLeft` 에 `router.back()` 버튼 명시 강제.
  - **모달 취소버튼**: RN Modal 내 `useSafeAreaInsets().top`=0 + 44pt 폴백이 Dynamic Island(~59pt)에 부족 →
    `initialWindowMetrics?.insets?.top`(앱 시작 시 네이티브 측정값, 모달 무관 신뢰) 사용. PhotoLogReview/BatchPhotoReview 둘 다.
- 배포: update group **381a4fb5-bb7e-416f-bc48-f1c10997db36** (runtime 2.9.1, android+ios).
- ※ `.env` ADS_MOCK=false 로 변경됨 → 로컬 Expo Go 개발 시 광고 "모듈 미로딩" 박스(무해). 출시 땐 eas.json production(실제ID) 사용.

### ✅ OTA 배포 완료 (2026-06-03)
- 5건 수정(home, profile, child-info, PhotoLogReview, BatchPhotoReview) + app.json platforms + 테스트광고 env 인라인.
- `eas update --branch production` (runtime 2.9.1, android+ios). Update group: bdd5d069-852a-495b-87a8-228f0376b99c.
- 테스트광고 env: `EXPO_PUBLIC_ADS_MOCK=false` + 구글 테스트 배너ID(android 6300978111/ios 2934735716) 인라인 오버라이드.
- 배포 후 폰 2회 재실행(다운로드→적용) 후 확인:
  홈 터치 / 마이 비번모달 / 자녀등록 뒤로 / 사진기록·앨범일괄 취소버튼 / iOS 'Test Ad' 배너.
- 근본 후속: eas update용 production env를 EAS 호스팅(env)으로 이전(매번 인라인 오버라이드 불편 해소).

---

## 2026-06-02 출시 준비 세션 (가이드·음성·가족피드 + Sentry 보강 + 백엔드 배포)

### 1) 사진/앨범/시작속도 (프론트, OTA preview)
- `components/album/RecentPhotosGrid.tsx` — 얼굴분석 가속(`accurate→fast`, 리사이즈 900→560, minFaceSize 0.04→0.12, 동시 5→6) + **분석 중 취소** 버튼(cancelAnalysisRef)
- `app/splash.tsx` — 스플래시 연출 ~3.7초 → ~2.05초 단축(대기/타이밍 압축)
- `app/(main)/album.tsx` — 앨범 PDF OOM 대응: 장수 따라 적응형 화질(`pdfMaxW`), 상한 200장

### 2) 아기시간 첫 진입 가이드 (신규)
- **신규** `components/baby-tracker/BabyTrackerGuide.tsx` — 코드 목업형 5페이지 캐러셀(캡처 불필요).
  탭소개/원터치(길게=수정·직접입력)/음성입력(앱·홈 아이콘)/알림장 실물형→AI정리/주간요약+AI인사이트.
  페이지 높이 통일(고정 프레임), 세련된 팔레트, `onComplete`(시작하기) 분리.
- `app/(main)/baby-tracker.tsx` — 첫 진입 1회 자동표시(`BABY_GUIDE_SHOWN_KEY`) + 헤더 `?` 재열람,
  **가이드 완료 직후 홈 음성아이콘 핀 프롬프트**(`promptVoicePinOnce`, 안드로이드, 1회).

### 3) 인앱 음성입력 + 칩 레이아웃
- `app/(main)/baby-tracker.tsx` — 🎤 **인앱 음성입력 버튼**(액센트) → `/voice`(iOS 포함 전 기기).
  칩을 날짜 아래 별도 줄로 분리(`chipRow`, 가운데 정렬) → 날짜 가림 해결, 날짜 화살표 근접(dateNav center).
  **분유값설정 칩 제거**(음성설정과 중복).
- 기존 음성 단축 인프라 확인: 정적 단축어 + `modules/shortcut-pin`(홈 핀, 음성설정에서 호출) 이미 존재.

### 4) 가족피드 빈 카드 버그 수정 (P1)
- 원인: 가족피드 공유 시 이미지 업로드 실패하면 **로컬 URI(`content://`)로 게시** → 재시작/타기기서 빈 카드.
- `app/(main)/album.tsx` — 단일/배치 공유 둘 다 **유효 https 클라우드 URL 없으면 게시 금지** + 실패 안내. 배치는 step1 클라우드 URL 재사용.
- `services/api.ts` — `uploadApi.upload`에 **지수 백오프 재시도 3회**(일시적 네트워크/5xx 흡수) — 앱 전체 업로드 안정화.

### 5) Sentry 트리아지 + 백엔드 보강·배포
- 18건 트리아지 결과: **인증(jwtid/audience/TOKEN_ENCRYPTION_KEY)·IAP raw.state·mom-group 인덱스는 현재 코드에서 이미 수정 확인**(옛날 에러). ExpoUpdates/navigate-before-mount/AI fallback은 무해.
- 보강 3개: `payment.ts` `sanitizeAppleRaw` undefined 제거 / `forbidden.filter.ts` 금지어 로그 error→warn / `firestore.indexes.json` momGroupPosts `hidden+babyBirthYear+category+lat` 인덱스 추가.
- 커밋 `1b06ac7`(backend 미배포 누적분 일괄) → **firebase deploy 완료**: firestore:indexes ✅, functions ✅(api/coachingApi/dormantUserSweep/trialEndingSweep/neighborGroupNudge/keepWarm).

### 검증
- backend tsc ✅0 / frontend tsc ✅0 / expo lint ✅0 errors / backend build ✅ / firebase deploy ✅

### 남은 이슈 / 출시 전 확인
- 🔴 **AdMob 프로덕션 미완성**: eas.json 광고 unit ID가 구글 **테스트 ID**(`...3940256099942544...`), AdMob **App ID 미설정**(`react-native-google-mobile-ads` 플러그인 app.json에 없음). 수익화하려면 실제 App ID+unit ID 발급 후 플러그인/eas.json 반영 + **네이티브 리빌드**. (출시 블로커 아님 — 광고 끄고 출시 후 업데이트 가능)
- 🟠 **OTA env 불일치**: `frontend/.env` `EXPO_PUBLIC_ADS_MOCK=true` → `eas update`(OTA)는 mock, `eas build production`은 eas.json(false). 프로덕션 OTA 시 .env 누수 주의.
- 🟠 **versionCode 수동**(`appVersionSource: local`): 현재 android 5 / ios 4. 새 빌드마다 증가 필요.
- ⚠️ `SENTRY_DSN_BACKEND` 미설정 → 백엔드 자체 에러 추적 꺼짐(현재 클라이언트가 API 실패만 포착). 선택사항.
- 출시 경로: 안드 법인계정(12명/14일 면제) → 내부테스트 → 프로덕션 승격(단계적 롤아웃) + 테스터 모집. iOS는 애플 계정 승인 후 TestFlight+심사 병행.

---

## 2026-05-30 동네 또래맘 커뮤니티 유도 푸시 (맘그룹 참여 유도)

### 목적
- 빌리 앱처럼 "우리 동네 N개월 또래맘들과 소통해요" 형태의 맘그룹(맘스톡) 참여 유도 푸시 신설
- 제품 결정: 또래 표현=개월수, 동네 범위=지역명(구 단위), 발송 빈도=주 2회

### 수정/추가 파일
- **신규** `backend/src/utils/neighborGroupSweep.ts`
  - `runNeighborGroupSweep()` — 위치(locationLabel) 등록 사용자 타깃팅 → Expo 푸시
  - 타깃: `users.orderBy('locationUpdatedAt')` 로 위치 보유자 필터(단일필드, 인덱스 불필요)
  - 자녀 개월수: 소유 자녀 중 출생일 있는 비임신 아이, babyBirthYear 매칭 우선 → `calculateAge`/`formatAgeKo`
  - 지역명: `extractDistrict()` 로 locationLabel 에서 구/군/시 추출 (예: "광산구 신창동"→"광산구")
  - 토큰: pushSchedules(userId) 의 ExponentPushToken 수집
  - 멱등성: `users.lastNeighborPushAt` 가드(최근 2일 내 발송 skip) — 기존 dormantUserSweep 패턴 그대로
- `backend/src/index.ts` — `neighborGroupNudge` onSchedule 추가 (`0 19 * * 2,5` = 화·금 19시 KST, 주 2회)
- `frontend/app/_layout.tsx` — ALLOWED_PUSH_SCREENS 화이트리스트에 `'mom-group'` 추가 (탭 시 맘그룹 이동)

### 스키마 변경 (사용자 승인)
- `users.lastNeighborPushAt` (Timestamp) 필드 1개 추가 — 중복 발송 가드. 새 컬렉션 없음.

### 검증
- backend tsc ✅ 0 / frontend tsc ✅ 0 / expo lint ✅ 0 errors
- 실서버 발송 테스트는 미실행 (실사용자에게 실제 푸시가 가므로) — 배포 후 Functions 로그로 검증 예정

### 남은 이슈 / 배포 필요
- ⚠️ 아직 미배포: `cd backend && npm run deploy` (firebase deploy --only functions) 해야 스케줄 활성화
- 메시지 문구("…또래맘 모임 💬")는 A/B 또는 카피 조정 여지 있음

---

## 2026-05-27 (저녁) 추가 작업

### 1. voice-parse sleep cross-day 회귀 fix
- 증상: "어제 9시 자고 오늘 7시 일어났고 7시반 분유 8시 똥쌌어" → feeding/diaper 만 저장, sleep 누락
- 원인: 시스템 프롬프트에 "일어났어" 매핑 없음 + 흡수 룰이 다중 예시 괄호에만 명시 → Gemini 가 sleep record 자체를 drop
- 수정 (`backend/src/routes/tracker.ts`):
  - 시스템 프롬프트 sleep 섹션에 흡수 룰 4줄 격상 ("일어났어/깼어" 단독 → 별도 record 금지, 직전 sleep endTime 흡수)
  - cross-day 명시 예시 추가
  - 다중사건 예시 2 추가 (사용자 보고 케이스 그대로)
  - ★ Fallback 안전망: raw text 에 sleep+wake 키워드 둘 다 있는데 sleep record 누락 시 정규식으로 시작/종료 시각 추출해 강제 주입

### 2. 답변 길이/톤 단축
- `backend/src/services/coaching/prompt.builder.ts` 영유아 + 임산부 양쪽 [길이와 톤] 강화
  - "사용자 입력 반복 절대 금지" 룰 신설 (X/O 예시 포함)
  - "공감 반복 금지, 진짜 인사이트 한 줄"
  - 전체 200~400자 권장
  - "조금은/것 같아요/~시군요" 군더더기 어미 금지
- `backend/src/services/coaching/types.ts` maxOutputTokens 유지 (free 900 / paid 1200)
  - 1차 시도 (500/700) 는 너무 빡빡해서 truncation 위험 → 원복

### 3. context caching 모니터링 로깅
- `backend/src/services/coaching/gemini.client.ts`
  - `GeminiResponse` 인터페이스에 `usageMetadata` 추가
  - 매 호출 후 `gemini/usage prompt=N cached=N (P%) output=N` 로깅
  - Gemini 2.5 implicit cache hit ratio 측정 (코드 변경 0, 자동 동작)

### 4. 검증 + 배포
- backend `npx tsc --noEmit` → 0 에러
- `npm run deploy` → api/coachingApi/keepWarm/dormantUserSweep/trialEndingSweep 5개 함수 업데이트 완료
- Function URL: https://api-usglfifguq-uc.a.run.app

### 4-10. timezone 일괄 fix — 식단 + 일기 + child-card (11차 OTA)
- 증상: 식단 카드 시각 안 맞음 + 잠재 버그 (album/pregnancy 일기 기본 날짜, child-card 발급/만료 날짜) 새벽 시간대 어제 표시 가능
- 원인: `toISOString().slice(0,10/11,16)` UTC 그대로 잘라 쓰는 패턴 다수
- 수정:
  - `frontend/app/(main)/gdm.tsx:629` 식단 eatenAt 시각 → KST toLocaleTimeString + 🕐
  - `frontend/app/(main)/album.tsx:1240,1682` diaryDate 기본값 → KST sv-SE slice
  - `frontend/app/(main)/pregnancy.tsx:671` diaryDate 기본값 → KST sv-SE slice
  - `frontend/app/(main)/child-card.tsx:94~106` toKstYmd 헬퍼 신설 + birth/issue/expiry KST 일괄
- 패턴: `new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)` (sv-SE = ISO 친화 YYYY-MM-DD)
- 잠재 추가 점검 후보: mom-wellness.tsx:157 storage key 일관성 (저장/읽기 같은 패턴이면 OK)
- OTA preview 배포 (Android 019e6a15, iOS 019e6a17)

### 4-9. 임당 혈당 기록 측정 시각 KST 변환 (10차 OTA)
- 증상: 사용자 폰 시각 12:13에 기록했는데 화면 "15:13" 표시 — 시간 안 맞음
- 원인: 백엔드 `pregnancy.ts:1336` `new Date().toISOString()` UTC 저장. 프론트 `.slice(11, 16)` UTC 시간 그대로 잘라서 표시 (timezone 변환 X)
- 수정 (`frontend/app/(main)/gdm.tsx:575`):
  - `new Date(measuredAt).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Seoul' })`
  - 🕐 시계 아이콘 추가 (사용자 요청)
- OTA preview 배포 (Android 019e6a0c, iOS 019e6a0e)

### 4-8. 임당관리 UI 가독성 + 입력 접근성 fix (9차 OTA)
- 증상 1: 상단 탭 "🩸 혈당", "🍚 식단" 텍스트가 잘 안 보임 (옅은 색 + 작은 폰트)
- 증상 2: FAB(+) 버튼이 광고 배너에 가려 잘 안 보임
- 수정 (`frontend/app/(main)/gdm.tsx`):
  - tabText 색상 #5D4037, 폰트 FONT_SIZE.md, weight 700 / Active 800
  - AI 분석 버튼 바로 아래 인라인 입력 버튼 추가 ("＋ 혈당/식단 기록 추가")
  - inlineAddBtn 스타일: 흰 배경 + 핑크 테두리 2px + 강조 텍스트
  - FAB 는 그대로 유지 (양쪽 접근)
- OTA preview 배포 (Android 019e6a03, iOS 019e6a05)

### 4-7. 음성 조기 종료 fix — 말 중간 숨고르기 자동종료 (8차 OTA)
- 증상: 말하고 있는데 중간에 입력 끝남 (말 다 못 하고 process 됨)
- 원인:
  - expo-speech-recognition start 옵션이 기본값 → 무음 ~500ms 에 isFinal 떨어뜨림
  - voice.tsx result 핸들러가 isFinal && len ≥ 2 면 즉시 processVoice
  - 말 중간 숨고르기(2~3음절 쉼) 도중 isFinal 가 떨어져 early termination
- 수정 (`frontend/app/voice.tsx`):
  - start 옵션 `continuous: true` + Android intent options 추가:
    - EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 3000
    - EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2500
    - EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 5000
  - 디바운스 도입 (SILENCE_DEBOUNCE_MS = 2000):
    - debounceTimerRef 추가
    - result 이벤트마다 timer reset
    - 2초 동안 새 result 안 오면 그때 processVoice + STT stop
  - end 이벤트는 백업 (디바운스 진행 중이면 skip)
  - unmount cleanup 에 timer clear 추가
- OTA preview 배포 (Android 019e69f5, iOS 019e69f8)

### 4-6. cross-day sleep "기록 됐다가 지워짐" 진짜 원인 fix (7차 배포)
- 증상: "어제 9시 잤고 오늘 7시 깼어" → 화면에 기록됨 표시 → baby-tracker 진입 시 사라짐
- 원인: 백엔드 `babyTracker.ts:36` `TrackerRecordSchema.endTime` regex 가 `^\d{2}:\d{2}$` 만 허용. 프론트 voice.tsx 가 cross-day sleep 일 때 endTime 에 "M/D HH:MM" prefix 붙여서 보냄 → Zod validation 실패 → putDay 400 → 서버 저장 실패 → baby-tracker reload 시 서버 빈 데이터로 로컬 덮어쓰기 → 사라짐
- 수정 (`backend/src/routes/babyTracker.ts`):
  - END_TIME_RE 신설: `/^(\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s\d{2}:\d{2})$/`
  - 기존 HH:MM + 새 M/D HH:MM 둘 다 허용
- 재배포 완료

### 4-5. voice 화면 "먼저 아이를 등록해주세요" 회귀 fix (6차 OTA)
- 증상: 4-4 OTA 후에도 voice 단축 아이콘 진입 시 "먼저 아이를 등록해주세요" 표시
- 원인: childStore 가 persist 없음. 메모리만 보관. home 만 setChildren 호출 → 단축 아이콘으로 home 안 거치고 직접 voice 진입 시 store children 빈 채로 시작
- 수정 (`frontend/app/voice.tsx`):
  - childApi import 추가
  - fallback 우선순위 재구성:
    1) store children 비어있으면 childApi.list() 자체 fetch + setChildren
    2) 그래도 storeSelectedChild 없으면 children[0] 자동 선택
    3) 진짜 0명일 때만 "먼저 아이를 등록해주세요"
- OTA preview 배포 완료 (Android 019e69e3, iOS 019e69e5)

### 4-4. voice 화면 "아이를 선택해주세요" 회귀 fix (OTA 배포)
- 증상: 음성 발화 시 모두 "아이를 선택해주세요" 표시 + home 으로 강제 리다이렉트
- 원인: `useChildStore.getState().selectedChild` 가 null 인 상태로 voice 진입 시 fallback 부재
- 수정 (`frontend/app/voice.tsx`):
  - targetChildId 없을 때 등록된 children[0] 으로 자동 선택 후 진행
  - 등록 아이 0명일 때만 "먼저 아이를 등록해주세요" 안내
- OTA preview 배포 완료 (Android update 019e69da, iOS 019e69dd)

### 4-3. sleep record 중복 dedupe (4차 배포)
- 증상: "어제밤 9시 잤다가 오늘아침 7시 깼어" → 어제 21:00 sleep record 2개 생성
- 원인 후보: Gemini hallucination (같은 사건 2번 출력) 또는 이전 테스트 잔여 누적
- 수정 (`backend/src/routes/tracker.ts`):
  - normalized 단계 직후 dedupe Map 추가
  - key = `date|type|subType|time` 동일하면 중복으로 간주
  - 더 정보 많은 쪽 (endTime/amount/duration 있는 쪽) 우선 유지
- 재배포 완료

### 4-2. sleep endTime 누락 회귀 fix (3차 배포)
- 증상: "어제밤 9시에 잤다가 오늘아침 7시 깼어" → sleep record 어제 21:00 startTime 은 저장됐는데 endTime 누락 → baby-tracker 오늘 view 가상 기상 entry 생성 안 됨
- 원인 1: Gemini 가 sleep record 만들었으나 endTime 빠뜨림
- 원인 2: hasSleepKeyword 정규식에 "잤다가" 미포함 → fallback 조건 매칭 X
- 수정 (`backend/src/routes/tracker.ts`):
  - hasSleepKeyword 에 "잤다" 추가
  - Fallback 2-A 신설: sleep record 있는데 endTime 빈 경우 → text 마지막 시각 추출해 endTime backfill + duration 자동 계산
  - 시각 없으면 기본값 07:00 채움
  - 프롬프트 강조: "endTime 반드시 채워. 절대 비우지 마"
- 재배포 완료

### 4-1. 시간 없는 sleep cross-day 추가 강화 (2차 배포)
- 증상: "어제 자고 오늘 깼어" 시간 명시 없으면 fallback 정규식 미동작 → sleep record 누락
- 수정 (`backend/src/routes/tracker.ts`):
  - 시스템 프롬프트에 룰 추가: "시간 명시 없는 짧은 발화도 sleep record 만들어. time/endTime null 로 둬"
  - Fallback 안전망 확장: timeMatches.length < 2 인 경우 기본값 21:00~07:00 (10h) 자동 주입
- 재배포 완료

### 5. 남은 확인 사항
- 사용자 음성 테스트: "어제 9시 자고 오늘 7시 일어났고 7시반 분유 먹고 8시 똥쌌어" → 4개 record 정상 저장 확인 필요
- 챗봇 답변 길이/톤 실제 변화 확인 필요
- 며칠 후 Firebase Functions logs 에서 `gemini/usage` 검색해 cache hit ratio 확인

---

## 2026-05-27 작업 기록

### 1. 광고 (AdMob) 활성화 + 위치 재배치

#### 1-1. native 광고 실제 활성화
- `react-native-google-mobile-ads` v16.3.3 native 모듈 빌드 포함
- `AdSlot.tsx`: mobileAds.initialize() 호출 (이전 누락 → 광고 안 뜨던 버그)
- `AdSlot.tsx`: minHeight 50pt + 미설정 진단 라벨 ("광고 unit ID 미설정" / "광고 모듈 미로딩 (APK 재설치 필요)")
- EAS preview env 갱신:
  - `EXPO_PUBLIC_ADS_ENABLED=true`
  - `EXPO_PUBLIC_ADS_MOCK=false`
  - `EXPO_PUBLIC_ADMOB_BANNER_ANDROID=ca-app-pub-3940256099942544/6300978111` (Google 테스트 ID)
  - `EXPO_PUBLIC_ADMOB_BANNER_IOS=ca-app-pub-3940256099942544/2934735716`
- `eas.json` preview env 동일하게 업데이트

#### 1-2. AdSlot variant 추가 (300×250 MEDIUM_RECTANGLE)
- `AdSlot.tsx`: `variant: 'banner' | 'medium'` prop 추가
- 'medium' → MEDIUM_RECTANGLE 300×250 사각형 (배너 대비 CPM 3~5배)
- 적용처: `voice.tsx` (음성 인식 화면 — 빈 공간 활용 + 무음 광고)

#### 1-3. 광고 위치 재배치
| 화면 | 광고 |
|---|---|
| 홈 | ✓ banner |
| **마이탭 (신규)** | ✓ banner |
| **음성기록 (신규, 300×250)** | ✓ medium |
| 아기시간 메인 | ✗ 제거 (이탈 방지) |
| **아기시간 → 기간 요약 펼침 (이동)** | ✓ banner |
| 아기시간 시간 피커 모달 | ✗ 제거 (잘못된 위치였음) |
| 응급/결제/음성 입력 중 | ✗ |
- `profile.tsx`: AdSlot import + ProfileFooter 아래 추가
- `voice.tsx`: AdSlot variant="medium" + 마이크/말씀하세요 paddingTop:80 으로 상단 정렬
- `baby-tracker.tsx`: 메인 하단 고정 AdSlot 제거 + 기간 요약 섹션 내부로 이동

---

### 2. 홈 화면 단축 아이콘 (Pin Shortcut Native Module)

#### 2-1. 로컬 Expo Native Module 신설
- 신규 디렉토리: `frontend/modules/shortcut-pin/`
  - `expo-module.config.json` (Android: `expo.modules.shortcutpin.ShortcutPinModule`)
  - `package.json` (`name: "shortcut-pin"`, `main: "src/index.ts"`)
  - `android/build.gradle` (useExpoModulesCorePlugin + useExpoPublishing)
  - `android/src/main/AndroidManifest.xml`
  - `android/src/main/java/expo/modules/shortcutpin/ShortcutPinModule.kt`
    - `Name("ShortcutPin")` 등록
    - `isSupported()` — ShortcutManager.isRequestPinShortcutSupported
    - `requestPinVoiceShortcut()` — Intent ACTION_VIEW + `amatda://voice` deep link
  - `src/index.ts` — JS 래퍼, dynamic `requireNativeModule`
- `frontend/package.json`: `expo.autolinking.nativeModulesDir: "./modules"`

#### 2-2. .gitignore 예외 추가 (핵심 버그)
- 원인: 루트 `.gitignore`에 `android/` 패턴 — 로컬 Expo 모듈의 android/ 폴더까지 제외
- EAS Cloud build 시 Kotlin 파일 미포함 → APK에 native 모듈 없음 → "APK 재설치 필요" alert
- 수정: `.gitignore`에 `!frontend/modules/*/android/` + `!frontend/modules/*/android/**` 예외 추가
- 3개 android 파일 git 포함

#### 2-3. voice-settings.tsx UI
- Section 3.5 "안드로이드에서 음성 기록 호출" 카드 신설:
  - 방법 ① 앱 아이콘 길게 누르기
  - 방법 ② "＋ 홈 화면에 추가" 버튼 → `requestPinVoiceShortcut()`
- 진단 alert 5종 — `시스템 다이얼로그 호출됨` / `미지원 런처` / `미지원 OS` / `APK 재설치 필요` / `실패 (사유)`
- `pinSupported` 비활성 gate 제거 (런처 false 보고 우회) — 버튼 항상 클릭 가능

---

### 3. 음성 인식 (voice-parse) 대폭 개선

#### 3-1. 다중 사건 입력 지원
- 백엔드 `tracker.ts` 응답: `{ records: ParsedRecord[] }` 형식 (이전: 단일 객체)
- 프롬프트 재작성: "여러 사건이면 records 배열에 담아"
- 예: "어제 9시에 자고 오늘 9시에 일어났고 9시반에 분유 120 먹고 10시에 똥싸고 12시에 낮잠자고 1시에 일어났어"
  → 4개 record (수면 → 분유 → 대변 → 수면)
- 프론트 `voice.tsx`: 백워드 호환 (단일/배열 둘 다 처리) + 날짜별 그룹화 saveRecords 일괄

#### 3-2. 상대 날짜 해석 (어제/오늘/그저께/내일)
- API 요청에 `clientDate` (YYYY-MM-DD) 추가
- 프롬프트가 어제/그저께/내일 → 정확한 YYYY-MM-DD 매핑
- 어제 시작 + 오늘 종료 sleep → 단일 record `date=어제, time=21:00, endTime=09:00`

#### 3-3. Cross-day sleep endTime 정규화 (사용자 보고 버그)
- 음성 sleep에서 endMin < startMin (자정 넘김) 감지
- endTime을 "M/D HH:MM" 형식으로 자동 변환 (예: "09:00" → "5/27 09:00")
- baby-tracker가 cross-day 가상 기상 entry로 다음날 view에 표시

#### 3-4. medication 지원
- type='medication' subType: fever/antibiotic/vitamin/other
- 프롬프트: 해열제/타이레놀/항생제/비타민/D3/감기약 등 인식

#### 3-5. 모유 좌/우 + 자동 추천
- 프롬프트: "왼쪽/좌측/left" / "오른쪽/우측/right" → note 정규화
- voice.tsx: note 없으면 같은 날 마지막 모유 반대쪽으로 자동 채움 (multi-event 내 연속도 처리)

#### 3-6. endTime 범위 발화 + duration 자동
- "10시부터 11시까지 잤어" → time=10:00, endTime=11:00, duration=60
- 백엔드 자동 산출 (자정 넘김 +24h 처리)

#### 3-7. 수면 subType 통합 (옛 버그 수정)
- 백엔드 + 프론트: nap/night → 'sleep' 정규화 (앱이 낮잠/밤잠 구분 안 함)
- voice-settings: "낮잠/밤잠 기본 시간" → "수면 기본 시간" 단일 입력

#### 3-8. 서버 동기화 누락 버그 수정
- 이전: voice.tsx가 raw AsyncStorage 직접 사용 → 서버 미전송, home 미갱신
- 수정: `saveRecords()` 경유 → 자동 `putDay` 서버 sync + `useTrackerStore.bump()` 호출

---

### 4. 음성설정 (voice-settings) 가이드 2026 현행화

- iOS Siri 카드 — Platform.OS gate 제거 (Android에서도 참고용 표시)
- 안드로이드 음성 비서 안내 카드 — 직접 호출 불가 사유 정직하게 명시:
  - 빅스비 "빠른 명령어" 2024.12 삭제, S25+/One UI 7부터 새 빅스비(Perplexity)
  - Google Assistant → Gemini 전환 2026, 한국어 빌드 "맞춤 작업" 메뉴 사라짐
  - 한국어 앱 이름 인식 약함
- 결론: 작동하는 방법은 ① 앱 아이콘 길게 + ② 홈 단축 아이콘 두 가지뿐 명시

---

### 5. 앨범 (성장앨범) 마일스톤 이미지 깨짐 수정

#### 5-1. PDF "추억" placeholder X 박스 수정
- 원인: 사용자가 마일스톤 미선택 시 백엔드 `title='추억'` fallback (저장 시)
- PDF 생성 시 `milestone-image?label=추억` 호출 → 404 → broken X 박스
- 수정 1: `uriToDataUri` HTTP 상태 체크 — 200 아니면 throw → fallback emoji 렌더
- 수정 2: `0m-추억.png` PNG 추가 (`frontend/assets/milestone-heart.png` 복사) → 서버가 응답
- 수정 3: `getMilestoneImageBuffer` 3차 fallback — 매칭 안 되는 모든 라벨 → 추억 PNG 반환 (미래 라벨도 X 박스 안 뜸)

#### 5-2. 임신앨범 ♥ → 마일스톤별 이모지 배지
- 이전: 모든 임신 마일스톤이 `&#10084;` (♥) 하나만 표시
- 수정: `PregAlbumPhoto`에 `milestoneEmoji`/`milestoneType` 필드 추가
- `ALL_MILESTONES` lookup으로 emoji 복원 (이전 저장 데이터에 emoji 없어도)
- HTML: `<div class="ms-icon-badge">{emoji}</div>` — 분홍 원형 배지
- 20개 임신 마일스톤 각각 고유 이모지 (💊 🏥 📸 💓 🧪 🦶 등)

---

### 6. 아기시간 (baby-tracker) 추가 개선

#### 6-1. 모유 수유 진행 중 배너
- 실시간 ml 추정 표시 + 계산식 + 면책 문구
  - "예상 수유량: 약 N ml"
  - "계산: 경과 시간 × 분당 Nml (X개월 기준)"
  - "ⓘ 의료 자료 기반 추정치예요. 실제 양은 아기/엄마/시간대에 따라 달라요."
- breastStyles에 estimateText / estimateHint / estimateNote 스타일 추가

#### 6-2. 타임라인 모유 항목에 추정 ml 표시
- `TimelineEntryProps` + `HourGroupedTimelineProps`에 ageMonths 전달
- 모유 entry에 `formatMinutes(duration) · 약 Nml (추정)` 표시
- 요약 표(주/월)와 동일한 연령별 ml/분 계수 사용

---

### 7. EAS Build + 배포 이력 (오늘)

#### APK 빌드 (preview)
- 빌드 #1: `a194c0a4-c534-4615-9a1f-f26b150434f9` (FINISHED, native shortcut-pin 미포함 — .gitignore 버그)
- 빌드 #2: `2c4899f7-437a-4345-a6f7-96e2d56dc666` (FINISHED, 동일 — 재확인 필요)
- 빌드 #3: `2d02d827-9b58-4da3-8fc3-f1bbb37134df` (FINISHED, .gitignore 수정 후 — native 모듈 정상 포함, 사용자 확인 대기)

#### OTA (preview branch)
- 광고 mobileAds.initialize + 진단 라벨
- iOS Siri 카드 + pin shortcut 진단 alert
- 광고 위치 재배치 (마이/voice/baby-tracker 기간요약)
- voice MEDIUM_RECTANGLE 300×250
- 앨범 추억 PNG + 미지 라벨 fallback
- 음성 다중 사건 + 어제/오늘 상대 날짜
- 임신앨범 마일스톤 이모지 배지
- cross-day sleep endTime 정규화

#### 백엔드 배포 (firebase functions)
- `tracker.ts` voice-parse 다중 사건 + medication + 모유 좌/우 + endTime 범위
- `album.ts` placeholder filter + uriToDataUri 호환
- `album.pdf.service.ts` getMilestoneImageBuffer 3차 fallback
- 신규 asset: `backend/src/assets/milestones-sm/0m-추억.png`

---

### 8. 검증 결과 (오늘 종료 시점)

- frontend `npx tsc --noEmit` → **0 에러**
- backend `npx tsc --noEmit` → **0 에러**
- frontend `npx expo lint` → 0 에러 (warnings only — 신규 코드에서 추가된 것 없음)
- APK 빌드 #3 → FINISHED, 사용자 검증 대기 (홈 단축 아이콘 native 작동 확인)

### 신규/수정 파일 요약 (오늘)

**Frontend**:
- `app/voice.tsx` — 다중 사건 record 일괄 저장, cross-day sleep prefix, AdSlot 추가, saveRecords 경유
- `app/(main)/voice-settings.tsx` — iOS/Android 분리, pin shortcut 버튼, 진단 alert
- `app/(main)/baby-tracker.tsx` — 모유 ml 추정 (배너/타임라인), 광고 위치 이동
- `app/(main)/profile.tsx` — AdSlot 추가
- `app/(main)/album.tsx` — 추억 placeholder 정규화, uriToDataUri 상태 체크
- `app/(main)/pregnancy.tsx` — 마일스톤 이모지 배지
- `components/ads/AdSlot.tsx` — variant prop (banner/medium), initialize, 진단 라벨, minHeight
- `services/api.ts` — voiceParse에 clientDate 추가
- `features/baby-tracker/utils/summary.ts` — 연령별 모유 ml/분 추정
- `features/baby-tracker/types.ts` — DayStat 분유/모유 분리
- `features/baby-tracker/storage.ts` — loadRangeStats에 ageMonths 인자
- `eas.json` — preview env ADMOB 추가
- `package.json` — expo.autolinking.nativeModulesDir

**Frontend (신규)**:
- `modules/shortcut-pin/` — 전체 디렉토리 (6 files)
- `modules/shortcut-pin/android/` — Kotlin native module

**Backend**:
- `src/routes/tracker.ts` — voice-parse 다중사건 + clientDate + medication + 모유 좌/우
- `src/routes/album.ts` — milestone 매핑 단순화
- `src/services/album.pdf.service.ts` — getMilestoneImageBuffer 3차 fallback

**Backend (신규)**:
- `src/assets/milestones-sm/0m-추억.png` — 기본 마일스톤 placeholder

**Root**:
- `.gitignore` — `!frontend/modules/*/android/**` 예외

### 남은 이슈 / 다음 작업

1. **APK 빌드 #3 사용자 검증 대기** — 홈 단축 아이콘 native 작동 확인 ("APK 재설치 필요" alert 사라지고 시스템 다이얼로그 뜨면 성공)
2. **실제 AdMob 계정 + Production unit ID 발급** — 출시 직전 교체 (현재 Google 테스트 ID)
3. **음성 발화 long input 테스트** — 5건 이상 사건 정확도 확인
4. **임신앨범 마일스톤 이모지 — PDF 폰트 fallback** — 이모지 미지원 폰트면 □ 표시 가능
5. **0m-추억.png 디자인 개선** — 현재 milestone-heart.png 복사본, 출시 전 전용 디자인

---

## 2026-05-25 — 출시 전 종합 점검 (P0/P1/P2 + 결제 + UX + 정책)

---

## 2026-05-25 — 출시 전 종합 점검 (오후 작업)

### 1. 결제 흐름 정상화 (Google Play IAP)
- **expo-iap 4.x API** 적용 (`requestPurchase({request:{apple,google},type:'subs'}`)
- **ensureIAPInitialized** lazy init — `Billing client not ready` 에러 방지
- **sanitizeGoogleRaw V2** — undefined 필드 Firestore 거부 fix
- **이중 결제 방지** — frontend `subscription.tsx` `status.tier === 'PAID'` 시 Play 정기결제 페이지 안내 + backend `/iap/verify` 409 안전망
- **환불 시 즉시 권한 회수** — webhook RTDN `notificationType=12 (REVOKED)` → user.tier='FREE' + premiumExpiresAt=now

### 2. 결제 정책 + UX
- 약관 **제11조 (유료 서비스)**, **제12조 (구독 취소 및 환불)** 추가
- 한국 전자상거래법 + Apple/Google 정책 준수
- 환불 비율 (7일 100% / 7~14일 일할 / 14일+ 거절)
- 구독 화면 **"구독 취소 / 환불 요청"** 버튼 + 환불 정책 요약 4줄
- 약관/개인정보 **시행일 통일** = 2026-05-25 (consent PRIVACY_VERSION, terms/privacy 시행일)

### 3. 체험 종료 24h 전 알림 (Apple/Google 정책 + 전자상거래법)
- backend `utils/trialEndingSweep.ts` — 매시간 cron
- 체험 시작 6일 23h ~ 7일 전 + 미발송 + tier='PAID' + premiumPlanId 없음 사용자 검색
- Expo Push 발송 — "✨ 7일 무료 체험이 곧 끝나요"
- 딥링크: `amatda://subscription`
- 중복 방지: `trialEndingNotifiedAt` 필드

### 4. dominantType 별 그라디언트 + ConicDisc (분석 리포트)
- **다크 모드 + 타입별 hue** 적용 (warm amber / crimson / forest / navy / plum)
- `TYPE_GRADIENT` (export) — 5개 타입 그라디언트 3색
- `TYPE_DISC_COLORS` — ConicDisc halo/star 액센트 색 분기
- `TYPE_PRIMARY_COLOR` — 텍스트 밝은 액센트
- **compact prop** — 광고 활성 시 ConicDisc 150→130 축소 (statBox 값 잘림 방지)
- statBox `minHeight: 50` 보장
- 광고 OFF 시 원래 큰 사이즈 유지 (`useShowAds()` 분기)

### 5. 공유 캡처 영역 확장
- captureRef 대상 = coverWrap → flexBody 전체 (cover + bottomActions 포함)
- 캡처 검은 fallback 방지 — flexBody 안에 `<LinearGradient absoluteFill>` 깔기

### 6. 접근성 라벨 (P0)
- **29개** `accessibilityRole/Label/Hint/State` 추가 (핵심 동선)
- subscription.tsx (5), register.tsx (6), login.tsx + SocialLoginButtons (3), chatbot.tsx + CoachingInput (5), child-edit.tsx (5), profile.tsx + ProfileFooter (5)
- Google Play 접근성 정책 + Apple HIG 부분 준수
- 나머지 962개는 v2.10+ 단계적

### 7. P1 강화
- `register.tsx` — 이메일 형식 정규식 검증 (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- `child-edit.tsx` — `safeParseNum` (키/몸무게 NaN/0 차단 + 사용자 알림)
- `pushNotifications.ts` — iOS in-app primer (Apple 심사 안전, undetermined 상태일 때만)
- `baby-tracker.tsx` — `RefreshControl` 추가

### 8. Firebase Analytics 통합 (운영 KPI)
- `@react-native-firebase/app + analytics` 설치
- app.config.js plugin 추가
- `services/analytics.ts` 헬퍼 (PII-safe, fire-and-forget, dynamic require)
- 이벤트: `login`, `sign_up`, `trial_start`, `begin_checkout`, `purchase`, `refund`, `coaching_message_sent`, `child_registered`
- 통합: login (email/social), register (email), trial start, purchase (서버 검증 성공 후)
- ⚠️ 네이티브 모듈 — OTA 동작 X, 출시 빌드 시점부터 활성

### 9. Apple JWS 검증 (정석, 결제 webhook 보안)
- `@apple/app-store-server-library` 설치
- Apple Root CA 3개 다운로드 (G3 / G2 / AppleComputer) — `src/services/payment/apple-root-cas/*.cer`
- `apple-jws-verifier.ts` — `verifyAppleNotificationPayload`, `verifyAppleSignedTransaction`
- webhook/apple 라우트 통합 — 검증 실패 시 401 거부, init 실패 시 기존 API 재조회 폴백
- `scripts/copy-assets.js` — 빌드 시 .cer dist/ 복사 (`npm run build` 자동)

### 검증
- backend `npx tsc --noEmit` → EXIT=0 (전 단계)
- frontend `npx tsc --noEmit` → EXIT=0 (전 단계)
- backend Firebase Functions 배포 — 다수 revision (api / coachingApi / trialEndingSweep)
- frontend EAS update — production branch 다수 OTA (runtime 2.9.1)

### 결제 검증 (실 디바이스)
- ✅ Google Play SKU 등록 (`premium_monthly`, `premium_yearly`)
- ✅ 라이선스 테스터 등록 (`syh9912@gmail.com`, `sy3523485@gmail.com`)
- ✅ Pub/Sub Topic + Service Account + Firebase Secret 모두 설정
- ✅ Android Publisher API 활성화 + Play Console 앱 권한 부여
- ✅ 결제 → 검증 → 프리미엄 활성 흐름 작동 확인
- ✅ 환불 처리 (2건 자격 삭제 포함)

### 출시 차단 잔여 0건 (Android)

### 출시 후 가능
- iOS App Store Connect 구독 등록 (현재 Android 우선)
- PortOne 코드 제거 (사용 안 함 결정)
- 나머지 962개 접근성 라벨 단계적 추가 (v2.10+)
- Firebase Analytics 활성화 (출시 빌드 시점)
- 환영 팝업 (체험 자동 추천) — A/B 테스트 후 결정

---

## 2026-05-25 — Google Play 결제 인프라 구축

### 배경
출시 전 결제 테스트 가능하도록 Google Play Console 구독 등록 + RTDN webhook 인프라 전체 구성.

### Play Console 등록 변경
- **구독 SKU 2개**: `premium_monthly` (₩3,900/월), `premium_yearly` (₩33,900/년) — 코드 SKU 와 정확히 매칭
- **기존 버그 복구**: `monthly-auto` (매주 청구 — 출시 시 사용자 4배 청구 위험) → 비활성화, 새 `monthly-auto-v2` (매월 청구) 활성
- 무료 체험: 7일 (intro offer)
- **라이선스 테스터** 추가: `syh9912@gmail.com` (기존 `sy3523485@gmail.com`, `syh9912@naver.com` 유지)

### RTDN (Real-Time Developer Notifications) 인프라
- **Pub/Sub Topic**: `projects/amatda-parenting/topics/play-billing-rtdn` 생성
- **Topic 권한**: `google-play-developer-notifications@system.gserviceaccount.com` → `roles/pubsub.publisher`
- **Push Subscription**: `play-billing-rtdn-push`
  - Endpoint: `https://api-usglfifguq-uc.a.run.app/api/payment/webhook/google`
  - OIDC 인증: SA `play-iap-verifier@amatda-parenting.iam.gserviceaccount.com`
  - Audience: 동일 URL
- **Pub/Sub Service Agent** (`service-712169890278@gcp-sa-pubsub.iam`)에 `serviceAccountTokenCreator` 부여
- **Play Console RTDN 활성화**: 토픽 이름 입력 + 활성 체크 완료

### Service Account 발급 + Firebase Secret
- **신규 SA**: `play-iap-verifier@amatda-parenting.iam.gserviceaccount.com`
- **Play Console 권한**: "재무 데이터 보기" (영수증 검증 + 구독 조회용, 환불 권한 없음)
- **JSON 키 발급 + Firebase Secret 등록** 후 로컬 파일 즉시 삭제
- **신규 Firebase Secrets**:
  - `GOOGLE_PUBSUB_AUDIENCE` = webhook URL (OIDC 검증용)
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` = SA JSON (Android Publisher API 인증)

### 코드 변경
- `backend/src/index.ts` — `REGISTERED_SECRETS` 에 두 신규 secret 추가
- Functions 재배포 2회 (api / coachingApi 함수)

### 검증
- backend tsc → EXIT=0
- Functions 배포 → 성공 (revision api-00242-sif)
- backend code: webhook/google 핸들러 OIDC 검증 + Apple API 재조회 패턴 그대로 사용

### 다음 단계 (출시 전 결제 테스트)
- [ ] 실 디바이스에 internal test 트랙 빌드 설치 (`sy3523485@gmail.com` 또는 `syh9912@gmail.com` 로그인)
- [ ] 구독 화면 진입 → SKU fetch 성공 확인 (가격 표시)
- [ ] 테스트 결제 → 프리미엄 활성화 확인
- [ ] Firestore `payments` 컬렉션 도큐먼트 + `users.{uid}.premiumExpiresAt` 업데이트 확인
- [ ] RTDN webhook 수신 확인 (Functions 로그)
- [ ] 갱신 / 취소 / 환불 시나리오 (Play Console 에서 강제 취소)

### 미적용 (별도 PR)
- PortOne 코드 제거 (사용 안 함 결정)
- Apple JWS 서명 검증 라이브러리 도입 (현재 Apple API 재조회로 ground truth 검증 중)
- Apple App Store Connect 구독 등록 (iOS 결제 활성화 시)

---

## 2026-05-24 — 출시 전 보안 감사 fix (4건)

### 배경
출시 전 전체 보안 감사 수행. 차단급 0건 확인 후, 출시 후 hotfix 가능 항목 중 4건을 출시 전 선반영. (#4 Apple JWS 검증은 결제 sandbox 테스트 후 별도 PR, #5 AdMob production ID는 EAS Secret 빌드 직전 주입)

### 수정 파일

#### 2. babel-plugin-transform-remove-console (production 빌드 console 제거)
- `frontend/babel.config.js` (신규) — babel-preset-expo + production 시 transform-remove-console 플러그인
- `frontend/package.json` — devDependency 추가
- 목적: release 번들에서 console.* 호출 제거 → logcat 노출 + Sentry breadcrumb PII 누출 방어 (Sentry PII scrubber 와 다층 방어)

#### 3. Android allowBackup=false
- `frontend/app.json` — android 블록에 `"allowBackup": false`
- 목적: adb backup 으로 앱 데이터(SecureStore 외 AsyncStorage 등) 추출 차단

#### 6. chatbot 자동 전송 실패 사용자 안내
- `frontend/app/(main)/chatbot.tsx` — Alert import + firstMessage 자동 전송 catch 블록에서 Alert 호출
- 동작: 자동 전송 실패 시 "재시도/취소" 다이얼로그, 재시도 실패 시 입력창에 메시지 채워 사용자 직접 전송 가능
- 원칙: CLAUDE.md "에러를 조용히 삼키지 말 것"

#### 7. passport-view HMAC + TTL
- `backend/src/routes/memories.ts`
  - 기존: `createHash('sha256', childId+salt).slice(0,16)` — 영구 유효, 64-bit entropy
  - 신규: `createHmac('sha256', salt).update(childId+'|'+exp).digest('hex').slice(0,32)` — 7일 TTL, 128-bit entropy
  - URL: `/passport-view/:childId?key=X&exp=Y`
  - 검증: 만료 체크(410 응답) + `timingSafeEqual` constant-time 비교
- 기존 베타 단계 공유 링크는 깨짐 (수 적음, 재발급 가능)

### 검증
- `cd backend && npx tsc --noEmit` → EXIT=0
- `cd frontend && npx tsc --noEmit` → EXIT=0
- `cd frontend && npx expo lint` → 0 errors (기존 warning 무관)

### 출시 차단급 / 별도 PR
- 🔴 **결제 미테스트** — Apple sandbox + Google Play internal test 트랙 결제 흐름 전체 테스트 필수 (출시 차단)
- 🟠 **#4 Apple JWS 서명 검증** — `@apple/app-store-server-library` + Apple Root CA 4개 인증서 번들. 결제 sandbox 테스트 안정화 후 별도 PR
- 🟠 **#5 AdMob production ID** — EAS Secret 으로 출시 빌드 직전 주입
- 🟢 **PortOne 코드 제거** — 사용 안 함 결정. 결제 테스트 완료 후 별도 PR

---

## 2026-05-22 — v2.9.1 (5) 내부 테스트 출시 + 다수 UX/회귀 fix

### 배경
v2.9.0 internal test 베타에서 발견된 회귀/UX 이슈 일괄 fix. production 출시 준비. AdMob 앱 등록은 internal test 트랙이 Play Store 색인 안 되어 production 출시 후 진행 예정.

### 수정 파일
- `frontend/app/(main)/fever.tsx` — 해열제 보수값 (12.5→10mg/kg acet, 7.5→5mg/kg ibu), 챔프 ER (48mg/ml) 토글 추가, 의료 면책 안내
- `backend/src/routes/sos.ts` — 동일 보수값 + warning 강화 ("일반 가이드용 보수값, 의료 진단 대체 아님")
- `frontend/app/(main)/subscription.tsx` — trialUsed 시 무료체험 버튼 비활성 + "이미 체험하셨습니다" 표시
- `backend/src/routes/subscription.ts` — `/premium/status` 응답에 `trialUsed: Boolean(trialStarted)` 추가
- `frontend/stores/premiumStore.ts` — PremiumStatus 인터페이스 + fetchStatus 에 trialUsed 매핑
- `frontend/components/report/EditorialCover.tsx` — fullScreen paddingBottom 24→8, statsRow margin 12/18→6/4, statBox paddingVertical 12→8 (광고 50pt 활성 시 stats 잘림 방지)
- `frontend/components/ads/AdSlot.tsx` — native SDK 정적 import 제거 (OTA 안전), production 채널 placeholder (return null)
- `frontend/app/(main)/coparenting.tsx` — APP_STORE_LINK `amatda.app/download` → Play Store URL
- `frontend/components/home/DenseStatsRow.tsx` — 메인 stats 권장량 비교 메시지 (분유/수면/대변)
- `frontend/app/(main)/baby-tracker.tsx` — "수유 텀" → "식사 텀" 라벨
- `backend/scripts/grant-premium.cjs` (신규) — 이메일로 N개월 프리미엄 수동 부여 스크립트
- `backend/src/index.ts` — keepWarm Cloud Scheduler (5분마다 ping, 256MiB) — 콜드스타트 해결
- `frontend/app.json` — version 2.9.0→2.9.1, versionCode 4→5, iOS buildNumber 3→4

### 빌드 & 배포
- EAS build ID: `59aaf171-156f-4053-a66d-095e0d97ca71`
- AAB URL: https://expo.dev/artifacts/eas/c5d5trKmHvMcVqwHsB8NaF.aab
- Play Console 내부 테스트 트랙 출시 (2026-05-22 22:55)
- 출시명: 2.9.1 (5)

### 검증
- `cd backend && npx tsc --noEmit` — 통과
- `cd frontend && npx tsc --noEmit` — 통과
- Play Console 미리보기 경고 1건 (난독화 mapping 미연동 — 비차단, v2.9.0 동일)

### 남은 이슈 / 다음 단계
- 1~2일 내부테스트 안정성 확인 후 → production track promote
- production 출시 후 AdMob 앱 등록 + v2.9.2 광고 ON 빌드
- 네이버 검수 재신청 (production 출시 후)
- Play Store 마케팅 자산 (Feature Graphic 1024×500 + 프로모 영상 + 스크린샷 슬라이드) 작업 중
- 테스트 계정 syh9912@gmail.com → 2027-05-22 까지 PAID 부여 (grant-premium.cjs 실행)

---

## 2026-05-09 — 출시 검토 P0+P1+P2 일괄 fix (App Store/Play Store 심사 대비)

### 배경
오늘 작업분 전체를 출시 관점에서 재검토. 의료 정보 disclaimer 부족, 약관 시행일 미갱신, 데이터 다운로드 권리 가시성 부족 등 발견. 사용자 결정으로 P0+P1+P2 모두 처리.

### ✅ P0 — 의료기기성 위험 회피
1. **`growth-stats.tsx` 주수별 발달 화면 상단 disclaimer 카드** — "이 정보는 일반 참고용이며 의료 진단·처방을 대체하지 않습니다" + 응급 신호 시 즉시 병원 안내. 노란 배경 + 좌측 주황 라인으로 가시성 확보.

### ✅ P1 — 약관/법적 컴플라이언스
2. **`public/privacy.html` 시행일 2026-04-05 → 2026-05-09 (개정)** + 10절에 [개정 이력] 섹션 추가 (휴면 정책 신설, 기기 내 로컬 저장 항목 명시 등 변경 사실 기록)
3. **`PRIVACY_VERSION` 갱신** (`consent.tsx`, `register.tsx`) `2026-04-05` → `2026-05-09`
4. **`privacy.html` 1절에 기기 내 로컬 저장 항목 추가** — 마음 진단 mood diary 가 AsyncStorage 만 사용하고 서버 미전송임을 명시
5. **`DataRetentionCard.tsx` 데이터 다운로드 요청 버튼** — 마이페이지에 "📥 내 데이터 사본 받기 (이메일 요청)" 버튼 추가. 클릭 시 mailto 링크로 사전 작성된 양식 열림. PIPA 35조 / GDPR 20조 준수.

### ✅ P2 — UX 강화
6. **SOS 응급 가이드 모달 disclaimer bar** — 모달 상단 타이틀 아래에 노란 띠로 "일반 응급처치 참고용 · 의료 행위 대체 아님 · 위급 시 즉시 119" 항상 표시. 응급 처치 안내가 의료 행위로 오인되는 것 방지.

### 🔍 검증
- `cd backend && npx tsc --noEmit` — 통과 (변경 없음)
- `cd frontend && npx tsc --noEmit` — 통과
- `cd frontend && npx expo lint` — **0 errors** (155 warnings, 모두 pre-existing)

### App Store / Play Store 심사 대비 체크리스트
- [x] 의료 정보 disclaimer (주수별 발달 + SOS 모달)
- [x] 14세 미만 아동 보호 (이미 있음 — consent 화면)
- [x] 위치 정보 사용 동의 (이미 있음)
- [x] 푸시 알림 권한 (이미 있음)
- [x] 개인정보 다운로드 권리 (PIPA 35조)
- [x] 개인정보 삭제 권리 (이미 있음 — 계정 삭제)
- [x] 휴면 자동 파기 정책 약관 명시
- [x] 기기 내 로컬 저장 항목 약관 명시
- [x] 약관 개정 이력 기록
- [x] BOLA/IDOR 가드 (어제 fix)
- [x] cascade-delete (어제 fix)

---

## 2026-05-09 — 권한/안정성 audit P0+P1+P2 일괄 fix (사용자 승인)

### 배경
cascade-delete audit 후 다른 관점(권한/소유권 + race/quota)으로 추가 audit. 17건 발견 — P0 3건(BOLA/IDOR), P1 3건(race/quota), P2 5건(unbounded). 사용자 결정으로 **전체 일괄 fix**.

### ✅ P0 — 보안 직격 (BOLA/IDOR 방어)

**1. `sos.ts:564` `notify-family`** — 자녀 소유권/가족 멤버 검증 추가. 임의 childId 로 가족 푸시 스팸 차단.

**2. `vaccination.ts` GET schedule + schedule-alerts** — `childData.userId !== req.userId` 가드. 다른 사용자 자녀 출생일·접종 이력 유출 차단.

**3. `pregnancy.ts` GET 핸들러 6건** (`getChildIfAccessible` helper 적용)
- `/records`, `/mom-health`, `/kick-session`, `/timeline`, `/gdm`, `/gdm/food`
- `mental-check`, `daily-mission/today` 는 이미 ownership 체크 있어서 skip
- **의료 민감정보(혈당/EPDS/태동/식단/증상) 유출 차단** — PIPA + 의료법 직접 위반 위험 해소

### ✅ P1 — 데이터 일관성/할당량

**4. `coparenting.ts:104` `/accept`** — `db.runTransaction` 으로 read+update 원자화. 초대 코드 SNS 유출 시 동시 수락으로 권한 충돌 방지.

**5. `analyzeMedia.handler.ts:349`** — 자녀 컨텍스트 검증을 quota 차감 *이전* 으로 이동. 잘못된 childId 호출 시 quota 헛으로 소모되는 것 방지.

**6. `tracker.ts:348` `/import`** — `checkAndIncrementDailyLimit` 적용 (사용자당 일 20회). 10MB Excel 파싱이 비싼 작업이라 무제한 호출 → CPU 폭주 방지.

### ✅ P2 — 운영 비용 (기본 hard cap)

**7. `momstagram.ts:99` `/feed`** — 청크당 fetch 200 건 hard cap. 페이지가 깊어져도 메모리/Firestore 비용 폭증 방지. (cursor pagination 은 출시 후 별도 작업)

**8. `child.ts:553` daily-trait** — 매 저장마다 dailyTraits 전량 fetch 하던 패턴 → child doc 의 atomic counter (`dailyTraitCount`) 사용 + 최근 7건만 limit fetch. 1년 누적 시 매 저장 365건 풀 스캔 → 1건 doc + 7건 limit 으로 개선.

### ⏭ 출시 후 별도 작업으로 보류 (회귀 위험)

- **#6 mom-group `/posts`** — `.orderBy('createdAt')` 추가하려면 복합 인덱스 필요. 인덱스 없는 상태에서 추가하면 runtime error. 현 규모(500 cap) 에서는 문제 없음.
- **#11 pregnancy /gdm/weekly-report** — 이미 ownership + tier rate limit 적용되어 있음.
- **LOW 항목 4건** (#14~#17) — 코드 품질 개선 영역. 현 규모에서 영향 미미.

### 🔍 검증
- `cd backend && npx tsc --noEmit` — 통과
- `cd frontend && npx tsc --noEmit` — 통과
- 각 fix 마다 단계별 typecheck — 0 회귀
- 모든 추가 코드 try/catch + best-effort 로직

### 영향 받는 라우트 (총 11개)
- `POST /api/sos/notify-family`
- `GET /api/vaccination/schedule`, `POST /api/vaccination/schedule-alerts`
- `GET /api/pregnancy/{records,mom-health,kick-session,timeline,gdm,gdm/food}`
- `POST /api/coparenting/accept`
- `POST /api/coaching/analyze-media`
- `POST /api/tracker/import`
- `GET /api/momstagram/feed`
- `POST /api/children/:id/daily-trait`

---

## 2026-05-09 — Cross-collection cascade-delete 누락 7건 일괄 fix (Option A)

### 배경
임신앨범 글 삭제 시 가족피드(posts) cascade fix 후, 비슷한 패턴이 있는지 정적 audit 진행. 컬렉션이 시간 따라 추가됐는데 cascade 리스트가 업데이트 안 된 케이스 다수 발견 — 7건 (HIGH 5, MEDIUM 1, LOW 1).

### ✅ Fix

#### 1. `cascadeDelete.ts` — 회원 탈퇴 시 누락 컬렉션 일괄 추가
PIPA 21조(보유 목적 달성 후 즉시 파기) 위반 위험 해소:

**자녀 단위 (childId 기반) 추가**
- `milestonePhotos` (legacy dual-write 짝)
- `growthAlbums` (성장 PDF — Storage 비용 잔존)
- `gdmFoodLogs` (임당 식단)
- `kickSessions` (태동)
- `momMentalChecks` (EPDS 마음진단)
- `dailyMissions` (일일 미션)
- `babyTrackerDays / babyTrackerSessions` (2026-05-08 신규 컬렉션)

**사용자 단위 (userId 기반) 추가**
- `momGroupPosts / momGroupComments / momGroupBookmarks` (맘스톡 발화 데이터)
- `userBlocks` 양방향 (`userId` + `blockedUserId` 모두)
- `billingKeys` (자동결제 토큰 — 탈퇴 후 결제 시도 차단)

**의도적 제외**
- `payments` (전자상거래법 21조 5년 보관 의무 — 향후 PII 익명화 별도 정책으로 처리)

#### 2. `child.ts:300` — 자녀 삭제 cascade 보강
- `kickSessions / momMentalChecks / dailyMissions` 추가 (이전 누락)
- `babyTrackerDays / babyTrackerSessions` 추가 (신규 컬렉션)

#### 3. `mom-group.ts:698` — 게시글 삭제 시 연관 데이터 cascade
이전: `momGroupPosts.doc(id).delete()` 한 줄 (서브컬렉션/댓글/북마크 모두 잔존)

이후:
- `momGroupComments where postId == id` 삭제
- `momGroupBookmarks where postId == id` 삭제
- 서브컬렉션 `posts/{id}/likes` 삭제 (Firestore 자동 삭제 안 됨)
- 서브컬렉션 `posts/{id}/reports` 삭제
- batch 분할 처리 (500개 한도 대응)
- 로그: `cascade postId=X comments=N bookmarks=N likes=N reports=N`

#### 4. `pregnancy.ts:1376` — gdmRecords 삭제 시 식단 로그 외래키 정리
- `gdmFoodLogs.where(linkedGlucoseId == gdmId)` 조회 → `linkedGlucoseId: null` 로 batch update
- 식단 자체는 보존 (사용자 데이터) + stale 외래키만 제거

### 🔍 검증
- `cd backend && npx tsc --noEmit` — 통과
- 모든 cascade 는 `try/catch + best-effort` — 실패해도 본 삭제 완료 보장
- Firestore 인덱스 신규 필요 없음 (단일 필드 equality query)

### 향후 누락 방지
`cascadeDelete.ts` 가 utility 로 추출돼 한 곳만 보면 되는 구조로 정리됨. 새 컬렉션 추가 시 `firestore.ts` 와 `cascadeDelete.ts` 두 파일만 동기화하면 누락 위험 최소화.

### Audit 결과 (참고)
이전 보안 audit (16건, 14건) 들은 **JWT/OAuth/암호화/prompt injection 등 보안 영역**만 검토했고 **컬렉션 간 cascade 일관성은 한 번도 점검 X**. 이번이 첫 cross-collection audit.

---

## 2026-05-08 — 휴면 사용자 자동 파기 시스템 (C안 Phase 1, 사용자 승인)

### 배경
출시 전 보안 점검에서 "회원 탈퇴 시 즉시 파기" 만 구현되었고, 시간 기반 자동 파기는 없었음. PIPA 21조(보유 목적 달성 후 즉시 파기) + 정보통신망법 시행령 16조(휴면 1년) 충족이 누락된 상태. 사용자가 "사진 영원히 둘 수 없자나 몇년만 저장하고 지우자" 제안 → C안(혼합) 승인.

### 정책 (C안 — 사용자 승인)
- **활성 유저** (1년 내 접속): 사진 보관 유지
- **휴면 유저** (1년 미접속): 30일 전 푸시 알림 → 미응답 시 계정 + Storage 전체 cascade 삭제
- **회복 케이스**: 사용자가 다시 로그인하면 lastActiveAt 갱신 + 휴면 경고/삭제 예정 자동 클리어

### ✅ Phase 1 — 백엔드 인프라

#### 신규 파일
- **`backend/src/utils/cascadeDelete.ts`** — `cascadeDeleteUserData(userId, opts)` — Firestore 모든 컬렉션 + 자녀 cascade + Storage 전체 삭제. 회원 탈퇴 + 휴면 자동 삭제 양쪽이 공유. 멱등성 보장.
- **`backend/src/utils/userActivity.ts`** — `touchUserActive(userId)` — lastActiveAt 갱신 + 휴면 경고/삭제 예정 클리어. fire-and-forget 패턴.
- **`backend/src/utils/dormantUserSweep.ts`** — Stage A(경고) + Stage B(삭제) 두 단계, 한 회차 최대 100명 처리, 멱등성 보장.

#### 수정 파일
- **`backend/src/routes/auth.ts`**:
  - `generateTokens()` 에서 `touchUserActive(userId)` 자동 호출 → register/login/refresh/social/kakao/naver 모든 인증 경로 자동 갱신
  - `DELETE /api/auth/account` 핸들러 — 120 라인 cascade 로직을 `cascadeDeleteUserData()` 단일 호출로 교체 (로직은 utility 로 이동)
  - 사용 안 하는 import 정리 (`unlinkSocialAccount`, `decryptToken`, `deleteUserStorageFiles`)
- **`backend/src/index.ts`**:
  - `dormantUserSweep` Cloud Scheduler 함수 export
  - 스케줄: `30 3 * * *` (매일 03:30 KST), region `us-central1`, memory 512MiB, timeout 9분
- **`public/privacy.html`** — 3절 "보관 기간 및 파기" 에 휴면 정책 섹션 추가 (정보통신망법 시행령 16조 명시)

#### Firestore 스키마 추가 (users 컬렉션)
- `lastActiveAt: Timestamp` — 매 토큰 발급 시 갱신
- `dormantWarnedAt: Timestamp | null` — 1차 경고 발송 시각
- `scheduledDeleteAt: Timestamp | null` — 삭제 예정 시각 (warnedAt + 30일)

#### Sweep 동작
```
Stage B (먼저) — scheduledDeleteAt <= now → cascadeDeleteUserData(tryUnlink: true)
Stage A — lastActiveAt < now-365일 + dormantWarnedAt 미설정
       → 푸시 발송 + dormantWarnedAt/scheduledDeleteAt 마킹
```

#### 회귀 안전 장치
- legacy 유저(lastActiveAt 미존재)는 sweep 범위에서 자동 제외 — 출시 직후 모든 기존 사용자 휴면 처리되는 사고 방지
- 한 회차 최대 100명 처리 — 갑작스런 대량 삭제 방지
- Stage B 먼저 실행 후 Stage A — 같은 회차에서 새로 경고된 유저가 즉시 삭제되는 race 방지

### 🔍 검증
- `cd backend && npx tsc --noEmit` — 통과
- `cd frontend && npx tsc --noEmit` — 통과
- 함수 export 추가 확인 (firebase-functions v7 v2/scheduler API 사용)

### 📌 배포 절차 (Phase 1 배포 시)
1. `firebase deploy --only functions:dormantUserSweep` — 스케줄러 함수 등록
2. 또는 전체 함수 재배포 — `firebase deploy --only functions`
3. Cloud Scheduler API + Pub/Sub API 자동 활성화 (firebase deploy 시)
4. 첫 실행은 다음 새벽 03:30 KST

### ✅ Phase 2 — 프론트 UI

#### 신규 파일
- **`frontend/components/profile/DataRetentionCard.tsx`** — 마이페이지 카드:
  - 활성 상태: "마지막 접속 / 다음 자동 안내" 표시 + 정책 설명
  - 휴면 경고 상태: 큰 빨간 날짜 + "앱 사용 시 자동 연장" 강조 톤

#### 수정 파일
- **`backend/src/routes/auth.ts`**:
  - `GET /api/auth/me` 응답에 `lastActiveAt / dormantWarnedAt / scheduledDeleteAt` 추가 (UI 표시용)
- **`frontend/app/(main)/profile.tsx`** — `<DataRetentionCard />` 통합
- **`frontend/app/onboarding/consent.tsx`** — 약관 박스에 휴면 정책 한 줄 노트 추가
- **`frontend/app/(auth)/register.tsx`** — 동일한 휴면 정책 한 줄 노트 추가
- **`frontend/app/(main)/trait-detail.tsx`** — 부수 fix: useState/useRef 가 early return 이후 호출되던 Rules of Hooks 위반 (이전 작업 잔류 버그) — hooks 를 함수 상단으로 이동

### 🔍 최종 검증
- `cd backend && npx tsc --noEmit` — 통과
- `cd frontend && npx tsc --noEmit` — 통과
- `cd frontend && npx expo lint` — **0 errors**, warnings 만 (pre-existing)

---

## 2026-05-08 — 이미지 업로드 압축 (속도 + Storage 비용)

### 배경
사용자 보고: "이미지 하나 올리는데 시간 오래 걸리고 서버 데이터 많이 쓰이는 거 아니야?" 원본 사진(4–8MB) 그대로 업로드 → 무료 한도 5GB ÷ 평균 4MB = 1,250장 한계.

### ✅ Fix
**`frontend/services/api.ts`** — `uploadApi.upload()` 에 expo-image-manipulator 압축 추가:
- 가로 1280px 리사이즈 (비율 유지)
- JPEG 85% 품질
- EXIF 자동 제거 (위치/디바이스 정보 노출 방지)

### 효과
- **업로드 속도**: 5–20× 빠름 (4–8MB → 200–400KB)
- **Storage 비용**: 95% 절감 → 무료 한도 5GB 로 약 17,000장 가능 (사용자 1명당 50장 → 약 340명까지 무료)
- **개인정보**: EXIF 메타데이터 자동 제거

### 🔍 검증
- `cd frontend && npx tsc --noEmit` — 통과
- OTA 배포 완료 (Update group `ca28d656`, runtime 2.8.1)

---

## 2026-05-08 — dominantType 결정성 보장 (AI 비결정성 차단)

### 배경
사용자 보고: "답변 바꾸면 기질 라벨이 바뀐다". 코드 추적 결과 답변 → dominantType 직접 경로는 0건. 진짜 원인은 **`saju.interpreter.ts` 의 Gemini (temperature 0.4) 가 dominantType 자체를 결정** + 자녀 정보 수정 시 `calculateSajuWithAI` 재호출로 매번 흔들림.

### ✅ Fix
**dominantType 은 룰 기반 결정적, AI 는 detail 텍스트만 생성**.

#### 변경 흐름 (Before → After)
- **Before**: 룰이 fiveElements 계산 → AI 가 dominantType + label + detail 모두 생성 → AI 결과로 룰 dominantType 덮어쓰기
- **After**: 룰이 fiveElements 계산 + dominantType 결정 (max 매핑) → AI 는 fixedDominantType 입력받아 그 분류에 맞춰 label/personality/strengths 등 detail 만 생성 → dominantType 절대 변경 X

#### 코드 변경 ([saju.interpreter.ts](backend/src/services/saju.interpreter.ts))
- **`InterpreterInput`** 에 `fixedDominantType: string` 추가
- **`buildPrompt`** — 사전 결정 분류를 prompt 에 명시 ("dominantType 은 ${fixedDominantType} 으로 확정. 절대 변경 불가")
- **`validate(raw, fixedDominantType)`** — AI 응답의 dominantType 값 무시하고 fixedDominantType 강제 사용
- **`calculateSajuWithAI`** — 룰의 ruleResult.dominantType 을 fixedDominantType 으로 전달 + AI 결과로 dominantType 안 덮어씀

#### 효과
- **같은 사주(생년월일·시간·성별) = 항상 같은 dominantType 보장**
- 자녀 재생성 / 정보 수정 시 dominantType 흔들림 0
- AI 비결정성은 detail 텍스트(personality, strengths 등) 다양성에만 반영 — 분류 자체는 안정
- 부수 효과: AI 응답이 사주용어 검출돼서 retry 되어도 dominantType 안 흔들림

### 🔍 검증
- backend tsc --noEmit: 0 errors
- functions deploy: api + coachingApi 모두 update 완료

### ⚠️ 마이그레이션 주의
기존 사용자의 `child.innateData.dominantType` 은 그대로 유지됨 (DB 저장값은 변경 없음).
- 기존 사용자가 자녀 정보 수정해서 birthDate/birthTime 재입력하면 새 흐름으로 재계산되며 룰 기반 결정값으로 갱신.
- 그 시점부터는 영원히 같은 값 유지.

---

## 2026-05-08 — P0-2 Naver: SDK 패턴 유지 결정 (P0 분류 재평가)

### 배경 (재평가)
초기 보안 감사에서 `consumerSecret` 클라이언트 임베드를 P0(출시 차단) 로 분류했으나, 한국 OAuth 생태계 + Naver 공식 가이드 + 실질 위험도 재평가 후 **P1~P2 수준**이 더 정확한 분류였다고 판단.

#### 재평가 근거
- **한국 앱 사실상 표준**: 카카오/네이버/토스/배민/쿠팡 등 대부분이 native SDK + secret 임베드 사용
- **네이버 공식 가이드** 자체가 SDK 에 secret 임베드를 권장
- **실질 보안 경계는 Naver 콘솔 화이트리스트** (패키지명/Bundle ID) — secret 만으로는 임의 토큰 발급 불가
- **UX 우월**: 네이버 앱 설치 시 즉시 토큰, 자동 로그인 가능
- **출시 일정 (5/15)** 대비 백엔드 callback 패턴 안정화 시간 비효율

### 결정: SDK 패턴 유지 (revert)
중간에 백엔드 callback 패턴(`/auth/naver/callback` + `/auth/naver/check/:state`) 시도했으나 in-app browser 의 deep link 캐치 안정화 어려움 + 한국 표준 부합으로 SDK 패턴으로 원복.

### ✅ 원복 작업
- **frontend `social-auth.ts`** — `naverLogin()` 을 `@react-native-seoul/naver-login` SDK 사용 패턴으로 복구
- **frontend `social-auth.ts`** — `clearAllSocialSessions` 의 `NaverLogin.logout()` 호출 복구
- **frontend `app.json`** — plugins 에 `@react-native-seoul/naver-login` 재등록
- **frontend `package.json`** — `@react-native-seoul/naver-login@^4.2.4` 의존성 재추가 + `npm install`
- **frontend `eas.json`** — `EXPO_PUBLIC_NAVER_URL_SCHEME=naverlogin` 복구 (preview/production)
- **frontend `services/api.ts`** — 사용 안 되는 `authApi.naverCheck` 제거

### 🟡 backend dead code (향후 정리)
다음 라우트는 사용 안 함 — 향후 PKCE 지원 또는 다른 OAuth 흐름 재사용 시 활용 가능:
- `routes/auth.ts` `GET /auth/naver/callback`
- `routes/auth.ts` `GET /auth/naver/check/:state`
- `NAVER_STATE_COLLECTION` 정의

제거하지 않은 이유: 외부 노출 GET 라우트지만 적법한 OAuth 흐름이고 호출자 없음. 보안 표면은 작고 향후 재사용 여지 있어 P3 기술부채로 등록.

### 🔍 검증
- frontend tsc --noEmit: 0 errors
- npm install: 1 package added (naver-login 복구)

### 📦 배포
- OTA: Update group `1e68ee19-1e52-483d-b459-9a5115e4a11c` (preview branch)
- backend: 변경 없음 (dead code 라우트만 잔존)

### ⚠️ 향후 mitigation (출시 후 P2)
- consumerSecret 노출 자체는 RFC 관점에서 비표준. 향후 Naver 가 PKCE 지원 시 전환 검토
- 현재는 콘솔 화이트리스트로 1차 방어 충분

---

## 2026-05-08 — P0-2 Naver client_secret 백엔드 이전 시도 (revert 됨)

### 배경
어제 P0 보안 감사에서 식별된 마지막 출시 차단 항목. `@react-native-seoul/naver-login` SDK 가 `consumerSecret` 을 클라이언트 번들에 임베드하는 모델이라 APK 디컴파일 시 노출 위험. 출시 전 OAuth 2.0 authorization code grant 흐름으로 전환.

### ✅ 완료

#### Backend (이미 구현돼 있어 변경 없음)
- `services/social.auth.ts` — `exchangeCodeAndVerify('NAVER', code, redirectUri)` 가 이미 NAVER 케이스 처리
- `routes/auth.ts` — `POST /auth/social-code` 가 KAKAO + NAVER 모두 지원
- 백엔드는 환경변수 `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` 으로 token 교환만 수행, 클라에 secret 노출 없음

#### Frontend
- **services/social-auth.ts**:
  - `naverLogin()` 을 모든 플랫폼에서 `authSessionLogin('NAVER')` 위임 (기존 web 전용에서 통합)
  - `consumerSecret`, `EXPO_PUBLIC_NAVER_CLIENT_SECRET` 사용 코드 전부 제거
  - `clearAllSocialSessions()` 의 NaverLogin.logout 부분 제거 (AuthSession 은 디바이스 캐시 없음)
  - REDIRECT_URI 콘솔 출력 추가 — 네이버 콘솔 Callback URL 등록 시 정확한 값 확인용
- **package.json** — `@react-native-seoul/naver-login` 의존성 제거 (npm install 로 정리)
- **app.json** — plugins 에서 `@react-native-seoul/naver-login` block 제거
- **eas.json** — `EXPO_PUBLIC_NAVER_URL_SCHEME` 제거 (모든 환경)

#### 흐름 변경 요약
**Before**: 앱 → NaverLogin SDK (consumerSecret 임베드) → 네이버 → accessToken 즉시 → 백엔드 verify
**After**: 앱 → AuthSession.promptAsync (Naver authorize URL) → 네이버 → code 받음 → 백엔드 `/auth/social-code` (서버에서 client_secret 으로 token 교환) → user 정보 + JWT 발급

### 🔍 검증
- backend tsc --noEmit: 0 errors
- frontend tsc --noEmit: 0 errors
- npm install: 1 package removed (naver-login)

### 📌 흐름 변경 v2 (2026-05-08 후속) — 백엔드 callback 패턴

initial fix 시 expo-auth-session 의 `amatda://...` custom scheme redirect 채택했으나, 네이버는 redirect_uri 에 https:// 만 허용 (custom scheme 거부). 카카오와 동일한 백엔드 callback 패턴으로 전환.

#### 추가 변경
- **backend `routes/auth.ts`**:
  - `NAVER_STATE_COLLECTION = 'naverOAuthState'` 신규 (5분 TTL)
  - `GET /auth/naver/check/:state` — 폴링용 (1회 소비 후 doc 삭제)
  - `GET /auth/naver/callback` — 네이버 OAuth callback (kakao 패턴 복제, code → token → user → state doc → deep link redirect)
- **frontend `services/social-auth.ts`**:
  - `naverLogin()` 을 백엔드 callback 패턴으로 재작성 (kakaoWebLogin 과 동일 구조)
  - `WebBrowser.openAuthSessionAsync(authorize_url, 'amatda://auth/callback')` → state polling → directLogin 반환
  - `NAVER_CALLBACK_URL = 'https://api-usglfifguq-uc.a.run.app/api/auth/naver/callback'` 하드코딩
- **frontend `services/api.ts`** — `authApi.naverCheck(state)` 추가

#### 흐름 (최종)
1. 앱 → `https://nid.naver.com/oauth2.0/authorize?...&state=&redirect_uri=https://api-...run.app/api/auth/naver/callback`
2. 사용자 동의 → 네이버가 백엔드 callback 으로 code 전달
3. 백엔드: code → token 교환 → user 생성/매칭 → JWT 발급 → state doc 에 저장 → `amatda://auth/callback?state=XXX&provider=naver` deep link redirect
4. 앱: WebBrowser close 감지 → state 추출 → `/auth/naver/check/:state` 폴링 (1초 간격, 최대 30회) → directLogin 결과 수신

토큰은 deep link 쿼리에 절대 안 담음 (브라우저 history/Referer 누출 방어).

### ⚠️ 출시 전 운영 작업 (사용자 직접)

1. **네이버 개발자 콘솔 설정**:
   - https://developers.naver.com/apps → 내 애플리케이션 → "API 설정"
   - **PC 웹 환경** 추가/수정 → Callback URL:
     ```
     https://api-usglfifguq-uc.a.run.app/api/auth/naver/callback
     ```
   - 추가/수정 후 약 5분 뒤 적용

2. **새 빌드 필수**:
   - 네이티브 SDK 의존성 제거가 빌드에 반영되려면 새 EAS build 필요
   - `eas build -p android --profile preview`
   - 보안 측면: 옛 빌드는 consumerSecret 이 APK 안에 박혀 있음 → 새 빌드 후에야 P0-2 fix 가 진짜 효과

3. **백엔드 .env 확인**:
   - `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` 정상 설정 확인 (이미 사용 중이라 유지)

### 배포 상태 (2026-05-08)
- backend: Functions 재배포 완료 (`api`, `coachingApi`)
- OTA: Update group `5ea158cc-7f2a-4ced-84bd-e50d4871a782` (preview branch)

### 출시 차단 P0 12건 정리 완료 ✅
1. PASSPORT_SALT 하드코딩 제거 ✓
2. Naver client_secret 백엔드 이전 ✓ (이번 작업)
3. google-services.json git 정리 ✓
4. analyzeMedia race condition ✓
5. ask.handler 카운터 트랜잭션화 ✓
6. 입력 검증 zod ✓
7. Prompt injection + 응답 필터 ✓
8. 미디어 파일 검증 ✓
9. 약관/개인정보 동의 UI ✓
10. Storage cascade delete ✓
11. momstagram UGC 모더레이션 ✓
12. AD_ID/광고 ENV 정합성 ✓

추가: baby-tracker 서버 sync (데이터 손실 차단), 어제 OTA 회귀 hotfix.

---

## 2026-05-08 — baby-tracker 서버 sync (데이터 손실 차단)

### 배경
긴급 OTA fix 후 사용자가 앱 데이터 삭제로 회복했는데 baby-tracker 기록이 다 사라짐.
원인: storage.ts 가 AsyncStorage 만 사용, 서버 sync 함수가 아예 없었음. 다른 데이터(자녀/앨범/코칭/voice 입력)는 모두 Firestore 라 살아있는데 baby-tracker 수동 입력만 로컬 only 구조.
출시 직후 동일 시나리오 발생 시 사용자 데이터 영구 손실 → 출시 차단 신규 P0 로 식별, 즉시 fix.

### ✅ 완료

#### 신규 컬렉션
- **babyTrackerDays** — doc id `{childId}_{date}`, `{ userId, childId, date, records[], updatedAt }`
- **babyTrackerSessions** — doc id `childId`, `{ userId, childId, sleepSession, breastSession, updatedAt }`
- Firestore 복합 인덱스 추가: `babyTrackerDays(childId ASC, date ASC)`

#### 신규 라우트 (backend/src/routes/babyTracker.ts)
- `GET /api/baby-tracker/:childId/days/:date` — 단일 날짜 조회
- `GET /api/baby-tracker/:childId/days?from=&to=` — 범위 조회 (최대 100일)
- `PUT /api/baby-tracker/:childId/days/:date` — day records 덮어쓰기 (last-write-wins)
- `GET /api/baby-tracker/:childId/sessions` — 진행 중 sleep/breast 세션 조회
- `PUT /api/baby-tracker/:childId/sessions` — 진행 세션 저장
- 모든 엔드포인트: `getChildIfAccessible` 권한 검증 (`viewRecords`/`editRecords`)
- zod 스키마 검증 (TrackerRecord, date YYYY-MM-DD, time HH:MM, records 최대 500개)

#### Frontend sync (offline-first)
- **services/api.ts** `babyTrackerApi` 추가 — getDay/getDaysRange/putDay/getSessions/putSessions
- **features/baby-tracker/storage.ts**:
  - `saveRecords` → 로컬 setItem + 서버 PUT fire-and-forget (실패해도 로컬 보존)
  - `saveSleepSession`/`saveBreastSession` → 동일 패턴
  - 신규: `syncDayFromServer`, `syncRangeFromServer`, `syncSessionsFromServer`
- **app/(main)/baby-tracker.tsx**:
  - childId 진입 시 1회 `syncRangeFromServer(14일)` + `syncSessionsFromServer` 호출
  - sync 완료 후 `loadData()` 재호출 → 데이터 삭제/재설치 후 첫 진입에 자동 복구

#### 동작 시나리오
1. **정상 사용**: 모든 write 가 로컬 + 서버 양쪽에 즉시 반영
2. **오프라인**: 로컬에만 저장, 다음 온라인 write 시 그 시점 records 가 서버 PUT 됨 (자동 재시도 효과)
3. **앱 데이터 삭제 / 재설치**: 첫 진입에 14일 records + 세션 자동 fetch → 로컬 캐시 복원
4. **다중 기기 (가족 공유 시나리오)**: last-write-wins, 새 기기에서 진행 중 세션도 복구

### 🔍 검증
- backend tsc --noEmit: 0 errors
- frontend tsc --noEmit: 0 errors

### ⚠️ 운영 주의
- Firestore 인덱스 `babyTrackerDays(childId, date)` 빌드 완료 확인 후 OTA 배포
- 한 번 잃은 데이터는 복구 못 함 (이번 fix 는 앞으로의 손실만 방지)
- Android Auto Backup 활용해 잃어버린 데이터 복구 시도 가능 (앱 삭제 → 재설치)

---

## 2026-05-08 — 긴급 OTA hotfix (어제 OTA 회귀)

### 🚨 증상
- preview APK 일부 사용자에서 부팅 시 흰 화면 (어제 밤부터)
- Sentry 이슈:
  - REACT-NATIVE-9 — `Invalid hook call` (handled, 6 events)
  - REACT-NATIVE-A — `Attempted to navigate before mounting the Root Layout` (fatal)

### 🔬 원인
어제 세션 16 OTA에서 _layout.tsx 의 OTA 타임아웃 흐름을 추가하면서 모듈 로드 순서가 바뀜 → Pretendard 폰트 패치 IIFE (`Text.render` / `TextInput.render` mutation) 가 React 19.1 + RN 0.81.5 + Hermes 조합에서 invalid hook call 트리거 → _layout 마운트 깨짐 → 콜드스타트 푸시 처리의 `router.push` 가 마운트 전에 호출 → fatal → 흰 화면 stuck.

### ✅ Fix
- **[_layout.tsx:20-58](frontend/app/_layout.tsx:20)** Pretendard 패치 fail-safe
  - 외부 try-catch — 패치 실패 시 시스템 기본 폰트로 폴백, 앱 부팅 절대 막지 않음
  - 내부 try-catch — render 후처리 실패 시 원본 결과 그대로 반환
  - `__amatdaPretendardPatched` 플래그 — Fast Refresh / OTA reload 이중 patch 방지
- **[_layout.tsx:160-178](frontend/app/_layout.tsx:160)** 콜드스타트 푸시 처리
  - `getLastNotificationResponseAsync().then(router.push)` → setTimeout 300ms 지연
  - expo-router navigation tree mount 완료 보장

### 🔄 복구 절차
1. `eas update --branch preview` 발행
2. 흰 화면 사용자: 앱 데이터 삭제 → embedded 번들 부팅 → 새 fix OTA 자동 수신

### 검증
- frontend tsc --noEmit: 0 errors
- 사용자 기기 OTA 적용 후 정상 부팅 확인

---

## 2026-05-08 — 출시 전 P0 보안 감사 11건 일괄 fix

### 배경
출시 차단 요소를 도메인별(시크릿/인증/백엔드/개인정보/스토어) 5개 병렬 감사로 발굴 → P0 12건 식별 → 11건 완료, 1건 출시 후 P1 격하.

### ✅ 완료 (11건)

#### P0-1 — PASSPORT_SALT 하드코딩 제거
- [memories.ts:12](backend/src/routes/memories.ts:12) `'amatda-passport-2024'` 하드코딩 제거
- env 의 `getPassportSalt()` 사용 (env 미설정 시 fail-closed throw)
- 여권 PNG `Cache-Control: public, max-age=3600` → `private, no-store` (PII 노출 방지)
- **위험**: 누구나 childId만 알면 아이 이름·생년월일·기질이 인쇄된 PNG 무인증 다운로드 가능했음

#### P0-3 — google-services.json git 추적 정리
- `.gitignore` 에 패턴 있는데 추적 중인 불일치 정리
- Firestore/Storage rules 가 보안 경계라 식별자 노출 자체는 OK — 의도적 추적으로 일관화
- iOS GoogleService-Info.plist 는 EAS Secret 주입 유지

#### P0-4 — analyzeMedia race condition (Gemini 비용 폭주 차단)
- [analyzeMedia.handler.ts:38-72](backend/src/routes/coaching/analyzeMedia.handler.ts:38) `checkAndIncrementUsage` 트랜잭션화
- read+check+write 분리 → `db.runTransaction` 으로 원자화
- 동시 클릭 시 무료 3회 한도 우회로 Gemini billable 폭주하던 이슈 차단

#### P0-5 — ask.handler 일일 카운터 트랜잭션화
- [rateLimit.ts](backend/src/utils/rateLimit.ts) `checkAndIncrementDailyLimit` 신규 — 트랜잭션 + fail-closed
- ask.handler 에서 `getTodaySessionCount`(컬렉션 풀스캔) 제거 → 단일 카운터 문서 트랜잭션으로 전환
- emergency/urgent redFlag 만 한도 면제 정책 유지

#### P0-6 — 입력 검증 zod 도입
- [validate.ts](backend/src/utils/validate.ts) 공통 헬퍼 — `parseBody/parseQuery/parseParams`
- 적용 라우트:
  - coaching/ask, coaching/daily-diary, coaching/first-talk, coaching/analyze-media
  - momstagram (POST /posts, /comments)
  - album (POST /photos)
  - tracker (/voice-parse)
- 길이 cap, MIME 화이트리스트, ENUM 검증

#### P0-7 — Prompt injection 방어 + 응답 후처리 필터
- [forbidden.filter.ts](backend/src/services/coaching/forbidden.filter.ts) 신규
  - `containsForbiddenTerms` — 사주/오행/천간/지지/일주~시주/갑목~계수 정규식 매칭
  - `shouldRejectAIResponse` — 객체 재귀 탐색
- ask.handler / firstTalk / analyzeMedia 응답에 적용 — 검출 시 mock fallback
- dailyDiary: 이전 세션 텍스트(`s.message/s.answer`) sanitize, AI 응답 검출 시 mock
- tracker: 사용자 입력을 `<<<USER>>>...<<<END_USER>>>` fence + sanitize
- ask.handler: 메시지 2000자 cap

#### P0-8 — 미디어 파일 검증
- [analyzeMedia.handler.ts](backend/src/routes/coaching/analyzeMedia.handler.ts) `validateMedia` 신규
  - MIME 화이트리스트 (image: jpeg/png/webp, audio: mpeg/wav/m4a/aac/ogg/webm)
  - 매직넘버 검증 (이미지)
  - 5MB 디코드 사이즈 cap

#### P0-10 — Storage 파일 cascade delete (PIPA 21조 파기 의무)
- [storageCleanup.ts](backend/src/utils/storageCleanup.ts) 신규
  - `deleteUserStorageFiles` — 7개 prefix(`pregnancy/`, `profiles/`, `momstagram/`, `diary/`, `album/`, `lullaby/`, `growth_albums/`) 일괄 삭제
  - `deleteStorageFilesFromUrls` — Firebase URL/gs://path/bare path 파싱 후 개별 삭제
- auth.ts deleteAccount: Firestore 삭제 후 `deleteUserStorageFiles(userId)` 호출
- child.ts delete: albumPhotos/milestonePhotos/growthAlbums의 uri/printUrl/imageUrl/thumbnailUrl/pdfUrl/photoUrl 수집 후 `deleteStorageFilesFromUrls`
- 기존: privacy.html "탈퇴 시 즉시 삭제" 명시인데 실제 Storage 파일 잔존 → 허위 고지 위반 상태였음

#### P0-11 — momstagram UGC 모더레이션 (Apple 1.2 / Google UGC 정책)
- 백엔드:
  - `userBlocks` 컬렉션 신규
  - `POST /momstagram/posts/:id/report` (사유: abuse/ad/privacy/spam/sexual/other) — `posts/{id}/reports/{userId}` 서브컬렉션 + reportCount 증분 + 3회 누적 시 hidden=true 자동
  - `POST/DELETE /momstagram/users/:uid/block`
  - `GET /momstagram/users/blocked`
  - 피드 필터링: hidden=true 제외 + 차단 사용자 제외
- 프론트:
  - api.ts: `reportPost/blockUser/unblockUser/getBlockedUsers`
  - PostCard: `onMore` 가 isMine 무관하게 항상 호출되도록 변경
  - momstagram.tsx: handleMore에 본인=수정/삭제, 타인=신고/차단 분기

#### P0-12 — 광고 ENV 정합성
- eas.json preview/production 모두 `EXPO_PUBLIC_ADS_ENABLED=false` 통일
- AdMob SDK 미통합 상태와 ENV 일치 — 데이터 안전성 신고 시 "광고 ID 미사용" 정합

#### P0-9 — 약관/개인정보 동의 UI (PIPA 15·22조, 정보통신망법 22조)
- 백엔드:
  - `auth.ts /register` 핸들러에 consent 검증 추가 — 약관/개인정보/14세이상 미동의 시 400
  - 사용자 문서에 `consent: { terms, privacy, ageOver14, marketing, version, acceptedAt }` 저장
- 프론트:
  - api.ts `register` signature 에 consent 파라미터 추가
  - register.tsx 에 4개 분리 체크박스 + 전체 동의 + 본문 링크(WebBrowser)
  - 필수 미동의 시 가입 버튼 비활성
  - PRIVACY_VERSION = '2026-04-05'

### ⏸️ 출시 후 P1 격하 (1건)

#### P0-2 — Naver client_secret 백엔드 이전
- 현 구조: `@react-native-seoul/naver-login` SDK 가 `consumerSecret` 을 initialize 시점에 받음 (모바일 SDK 설계)
- 정석 fix: SDK 제거 + expo-auth-session 코드 grant 흐름 + 백엔드 `/auth/social/naver-code` 라우트
- 작업 규모: 1~2일 + 새 빌드 사이클 + 네이버 콘솔 Web 클라이언트 등록
- 출시 5/15 일정상 위험 — 출시 후 hotfix 로 격하 (Naver 콘솔 패키지/Bundle ID 화이트리스트가 1차 보안 경계로 동작 중)

### 🔍 검증
- backend tsc --noEmit: 0 errors
- frontend tsc --noEmit: 0 errors
- expo lint: 0 errors

### 📦 신규 파일
- backend/src/utils/validate.ts
- backend/src/utils/storageCleanup.ts
- backend/src/services/coaching/forbidden.filter.ts

### 📝 신규 의존성
- backend: `zod ^4.4.3`

### 📝 신규 컬렉션
- `userBlocks` — { userId, blockedUserId, createdAt }

### ⚠️ 운영 주의
- privacy.html 시행일이 2026-04-05 — `consent.version` 동기화 유지
- 약관 본문 URL: `https://amatda-parenting.firebaseapp.com/{terms,privacy}.html` — Firebase Hosting 배포 상태 확인 필요

---

## 2026-05-07 (세션 16) — 자장가/태교음악 UI 전면 리뉴얼 + 버그 수정 2건

### ✅ 완료 항목

#### L2 — 자장가/태교음악 아이콘 DALL-E 3로 교체
- **목적**: 기존 SVG 프로그래밍 방식 아이콘이 앱 마스코트(3D 클레이 스타일)와 전혀 다른 문제 해결
- **방법**: `scripts/generate-sound-icons-dalle.js` 신규 작성 — OpenAI DALL-E 3 API 호출
  - 1024×1024 생성 → sharp로 192×192 리사이즈
  - BASE_STYLE: "3D clay toy style, matte clay texture, soft pastel colors, kawaii aesthetic"
  - 24개 아이콘 생성: `sound-*.png` (12개) + `p-*.png` (12개)
  - `START_FROM` 환경변수로 중간 재시작 지원
- **부수 이슈**: `generate-all-icons.js` 실수로 실행 → cat-*, icon-*, quick-*, badge-*, academy-* 덮어씀
  - `git checkout -- frontend/assets/[파일들]` 로 복구
- **파일**: `scripts/generate-sound-icons-dalle.js`, `frontend/assets/sound-*.png`, `frontend/assets/p-*.png`

#### L3 — 자장가 MP3 파일 lullaby.tsx 연결
- **연결된 파일** (7개): womb.mp3, vacuum.mp3, fan.mp3, wave.mp3, forest.mp3, stream.mp3, rain.mp3
- **아직 WAV 사용** (5개): hairdryer.wav, twinkle.wav, brahms.wav, mozart.wav, orgel.wav
- **태교음악**: 전체 12개 `source: null` (음원 미확보) — pendingFile 명시
- **미확보 음원 출처 안내**:
  - 클래식: Musopen.org (저작권 해제 연주 녹음)
  - 자연음/심장박동: Freesound.org (CC0 필터)
  - 명상음: Pixabay Music
- **파일**: `frontend/app/(main)/lullaby.tsx`

#### L4 — 자장가/태교음악 화면 파스텔 라이트 테마 전환
- **변경 전**: `bg: '#1A1230'` 짙은 다크 퍼플 테마
- **1차 변경**: `bg: '#F4F0FF'` 라벤더 (사용자 피드백으로 재변경)
- **최종**: 앱 표준 테마 통일
  ```ts
  bg: '#F2F2F7'       // 홈/코파렌팅과 동일한 iOS 표준 배경
  card: '#FFFFFF'
  cardActive: '#FFF0E6'
  accent: '#FF8C5A'   // 앱 통일 코랄 포인트
  text: '#1C1C1E'
  textSub: '#636366'
  ```
- **파일**: `frontend/app/(main)/lullaby.tsx`

#### L5 — 사운드 카드 퀵메뉴 스타일 3D 입체화
- **목적**: 사운드 카드 버튼을 홈 퀵메뉴 아이콘과 동일한 3D 입체 느낌으로 통일
- **적용 패턴** (홈 `quickCircle`과 동일):
  ```ts
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',   // 흰색 하이라이트 테두리
  shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.13, shadowRadius: 8,
  elevation: 5,
  ```
- **재생 중 활성 카드**: 포인트 컬러 섀도 추가 (`shadowColor: COLOR.accent`)
- **같은 처리 적용 범위**: 사운드 카드, 타이머 칩, 울음감지 카드, 녹음 버튼, nowPlayingCircle
- **파일**: `frontend/app/(main)/lullaby.tsx`

#### B1 — 홈 수면 위젯 "기록 없음" 오표시 버그 수정
- **증상**: 수면 10h 표시되는데 아래에 "기록 없음" 표시
- **원인**: `valueSub`가 낮잠(`nap`) 카운트만 체크 → 밤잠(`night`) 기록만 있으면 nap=0 → "기록 없음"
  - `SleepSubType = 'nap' | 'night'` 인데 nights 계산 누락
- **해결**: `nights` 카운트 별도 추가, 상황별 분기 표시
  ```ts
  낮잠+밤잠 → '낮 2·밤 1회'
  낮잠만   → '낮잠 2회'
  밤잠만   → '밤잠 1회'
  기타 수면 → '수면 기록됨'  (totalH > 0 fallback)
  없음     → '기록 없음'
  ```
- **파일**: `frontend/components/home/DenseStatsRow.tsx`

#### B2 — OTA 업데이트 무한 대기 버그 수정
- **증상**: OTA 다운로드 화면에서 진행률이 90%대에서 멈추고 앱이 frozen 상태
- **원인**: `fetchUpdateAsync()`에 타임아웃 없음 → 네트워크 느릴 때 무한 대기, 건너뛸 방법 없음
- **해결**:
  1. **45초 타임아웃** — `Promise.race`로 제한, 초과 시 idle로 복귀 (기존 버전 사용)
  2. **15초 후 건너뛰기 버튼** — 다운로드 15초 경과 시 화면 하단에 "건너뛰기 (현재 버전 사용)" 버튼 노출
  3. 타임아웃 에러는 Sentry 미전송 (네트워크 이슈, 실제 버그 아님)
- **파일**: `frontend/app/_layout.tsx`

### 🔍 검증
- `cd frontend && npx tsc --noEmit`: 0 errors
- `cd frontend && npx expo lint`: 0 errors, 141 warnings (모두 기존)
- OTA 배포 완료 (preview branch, runtime 2.8.1)

### ⏳ 남은 작업
- **자장가 WAV → MP3 교체 필요**: hairdryer, twinkle, brahms, mozart, orgel (5개)
- **태교음악 음원 전체 미확보**: 12개 전부 `source: null` 상태
  - Musopen.org에서 클래식 5곡, Freesound.org에서 자연/명상 7곡 다운로드 후 연결 필요
  - 받은 후 Audacity로 15~30초 루프 트리밍 필요



---

## 2026-05-07 (세션 14) — 로그인 refresh 뮤텍스 + voice.tsx 준비중 stuck 해결

### ✅ 완료 항목

#### L1 — Refresh Token 동시 요청 뮤텍스 (api.ts) — 로그인 반복 현상 해결
- **증상**: 아침에 앱 킬 때 로딩만 되다가 로그인 화면으로 돌아가는 현상
- **원인**: 앱 시작 시 여러 API 호출이 동시에 401을 받으면 → 인터셉터가 각각 refresh 요청 → 첫 번째 refresh 후 토큰 `used: true` 마킹 → 두 번째 refresh가 이미 사용된 토큰으로 재요청 → 서버의 reuse detection 발동 → 전체 토큰 패밀리 revoke → 강제 로그아웃
- **해결**: `_refreshPromise` 뮤텍스 추가 — 첫 번째 요청만 실제 refresh 진행, 나머지는 같은 Promise 대기
  ```typescript
  let _refreshPromise: Promise<string> | null = null;
  // 401 인터셉터: if (!_refreshPromise) { _refreshPromise = (...) }
  // finally: _refreshPromise = null;
  ```
- **파일**: `frontend/services/api.ts`

#### V4 — voice.tsx 준비중 stuck 해결 (addListener 전환)
- **증상**: 음성 기록 화면 진입 시 "준비 중..." 에서 영원히 멈춤
- **원인**: `setupSpeechEvents` 가 `mod.useSpeechRecognitionEvent` 를 `useCallback` 내부에서 호출 → Rules of Hooks 위반 → 리스너 미등록 → events 미발생 → phase 전환 안 됨
  - 추가: `requestPermissionsAsync()` 타임아웃 없음 → 권한 다이얼로그 미표시 시 무한 대기
- **해결**:
  1. `useSpeechRecognitionEvent` 제거 → `ExpoSpeechRecognitionModule.addListener()` (EventEmitter API) 전환
  2. `requestPermissionsAsync()` 에 5초 `Promise.race` 타임아웃 추가
  3. `subscriptionsRef.current` 로 구독 추적 → unmount 시 `.remove()` 정리
  4. `recognizedTextRef` 로 stale closure 방지
- **파일**: `frontend/app/voice.tsx`
- **OTA**: Update group `d373bde5` (preview branch)

#### V5 — voice.tsx 아이 이름 미인식 + 시간 9시간 오류 수정
- **증상**: 아이 이름 처음엔 잘 인식되다 이후 계속 인식 못함, 시간이 9시간 전으로 기록됨
- **원인 1 — 시간 (9시간 오차)**:
  - 백엔드(Cloud Run/Firebase Functions)는 UTC 기준으로 실행됨
  - `new Date().getHours()` → UTC 시각 → 한국(UTC+9) 대비 9시간 차이
  - Gemini 프롬프트에 UTC `currentTime` 전달 → "방금 = 현재시각(UTC)" 로 파싱
- **원인 2 — 이름 미인식 (stale closure 근본 원인)**:
  - `processVoice`는 컴포넌트 클로저에서 `children`, `selectedChild`를 캡처
  - `initSpeechRecognition`의 이벤트 리스너가 등록될 때의 렌더 시점 값이 고정됨
  - 그 이후 store가 업데이트돼도 리스너는 stale한 children(빈 배열 가능)을 계속 참조
  - 처음엔 store가 이미 채워진 상태에서 등록되면 정상, 이후에는 stale 문제 발생
- **해결 1 — 시간**: 프론트에서 `clientTime` (HH:MM) 전송 → 백엔드에서 `clientTime` 우선 사용
  - fallback: `new Date()` UTC+9 보정으로 KST 계산
- **해결 2 — 이름**: `processVoice` 내에서 `useChildStore.getState()`로 항상 최신 store 직접 조회
  - 이벤트 핸들러/비동기 함수에서의 Zustand 표준 패턴
  - 추가: 음성 텍스트에 이름이 직접 포함되는지 확인(AI 추출보다 신뢰도 높음)
- **파일**: `frontend/app/voice.tsx`, `frontend/services/api.ts`, `backend/src/routes/tracker.ts`
- **OTA**: Update group `4714515d` (preview branch) + 백엔드 Functions 배포 완료

### 🔍 검증
- `npx tsc --noEmit` (backend + frontend): 0 errors
- `npx expo lint`: 0 errors, 138 warnings (모두 기존)
- OTA 배포 완료

### ⏳ 사용자 테스트 필요
- 앱 재시작 시 로그인 반복 현상 해소 확인
- 음성 기록 화면에서 "준비 중..." 이후 음성 인식 시작 확인
- 아이 이름 연속 인식 확인
- "방금" → 현재 KST 시각으로 기록 확인

---

## 2026-05-07 (세션 15) — 연속 음성 기록 + 음성설정 Google 카드 레이아웃 + baby-tracker 헤더

### ✅ 완료 항목

#### V6 — voice.tsx 연속 기록 모드 (Continuous Loop)
- **목적**: 수유 중 한 손 사용자가 음성 기록 화면에서 완료 버튼 누를 때까지 계속 기록
- **구현**:
  - 기록 성공 후 1.5초 대기 → `recognizedTextRef` / `hasProcessed` ref 초기화 → `startListening()` 재시작
  - Siri Case1(딥링크) 분기도 동일하게 `initSpeechRecognition()` + `loadSpeechModule()` 재실행
  - `lastRecord` state: 마지막 기록 요약 (초록 배지, 다음 기록 중 표시 유지)
  - "완료" 버튼: 오른쪽 상단 고정 (`position: 'absolute', top: 56, right: 24`), 탭 시 `baby-tracker`로 이동 + `voiceToast` 파라미터 전달
  - `handleClose` useCallback 으로 안전하게 종료 처리
- **파일**: `frontend/app/voice.tsx`
- **OTA**: Update group `4ea3ff99` (preview branch)

#### V7 — voice-settings.tsx Google 카드 레이아웃 수정
- **증상**: Google Assistant 카드에 큰 빈 공백 발생, "갤럭시 사용자" 라벨 없음
- **원인**:
  - `assistantCard`가 `flexDirection: 'row'`인데 `assistantTriggerBox`에 maxWidth 미설정
  - Google 트리거 텍스트가 길어서(`"OK Google, 아맞다 음성 기록해줘" → 바로 녹음 시작`) 가로 공간 과다 점유
- **해결**:
  - `assistantCard` → `alignItems: 'flex-start'`
  - `assistantDot` → `marginTop: 4` (세로 정렬)
  - `assistantInfo` 내부에 `assistantNameRow` (name + chevron) + subtitle + triggerBox 를 세로 column 으로 배치
  - `assistantTriggerBox` → `alignSelf: 'flex-start'` (텍스트 길이만큼만 너비 차지)
  - `platformLabel: '갤럭시/안드로이드 사용자'` GOOGLE_GUIDE에 추가 (이전 세션에서 추가됨)
- **파일**: `frontend/app/(main)/voice-settings.tsx`
- **OTA**: Update group `4a8da0fb` (preview branch)

#### V8 — voice 절대 시각 파싱 개선 ("10시에 똥쌌어" 등)
- **증상**: "10시에 똥쌌어"처럼 정확한 시각을 말해도 시간 인식 실패
- **원인**: 프롬프트 시간 파싱 규칙이 `"1시에" = "01:00" 또는 "13:00" (문맥으로 판단)` 한 줄뿐 → Gemini가 모든 시각에 AM/PM 판단 불능으로 null 반환
- **해결**: 절대 시각 파싱 섹션을 명시적 규칙 + 예시로 전면 재작성
  - 6~12 → 오전 우선 (10시에 → 10:00, 8시에 → 08:00)
  - 13~23 → 그대로 사용
  - 1~5 → 현재 시각 기준 더 가까운 쪽
  - 오전/오후 명시 케이스 예시 추가
  - 분 포함 케이스 추가 ("10시 30분" → "10:30")
- **파일**: `backend/src/routes/tracker.ts`
- **배포**: Firebase Functions 배포 완료

#### H1 — baby-tracker.tsx 헤더 간격/글씨 크기 조정
- **증상**: 뒤로가기 버튼, 날짜 네비, 분유값설정/음성설정 버튼이 너무 붙어 있고 겹침
- **해결**:
  - `content.paddingTop`: `72` → `84` (Samsung One UI 높은 네비게이션 바 대응)
  - `dateText.fontSize`: `18` → `15`
  - `dateArrow`: `36×36` → `32×32`, `borderRadius: 16`
  - `dateArrowText.fontSize`: `22` → `18`, `marginTop: -2` → `-1`
  - `dateNav`: `gap: 4`, `paddingHorizontal: 0`
  - `dateCenter.gap`: `8` → `6`, `paddingHorizontal: 2`
  - `todayBadge.paddingHorizontal`: `10` → `8`
  - `voiceBtn`: `flexShrink: 0` 추가
- **파일**: `frontend/app/(main)/baby-tracker.tsx`
- **OTA**: Update group `ec521924` (preview branch)

### 🔍 검증
- `npx tsc --noEmit` (frontend): 0 errors
- `npx expo lint`: 0 errors, 141 warnings (모두 기존 파일)
- OTA 배포 완료

---

## 2026-05-07 (세션 13) — Android App Shortcuts + Google App Actions

### ✅ 완료 항목

#### A1 — Android App Shortcuts + Google App Actions (네이티브 빌드 필요)
- **목적**: 갤럭시/안드로이드 사용자 양손 핸즈프리 음성 기록 지원
- **구현 내용**:
  1. `plugins/withAndroidShortcuts.js` 생성 — Expo config plugin
     - `shortcuts.xml` 생성 (`android/app/src/main/res/xml/shortcuts.xml`)
     - `AndroidManifest.xml` MainActivity에 `<meta-data android:name="android.app.shortcuts">` 추가
  2. `app.json` → plugins에 `"./plugins/withAndroidShortcuts"` 추가
  3. shortcuts.xml 내용:
     - **Static App Shortcut**: 아이콘 길게 누르기 → "음성으로 기록하기" → `amatda://voice`
     - **Google App Actions** (`actions.intent.OPEN_APP_FEATURE`): "OK Google, 아맞다 음성 기록해줘" → `amatda://voice`
- **검증**: `npx expo prebuild` 로 shortcuts.xml 생성 + AndroidManifest.xml meta-data 추가 확인
- **딥링크**: `amatda://voice` → `voice.tsx` → 음성 인식 자동 시작 (기존 구현 활용)
- **EAS 빌드**: `6b073918-b72f-4e4e-b39d-be937631de58` (빌드 중)

#### V3 — 음성 설정 가이드 빅스비 제거 + 구글 가이드 현실화 (OTA)
- **이유**: 빅스비로는 `amatda://voice` 딥링크 자동 실행 불가 (핸즈프리 안 됨)
- **수정**:
  - `AssistantKey` 타입에서 `'bixby'` 제거
  - `BIXBY_GUIDE` 상수 삭제
  - `guides` 배열: `[SIRI_GUIDE, GOOGLE_GUIDE]`로 변경
  - `GOOGLE_GUIDE`: 3가지 방법으로 재구성
    - 방법①: 아이콘 길게 누르기 → "음성으로 기록하기"
    - 방법②: "OK Google, 아맞다 음성 기록해줘" (App Actions)
    - 방법③: Google Home 루틴으로 커스텀 명령어 설정
- **OTA**: Update group `a653ea86`
- **파일**: `app/(main)/voice-settings.tsx`

### 🔍 검증
- `npx tsc --noEmit`: 0 errors
- `npx expo lint`: 0 errors
- `npx expo prebuild`: shortcuts.xml + AndroidManifest.xml 정상 생성 확인

### 🔍 빌드 이력
- 1차 빌드 `6b073918` 실패 — AAPT 오류: shortcutShortLabel/shortcutLongLabel 인라인 문자열 불가, @string/ 참조 필요
- 수정: `withStringsXml`로 strings.xml에 리소스 추가 + shortcuts.xml에서 @string/ 참조
- 2차 빌드 `1fc21192` 성공 ✅
- APK: https://expo.dev/accounts/song9912/projects/amatda/builds/1fc21192-2e3f-45ce-8904-ee35e49ab444

### ⏳ 사용자 테스트 필요
- 아이콘 길게 누르기 → "음성으로 기록하기" 메뉴 표시 확인
- "OK Google, 아맞다 음성 기록해줘" → voice.tsx 열림 확인

---

## 2026-05-07 (세션 12) — 음성 가이드 공식문서 기반 전면 재작성 + 앨범 표지 미세 조정

### ✅ 완료 항목

#### V2 — 음성 설정 가이드 3플랫폼 공식문서 기반 전면 재작성 (voice-settings.tsx)
- **발견된 오류들**:
  1. `BIXBY_GUIDE`: "하이 빅스비 말하기" 조건 — 이 조건은 구 Bixby Routines (Android 12 이하)에만 있었고 현재 "모드 및 루틴"에는 존재하지 않음
  2. `BIXBY_GUIDE`: "단축 명령어(Quick Commands)" — 삼성이 2024년 12월 One UI 7 / Bixby 3.0 업데이트로 공식 삭제
  3. `GOOGLE_GUIDE`: 루틴 설정 경로가 Google 앱이 아닌 Google Home 앱 기준이어야 함
  4. `SIRI_GUIDE`: 변수 연결 설명 부정확 — "Magic Variable" 방식: URL 입력란 탭 → 키보드 위 파란 변수 바에서 "받아쓰기 텍스트" 토큰 탭
- **수정 내용**:
  - `SIRI_GUIDE`: Apple 공식 단축어 문서 기반 — 받아쓰기 동작 + URL 열기 동작 + Magic Variable(파란 토큰) 연결 단계 명확화
  - `GOOGLE_GUIDE`: 별도 설정 없이 "OK Google, 아맞다 열어줘" 즉시 사용 가능 안내 (step 1) + Google Home 앱 루틴으로 커스텀 "육아" 명령 등록 (step 2~7)
  - `BIXBY_GUIDE`: 방법① 음성 즉시 실행 ("하이 빅스비, 아맞다 열어줘") + 방법② 모드 및 루틴 → 빅스비에게 묻기(Ask Bixby) 동작 — 삼성 공식 Quick Commands 삭제 공지 명시
- **파일**: `app/(main)/voice-settings.tsx`

#### C3 — 앨범/임신 표지 텍스트 최종 위치 확정 (album.tsx + pregnancy.tsx)
- **최종값**:
  - `.cover-name-natural`: `top: 23%`, `font-size: 33px`, `right: 7mm`, `width: 130mm`
  - `.cover-period-natural`: `top: 62%`, `font-size: 18px`, `right: 5mm`, `width: 130mm`
- **파일**: `app/(main)/album.tsx`, `app/(main)/pregnancy.tsx`

### 🔍 검증
- `npx tsc --noEmit`: 0 errors
- `npx expo lint`: 0 errors (warnings만, 기존과 동일)
- OTA preview 브랜치 배포:
  - Update group `247e4d3a` — voice guides 3플랫폼 전면 재작성 + 표지 최종 위치

---

## 2026-05-07 (세션 11) — setTokens hydrate race fix + 앨범 표지 재조정 + 음성 가이드 상세화

### ✅ 완료 항목

#### L2 — setTokens hydrate race condition 수정 (authStore.ts)
- **근본 원인**: `setTokens`의 `if (state.userId && state.email)` 가드 — 앱 재시작 직후 refresh interceptor가 `hydrate()` 완료 전에 실행되면 state에 userId/email이 null → `saveAuth` 스킵 → 토큰 미저장 → 다음 OTA reload 후 구 토큰 로드 → 서버 거부 → 강제 logout
- **수정**: null일 경우 `loadAuthAsync()`로 SecureStore에서 직접 읽어 보완 후 `saveAuth` 호출 보장
- **파일**: `stores/authStore.ts`
- **검증**: `npx tsc --noEmit` 0 errors

#### C2 — 앨범 표지 텍스트 위치 최종 조정 (album.tsx + pregnancy.tsx)
- **증상**: top:14% → 오벌 크라운 장식 위에 이름이 겹침; top:62% date가 "Precious Memories" 텍스트 위에 표시
- **수정**:
  - `.cover-name-natural`: `top: 14%` → `top: 25%`, `font-size: 24px` → `28px` (Baby Growth 바로 위)
  - `.cover-period-natural`: `top: 62%` → `top: 67%`, `right: 12mm` → `right: 5mm`, `font-size: 13px` → `15px`
- **파일**: `app/(main)/album.tsx`, `app/(main)/pregnancy.tsx`

#### V1 — 음성 설정 가이드 단계별 설명 상세화 (voice-settings.tsx)
- **요청**: "설명이 조금씩 다른거 같아 실제 앱하고" → 실제 UI와 일치하는 상세 가이드로 업데이트
- **수정**:
  - `SIRI_GUIDE.steps`: 단축어 앱 설치 방법, "+" 버튼 위치, "텍스트 받아쓰기" 동작 찾는 법, URL 변수 연결 방법 상세화
  - `GOOGLE_GUIDE.steps`: Google 앱 프로필 아이콘 경로, 어시스턴트 설정 > 루틴 찾는 법, 앱 열기 동작 추가 경로 상세화
  - `BIXBY_GUIDE.steps`: 갤럭시 설정 > 모드 및 루틴 경로, "하이 빅스비 말하기" 조건 설정, "앱 열기" 동작 추가, 루틴 이름 저장까지 One UI 6/7 기준 상세화
- **파일**: `app/(main)/voice-settings.tsx`

### 🔍 검증
- `npx tsc --noEmit`: 0 errors
- OTA preview 브랜치 2회 배포:
  - `438f7e35` — setTokens fix + 표지 위치 수정
  - `39584886` — 음성 가이드 상세화

---

## 2026-05-07 (세션 10) — 로그인 유지 fix + 앨범 표지 텍스트 위치 fix

### ✅ 완료 항목

#### L1 — 로그인 풀림 (logout race condition) 수정
- **근본 원인**: `saveAuth()` fire-and-forget → OTA `reloadAsync()` 가 SecureStore 쓰기 완료 전에 실행 → `hydrate()` 가 이전 토큰 읽음 → 서버에서 만료된 refresh token 거부 → 강제 logout
- **수정 파일**:
  - `services/storage.ts`: `saveAuth` async + `Promise.all(await SecureStore.setItemAsync × 4)` — 이전 세션에서 이미 완료
  - `stores/authStore.ts`: `setAuth`, `setTokens`, `setUser` → `async` + `await saveAuth(...)` (interface도 `Promise<void>` 로 변경)
  - `services/api.ts`: `setTokens(...)` → `await setTokens(...)` (interceptor)
  - `hooks/useLoginHandlers.ts`: `setAuth(...)` → `await setAuth(...)` (3군데)
  - `app/(auth)/register.tsx`: `setAuth(...)` → `await setAuth(...)`
  - `app/onboarding/set-nickname.tsx`: `setUser(...)` → `await setUser(...)`
  - `app/(main)/edit-profile.tsx`: `setUser(...)` → `await setUser(...)`
- **효과**: SecureStore 쓰기 완료 보장 후 라우팅/OTA reload 진행

#### C1 — 앨범 표지 텍스트 위치 수정 (pregnancy.tsx + album.tsx)
- **증상**: `top: 31%` 로 이름이 "Baby Growth" 텍스트 위에 겹침 ("Bab똘똘rowth")
- **수정**:
  - `pregnancy.tsx`: `.cover-name-natural` `top: 31%` → `top: 19%`, `.cover-period-natural` `top: 66%` → `top: 60%`, date `font-size: 13px` → `17px`
  - `album.tsx`: `cover-overlay` 박스 완전 제거 → `cover-name-natural` / `cover-period-natural` 자연스러운 배치 (동일 CSS)
- OTA: release 브랜치 `916e9904`

### 🔍 검증
- `npx tsc --noEmit`: 0 errors
- `npx expo lint`: 0 errors (기존 warnings only)
- OTA: preview 브랜치 (update group `64469ab6-f780-427a-a699-fbd52ba98c52`)
- ⚠️ `release` 브랜치는 어떤 채널과도 미연결 → 반드시 `--branch preview` 로 배포

---

## 2026-05-07 (세션 9) — 임신앨범 PDF 성장앨범과 동일한 구조로 재작성

### ✅ 완료 항목

#### G1 — 임신앨범 PDF generatePregnancyAlbumHTML 전면 재작성 (pregnancy.tsx)
- **원인 1 (2×2 안 나옴)**: `photo-cell`에 `min-height: 0` 없어 grid overflow 미처리, `photo-img`가 `relative` position → 사진 영역이 grid 밖으로 침범
- **원인 2 (구조 미일치)**: 단순 flex 카드 구조 vs 성장앨범의 폴라로이드 grid 구조
- **수정**: 성장앨범 `generateAlbumHTML`과 동일한 CSS 프레임워크 적용 (핑크 임신 테마 유지)
  - `photo-cell`: `display: grid; grid-template-rows: 1fr auto; min-height: 0` (폴라로이드)
  - `photo-grid`: `min-height: 0` 추가 (critical fix)
  - `photo-img`: `position: absolute` (contain letterbox)
  - `photo-img-bg`: blur 배경 (blur letterbox fill)
  - 폴라로이드 미세 회전 (`nth-child` rotate)
  - 워시테이프 `::before` (핑크 색상)
  - `photo-title-row` → `ms-row / ms-label` 구조 (title을 ❤ + 텍스트로 표시)
  - `photo-memo`: `Single Day` 손글씨 폰트 + text-shadow
  - 구글 폰트: Gaegu, Single Day, Black Han Sans 추가
  - 월 디바이더 폰트 52pt → 180px (Black Han Sans)
  - 엔딩 페이지: Single Day 64px, gradient rule

### 🔍 검증
- `npx tsc --noEmit`: 0 errors
- `npx expo lint`: 0 errors (기존 warnings only)
- OTA: preview 브랜치 (update group 3fae50c5)

---

## 2026-05-07 (세션 8) — 수정저장 버그 fix + 이모지 이미지 + 이미지 수정 기능

### ✅ 완료 항목

#### F1 — 수정 저장 안 되는 버그 수정 (backend/album.ts PATCH)
- **근본 원인**: `albumPhotos` 컬렉션은 `content`/`title` 필드를 사용하지만, PATCH 엔드포인트가 `memo`/`milestone`으로 업데이트 → 필드명 불일치로 GET이 읽지 못함
- **수정**: albumPhotos는 `content`/`title`로, milestonePhotos는 `memo`/`milestone`으로 각각 별도 업데이트 객체 사용
- 백엔드 배포: Firebase Functions 재배포 완료

#### F2 — 임신 타임라인 엄마기분 이모지 → 3D 클레이 이미지 표시 (album.tsx PregnancyTimeline)
- **원인**: `{item.emoji || '📌'}` 텍스트로 렌더링 (이미지 매핑 없음)
- **수정**: `PREG_EMOJI_IMGS` 매핑 추가 (pregnancy.tsx와 동일한 36개 이모지 → 이미지 파일)
- `pStyles.cardEmojiImg` 스타일 추가

#### F3 — 수정 시 이미지도 변경 가능 (pregnancy.tsx, album.tsx)
- 수정 모달에 현재 이미지 미리보기 + "📷 사진 변경/추가" 버튼
- 새 이미지 선택 시 `uploadApi.upload()` → 업로드 후 URL을 PATCH에 포함
- Backend PATCH에 `uri` 파라미터 지원 추가 (album.ts + pregnancy.ts)
- `api.ts` 타입 시그니처 업데이트

### 🔍 검증
- `npx tsc --noEmit`: 0 errors (frontend + backend 둘 다)
- `npx expo lint`: 0 errors
- 백엔드 배포: Firebase Functions deploy complete
- OTA: preview 브랜치 (update group 89e6c824)

---

## 2026-05-07 (세션 8 일부) — 수정/삭제 모달 + 임신앨범 기본값 + 엄마기분 이모지

### ✅ 완료 항목

#### E1 — 길게 누르면 "수정 + 삭제" 선택지 표시 (pregnancy.tsx, album.tsx)
- **원인**: 기존 long-press Alert에 "삭제" 버튼만 있었음
- **수정**: "수정" + "삭제" 양쪽 표시. 수정 선택 시 메모 편집 모달 오픈
- `PregnancyTimeline` (album.tsx): 로컬 `editItem` state + `handleEditSavePT` + 모달 → `PATCH /pregnancy/records/:id`
- `BabyAlbum` (album.tsx): 로컬 `editState` state + `handleEditSave` + 모달 → `PATCH /album/photos/:id`
- `pregnancy.tsx` (`handleLongPress`): 수정/삭제 Alert → `PATCH /pregnancy/records/:id`
- 백엔드: `PATCH /pregnancy/records/:id`, `PATCH /album/photos/:id` 신규 추가 (dual-collection atomic batch)

#### E2 — 엄마기분 마일스톤 이미지 표시 수정 (pregnancy.tsx)
- **원인**: `createRecord` 시 `milestoneEmoji` 미전달 → Firestore에 null 저장 → 이모지 없음
- **수정 (신규)**: `composeSymptomChip.emoji` 를 `milestoneEmoji`로 전달
- **수정 (기존 데이터)**: 클라이언트에서 `symptomPresets.find(s => s.label === item.title)?.emoji` 로 폴백
- `api.ts`: `pregnancyApi.updateRecord`, `albumApi.update` 신규 추가

#### E3 — 임신앨범 "새 앨범" 기본값 자동 설정 (pregnancy.tsx)
- **원인**: 성장앨범과 달리 임신앨범은 기본값 없이 빈 폼 오픈
- **수정**: 버튼 클릭 시 timeline 최초 기록 월 → `albumDateFrom`, 이번 달 → `albumDateTo`, `${childName} 임신앨범` → `albumTitle` 자동 설정
- 기본 표지 이미지(`album-cover.png`) + "기본 표지 · 탭하여 변경" 오버레이 표시

### 🔍 검증
- `npx tsc --noEmit`: 통과 (0 errors)
- `npx expo lint`: 0 errors (warnings only, pre-existing)

---

## 2026-05-06 (세션 7) — 임신앨범 PDF 생성 + SOS 설명 + 버그 수정

### ✅ 완료 항목

#### B1 — 임신앨범 마일스톤+엄마기분 동시 선택 + 사진 표시 (pregnancy.tsx)
- **원인**: `composeChip` 단일 상태가 한 번에 하나만 선택 가능 → 두 개 독립 상태 분리
- **수정**: `composeMilestoneChip` + `composeSymptomChip` 별도 state
- `handleSaveUnified`: 마일스톤 우선, 엄마기분 노트로 포함, 항상 1 record (`createRecord`)
- 사진: 모든 경로에서 `mediaUri: composePhoto` 전달

#### B2 — 임신앨범 피드: 유저 업로드만 표시 (pregnancy.tsx)
- `source !== 'development'` 필터 + 날짜 내림차순 flat list
- 주차 그룹 헤더 제거 (성장앨범과 동일한 카드 피드)

#### B3 — SOS 이미지 잘림 수정 (sos.tsx)
- `panelImageWrap`: 고정 높이 `SCREEN_HEIGHT * 0.55` + `overflow: hidden`
- `panelImage`: `width/height: 100%`, `resizeMode="contain"`
- 동적 `aspectRatio` 제거 (충돌 원인)

#### B4 — SOS 이미지 하단 여백에 단계 설명 텍스트 추가 (sos.tsx)
- 각 이미지 패널 아래 `stepDescBox` 카드: "STEP N" + 한국어 설명
- 데이터: `HEIMLICH_BY_AGE.infant.quickSteps`, `CPR_BY_AGE.infant.quickSteps`, `GUIDE_CONTENT[key].quickSteps`

#### B5 — 임신앨범 PDF 생성 기능 추가 (pregnancy.tsx)
- 성장앨범(`album.tsx`)과 동일한 2×2 그리드 PDF 출력 (`expo-print` + `expo-sharing`)
- 사진이 있는 기록만 포함 (`mediaUri && mediaType !== 'video'`)
- 폼: 앨범 제목(선택), 시작/종료 월(YYYY-MM), 표지 이미지(선택)
- 핑크 임신 테마 HTML (`generatePregnancyAlbumHTML`)
- 이미지 → base64 변환 (`pregUriToDataUri`)
- 표지 이미지 선택 (`pickCoverImage`)

### 🔍 검증
- `npx tsc --noEmit`: 통과 (0 errors)
- `npx expo lint`: 0 errors (warnings only, pre-existing)

### 🚀 배포
- OTA: `eas update --branch preview` (ebaf60d3) — 배포 완료

---

## 2026-05-06 (세션 6) — 앱스토어/플레이스토어 등록 전 최종 감사

### ✅ 완료 항목

#### S1 — 위치 권한 설명 수정 (`app.json`)
- `NSLocationWhenInUseUsageDescription` / `locationWhenInUsePermission`: "학원 추천" → "주변 소아과 찾기 및 맘스톡 지역 그룹 매칭"
- **원인**: 학원(academy) 화면은 dead code 정리로 제거됐으나 권한 설명이 갱신 안 됨
- 앱스토어/플레이스토어 심사 시 권한 목적 불일치로 거절 위험

#### S2 — console.log → logger.info (`proactive.insight.ts` L261)
- `console.log('[PregnancyInsights] generated ...')` → `logger.info(...)`
- Cloud Functions 프로덕션 로그 일관성

#### S3 — 체험판 일수 오표기 수정 (`subscription.ts`)
- start-trial 응답: `trialDaysLeft: 30` / "30일" → `7` / "7일"
- **원인**: 실제 로직은 7일 계산인데 응답 메시지만 30일로 방치됨
- 사용자/심사자 혼란 방지

### 🔍 검증
- `npx tsc --noEmit`: 통과 (backend + frontend 모두)

### 🚀 배포
- backend: `firebase deploy --only functions:api` — 배포 완료 (S2, S3 반영)
- frontend OTA: `eas update --branch preview` (86fb3738) — 배포 완료
  - 구매 복원 버튼 (Apple 필수)
  - 자동갱신 법적 고지 5개 항목
  - iOS PortOne 완전 차단

#### S4 — privacy.html 이메일 + 위치 항목 수정
- 개인정보보호 책임자 이메일: `syh9912@naver.com` → `privacy@sylabs.kr`
- 수집 항목: "주변 학원 추천" → "주변 소아과 찾기 및 맘스톡 지역 그룹 매칭"

#### S5 — refund.html 이메일 수정
- 문의처 이메일: `syh9912@naver.com` → `support@sylabs.kr`

#### S6 — IAP finishTransaction 누락 수정 (`payment.ts`)
- **원인**: 서버 검증 실패 시 `finishTransaction`이 호출되지 않아 Apple이 트랜잭션을 보류 상태로 유지 → 재구매 불가 버그
- **수정**: 서버 검증 성공/실패 양쪽 경로 모두 `finishTransaction` 호출하도록 분기 변경
- Apple 심사 시 IAP 흐름 검증에서 잡힐 수 있는 이슈

### 🚀 배포
- hosting: 배포 완료 (privacy.html, refund.html 수정)
- frontend OTA: `eas update --branch preview` (b4b1ab9f) — IAP finishTransaction fix

### 📋 남은 이슈 (사용자 직접 처리)
- [ ] 새 EAS 빌드 필요 (app.json 위치 권한 변경은 OTA 불가, 네이티브 레이어)
- [ ] App Store Connect + Google Play Console: IAP 상품 등록 (premium_monthly 3,900원, premium_yearly 33,900원)
- [ ] 데이터 세이프티 폼 (Google Play) / 개인정보 레이블 (App Store) 작성
- [ ] 심사용 테스트 계정 준비 (test@amatda.com / test1234)
- [ ] 연령 등급 설정 (App Store: 4+, Google Play: All Ages)
- [ ] 구독 체험 기간 스토어에도 등록 (Introductory Offer — 7일 무료)

---

---

## 2026-05-05 (세션 5) — 전체 보안/버그 감사 + 자동 수정

### ✅ 완료 항목

#### C1 — 아이 실명 마스킹 갭 수정 (analyzeMedia, dailyDiary, firstTalk handlers)
- Gemini 프롬프트에 `child.name` 직접 노출 → `'아이'`로 교체
- mock 빌더 호출부도 동일하게 수정 (`buildMockCryAnalysis(child.name,` → `'아이'`)

#### C2 — 어드민 라우트 미보호 수정 (`mom-group.ts`)
- `POST /admin/delete-region-posts` 에 `requireAdmin` 미들웨어 누락 → 추가
- authMiddleware만 있어도 아무 인증 유저가 호출 가능했던 취약점

#### C3 — 소셜 로그인 mock 토큰 프로덕션 유출 차단 (`social-auth.ts`)
- `authSessionLogin`: clientId 미설정 시 조건 없이 mock 토큰 반환 → `__DEV__` 가드 추가
- 프로덕션에서 clientId 누락 시 throw로 변경

#### C4 — Gemini fetch 타임아웃 추가 (`gemini.client.ts`)
- 무제한 대기 가능했던 fetch → `AbortController` + 30초 타임아웃
- `try/finally`로 타이머 누수 방지

#### C5 — Google Play 결제 검증 예외 삼키기 수정 (`payment.ts`)
- inner try/catch가 `verifyGooglePurchase` 실패를 삼켜서 Pub/Sub 재시도 불가
- inner try/catch 제거 → outer catch로 500 반환 → 재시도 작동

#### H1 — 인증 rate-limit 사용자별 분리 (`security.ts`)
- `/api/upload` rate-limit에 `keyGenerator: rateLimitUserKey` 추가
- 한국 CG-NAT 환경에서 IP 충돌로 false rate-limit 방지

#### H2 — `logger.error()` 범위 확장 (6개 파일, 17개 catch 블록)
- payment.ts, coaching/followup, coaching/history, coparenting.ts, momstagram.ts, child.ts
- logger import 4곳 추가 (analyzeMedia, firstTalk, followup, coparenting)

#### M1 — catch 블록 에러 로깅 완성
- TypeScript 통과 확인

#### M2 — 입력 검증 강화
- `child.ts` GET `/:id/daily-tracking`: `days` 상한 90으로 cap (이전: 무제한)
- `child.ts` POST / + PUT /:id: `bloodType` 허용값 A/B/AB/O 외 null 처리
- `momstagram.ts` POST /posts: `childGender` (M/F/U), `dominantType` (5가지 기질) enum 검증

### 🔍 검증
- `npx tsc --noEmit`: 통과 (에러 0)

### 🚀 배포 현황
- backend: 배포 필요 (보안 수정 사항 미반영)

---

## 2026-05-05 (세션 3) — 아기시간 편집 모달 날짜 변경

### ✅ 완료 항목

#### 아기시간 기록 편집 시 날짜 변경 지원 (`baby-tracker.tsx`)
- 편집 모달에 날짜 선택 UI 추가 (◀ 날짜 ▶ 이동 버튼)
- 오늘 이후 미래 날짜는 선택 불가 처리
- 날짜 변경 시: 원본 날짜에서 삭제 → 대상 날짜에 추가 (atomically)
- `handleEditSave` async 전환 + cross-date move 로직
- `adjustEditDate` 헬퍼, `editDate` state 추가
- 진행 중 수면(__active_sleep__)은 날짜 변경 비노출 (세션 기반이라 날짜 개념 없음)

### 🔍 검증
- `npx tsc --noEmit`: 통과 (에러 0)
- `npx expo lint`: 통과 (에러 0, 기존 경고만)

---

## 2026-05-05 (세션 2) — mental-check 완성 + APK 빌드 dep 정리

### ✅ 완료 항목

#### 1. mental-check 가족 푸시 발송 로직 (`pregnancy.ts`)
- `POST /mental-check`: `shareWithPartner=true` 시 familyMembers (accepted) 조회 → pushSchedules 등록
- riskLevel별 메시지 4종 (`partnerPushBody` 헬퍼)
- low/mild: 안부 요청 / moderate: 관심 요청 / high: 즉시 함께 / urgent: 전문도움 촉구
- 실패 시에도 본 기록은 유지 (try/catch 격리)

#### 2. mental-check AI 권고 (`GET /mental-check/analysis`)
- Gemini 가용 시 검사 이력(횟수/점수/추세/stage)을 컨텍스트로 개인화 권고 생성
- 실패 시 정적 `riskMessage()` 폴백 — 안전성 보장

#### 3. APK 빌드 dep 정리 (EAS 빌드 실패 원인 연쇄 수정)
- **원인 1**: `expo-video@~2.0.0` (SDK 54 호환 불가) → 제거 (코드에서 import 없음)
- **원인 2**: EAS npm 엄격 피어dep 모드 → `.npmrc` `legacy-peer-deps=true` 추가
- **원인 3**: `react-native-worklets` 미명시 → 명시적 의존성 추가 (reanimated@4 Babel 플러그인 필수)
- `expo-asset ~12.0.13`, `expo-image-picker ~17.0.11` 호환 버전 업데이트
- package-lock.json 클린 재생성

#### 4. Firestore 인덱스 콘솔 정리
- `firebase deploy --only firestore:indexes --force` 로 dead 4개(ads×2, chatLogs, sleepPredictions) 콘솔에서 실제 삭제

#### 5. mom-wellness 베타 검증
- API 메서드 4개 모두 확인 (questions/save/history/analysis)
- 결과 화면: riskLevel, recommendation(AI), notifiedFamily, nextRecommendedAt 모두 표시 확인
- urgent 시 1577-0199/1393 연락처 표시 확인

#### 6. users.visitDates 정책 결정
- **현상 유지**: 백엔드/프론트 쓰기 코드 모두 제거됨. 읽는 코드도 없음. 기존 데이터 보존, 신규 쓰기 자연 중단.
- 삭제 마이그레이션 불필요 (비용/영향 없음)

### 🚀 배포 현황
- backend: 배포 완료 (mental-check 가족 푸시 + AI 권고)
- firestore:indexes: 배포 완료 (dead 4개 삭제)
- APK (EAS): 빌드 진행 중 (커밋 c42d17f 기준)

### 📋 남은 이슈
- [x] APK EAS 빌드 성공 (v2.8.1, 797초, FINISHED)
- [ ] OTA `eas update --branch preview` (코드변경 반영 위해 권장)
- [ ] components/report/* onboarding 전용 위치 재배치 (선택사항)

---

---

## 2026-05-05 — Dead code 대정리 + 회귀 fix + mental-check 신규 (대규모)

> **세션 결과 요약**: 약 -8100줄 코드 정리 + APK 19~29MB 감소 + 두 번째 로그인 -2~5초 + parent-level 게임화 시스템 통째 제거 + mental-check (EPDS) 백엔드 신규 + 회귀 2건 hotfix (Google silent sign-in 롤백, sos require 경로).

### 🔥 회귀 fix (P0)

#### Google Sign-In silent 패턴 롤백 (`fe0f9ea`, revert `50ab08d`)
- **증상**: "Google 로그인 또 안 돼" — 단말 사용자 보고
- **원인**: 5/4 commit `50ab08d` 가 카카오/네이버와 UX 통일을 위해 silent sign-in 패턴 (`signInSilently()` 시도 → 실패 시 picker fallback) 도입. 라이브러리 stale token / picker dismiss 문제로 실 단말에서 깨짐
- **fix**: 해당 커밋 통째 revert → 원래 단순 `await GoogleSignin.signIn()` 패턴 복귀
- **출시 우선 판단**: 카카오/네이버 UX 통일은 출시 후 안정화 단계로 이연. Gmail 등 Google 표준 앱도 매번 picker 사용

#### SOS WebP 변환 시 IC_HEIMLICH/CPR/BURN/FOREIGN require 누락 (`59dcf06`)
- **증상**: OTA 빌드 시 metro bundler `Unable to resolve module ../../assets/sos/heimlich-infant-1.png`
- **원인**: `1072791` 의 PNG→WebP 변환 시 SOS_STEP_IMAGES 만 .webp 로 바꾸고 같은 파일을 가리키는 상단 가이드 버튼 아이콘 4개 require 누락
- **tsc 한계**: tsc 는 require 경로 검증 안 해서 못 잡음. metro bundler 가 빌드 시점에야 잡음
- **fix**: 4개 require 모두 .webp 로 변경

### 🎯 핵심 성과

| 영역 | 효과 |
|---|---|
| 두 번째 로그인 속도 | -2~5초 (Gemini dailyInsight dead code 제거) |
| APK 크기 | -19~29MB (deps 5개 제거 + SOS PNG→WebP 14MB 절약) |
| 코드량 | 약 -8100줄 (dead 화면/컴포넌트/라우트/서비스 일괄 정리) |
| 백엔드 부하 | retention/streak/visit, daily-insight, weather, food, sleep, sibling, mate, academy, chatbot, ad, kit subscription 등 dead API 호출 사라짐 |
| Firestore 인덱스 | 4개 dead 인덱스 제거 (ads×2, chatLogs, sleepPredictions) |

### 📦 모든 커밋 (시간순)

#### Curation 1차 (성능)
1. `c23da43` perf(deps): 미사용 deps 5개 제거 (ffmpeg-static, expo-media-library, expo-document-picker, expo-intent-launcher, expo-crypto, expo-build-properties — APK 5~15MB)
2. `1072791` perf(sos): PNG → WebP 변환 (15.40MB → 1.30MB, -91.6%) + 4-패널 sizing 수정 (각 이미지 자기 비율로 표시) + dead asset 8개 정리
3. `3d2677a` perf(home): Plan A useEffect 명시적 병렬화 (Promise.allSettled)
4. `824f359` perf(home): dailyInsight dead code 제거 (Gemini 호출 사라짐 — proactiveInsights state, loadProactiveInsights, InsightCards 모두 정의만 있고 사용 0)

#### Curation A — 화면 6개
5. `2ecc5f6` chore: dead 화면 6개 제거 (compatibility, mates, community, report, academy, sleep-predict) + 의존 API (siblingApi, academyApi, sleepApi, observationApi.report)

#### Curation B — 컴포넌트 23개
6. `95c52f4` chore: dead 컴포넌트 정리 (CompactStats, dailyCard, AIAnalysisRow, TraitBarsCard, baby-tracker/* 6, MessageBubble/QuickReplies, DailyMissionBadges, ui/Button+Card+Divider+IconButton+LoadingScreen+AuthHeader, AdBanner, SplashVideoPlayer)

#### Curation C — parent-level 시스템 통째 (Phase 1~4)
7. `a788164` Phase 1 — frontend 진입 차단 (홈 메뉴, 푸시 화이트리스트, recordVisit hook)
8. `0412ead` Phase 2 — child-card LEVELS 의존 제거 + 단일 스킨 + parent-level.tsx 삭제
9. `81e4029` Phase 3 — backend USER_LEVELS 제거 + 무료 코칭 dailyLimit 10회/일 단일화 (이전: streak 기반 5단계 10~50회 분기)
10. `c6b0d4e` Phase 4 — backend retention.ts 슬림화 (700줄 → 80줄, push-schedule 만 유지)

#### 추가 정리 (단계 1~5 + A1/A2/B1/C1/C3)
11. `26e9e8f` 단계 1 — frontend 안전 dead (dataExport, useLocation, safeLink + api 메소드 5개 + ageFeatures HOME_MENUS_BY_AGE)
12. `b6c7635` 단계 2 — chatbot 시스템 통째 (frontend chatbotApi + backend routes/chatbot.ts + collections.faq)
13. `df4d720` 단계 3 — 광고 옛 시스템 (adApi + routes/ad.ts)
14. `63e7797` 단계 4 — kit 구독 + premium/subscribe deprecated 제거
15. `6f5e1d7` 단계 5 — 잡 dead 라우트 (vaccination upcoming/presets, coaching weeklyReport/dailyInsight handler, observation report, recommendations seed)
16. `ff55681` A1 — backend index.ts dead 라우트 4개 mount 제거 (academy/sibling/mate/sleep)
17. `e42d956` A2 — retentionApi dead 메소드 3개 (countdown/streak/pushContent)
18. `adc9c46` B1 — frontend dead API (foodApi/weatherApi/coachingApi.ask)
19. `d6d6400` C1 — backend dead 파일 14개 도미노 정리 (라우트 7개 + 서비스 7개, -1584줄 단일 커밋)
20. `3bbad16` C3 — Firestore 인덱스 4개 + collections 정의 2개 dead 정리

#### 신규 기능
21. `a80e55f` feat(pregnancy): mental-check (EPDS) 백엔드 4 라우트 신규
    - `backend/src/data/epdsQuestions.ts` 신규 (~135줄): EPDS 표준 10문항 한국어 + stage별 보조 문항 5세트 + 채점/분류 로직
    - 4 라우트: GET questions / POST save / GET history / GET analysis
    - 5단계 위험도 (low/mild/moderate/high/urgent) + 자해 신호 시 무조건 urgent
    - urgent 안내: 1577-0199(정신건강위기) / 1393(자살예방) / 119
    - Firestore 인덱스 추가: momMentalChecks (childId asc, createdAt desc)

#### 기타 fix
22. (커밋 hash) fix(pregnancy): 메모 라벨 오타 — 르바이에 → 르봐이예
23. `fe0f9ea` revert: silent sign-in 롤백 (Google 로그인 회귀)
24. `59dcf06` fix(sos): IC_*_INFANT require 경로 .png → .webp (회귀 fix)

### 🚨 중요한 정책 변경 (Rule of Two 영역)

1. **무료 코칭 일일 한도 단일화** (10회/일)
   - 이전: USER_LEVELS 5단계 (새싹 10 / 줄기 15 / 꽃봉오리 20 / 만개 30 / 열매 50)
   - 새: 모든 무료 사용자 일일 10회 단일 정책 (FREE_DAILY_LIMIT)
   - 사용자 결정에 따른 단순화

2. **parent-level 게임화 시스템 통째 제거** (frontend + backend + Firestore)
   - 부모 레벨/뱃지/연속접속 보상 시스템 전체 제거
   - 여권(child-card) 스킨 단일 톤 고정 (#1A3A5C/#2A5A8C)
   - users.visitDates 데이터는 보존 (cascade cleanup 만 활성, 신규 쓰기 자연 중단)

3. **dead 백엔드 라우트 정리** (다른 클라이언트 / 미래 사용 보호)
   - 모바일 only 앱 + frontend 호출 0건 확인된 것만 제거

### 🩺 Mental-check (EPDS) 신규 구현 — mom-wellness 화면 살림

> **발견**: mom-wellness.tsx 화면이 호출하는 `pregnancyApi.mentalCheck*` 4개 메소드의 백엔드 라우트가 누락되어 있어 항상 404 실패. 사용자 결정으로 화면 살림 → 백엔드 신규 구현.

- 4 라우트: questions / save / history / analysis
- EPDS 표준 10문항 한국어 (공개 임상 자료 기반 번역)
- stage별 보조 문항 5세트 (prenatal / postpartum_early/mid/late / general)
- 점수 계산: 문항 1·2 역채점, 3~10 정채점 (0~30점)
- 5단계 위험도 분류 + 자해 신호 시 무조건 urgent
- 위험도별 사용자 안내 메시지 + 다음 권장 검사일 (urgent 1주 → low 4주)
- Firestore: collections.momMentalChecks 활용 + 인덱스 1개 추가

#### 보류 (별도 작업)
- shareWithPartner=true 시 가족 푸시 발송 → 현재 notifiedFamily=0 단순 반환
- AI(Gemini) 기반 맞춤 권고 → 현재 정적 메시지

### 📋 미해결 / 다음 작업

- [ ] 가족 푸시 발송 로직 (mental-check shareWithPartner)
- [ ] EPDS analysis 의 AI 기반 맞춤 권고 (현재 정적 메시지)
- [ ] users.visitDates 데이터 정리 결정 (현재는 보존)
- [ ] backend dead 라우트 즉시 삭제 vs 410 응답 모니터링 정책
- [ ] components/report/* 가 onboarding 에서만 사용 → 위치 재배치 검토
- [ ] APK 새 빌드 (deps native 5개 제거 효과는 다음 빌드 시 적용)

### ✅ 검증

- frontend tsc pass (모든 단계)
- backend tsc pass (모든 단계)
- 회귀 2건 (Google silent sign-in, sos require) 발견 즉시 fix
- Agent 진단 시 false negative 3건 (`coachingApi.firstTalk/milestones/send` multiline 호출 패턴 — multiline grep 으로 보강 후 확인)
- Mental-check 임상 안전: urgent 시 1577-0199/1393/119 안내, 자해 신호 시 무조건 urgent

### 🚀 배포

- backend: `firebase deploy --only functions` (Curation 정리분 + mental-check 신규)
- firestore: `firebase deploy --only firestore:indexes` (momMentalChecks 인덱스 추가, ads/chatLogs/sleepPredictions 인덱스 제거)
- OTA: `eas update --branch preview` (frontend Curation 정리분)
- APK 빌드: 미수행 (deps native 효과 보려면 추후 별도)

---

## 2026-05-04 — Google Sign-In audience 매칭 hotfix (project_id 기반 검증)

> **증상**: T1 보안 강화 배포 직후 Google 소셜 로그인 500 에러. 카카오/네이버는 별개 hotfix(아래 Hotfix1) 후 정상.
> **근본 원인**: Google 네이티브 SDK 가 반환하는 access_token 의 aud/azp 는 webClientId 가 아니라 Android/iOS 자동 생성 client_id.
> strict equality (`info.aud === env.GOOGLE_CLIENT_ID`) 로는 거부됨.

### 진단 과정 (정직한 기록)

5단계 round-trip — 각 단계 deploy + 단말 실측:
1. **trim 가설** (`...com\n` 비교 실패 의심) → env trim 추가 → 똑같이 실패
2. **다중 client_id 허용** (`GOOGLE_ALLOWED_AUDIENCES` 추가) → strict 매칭은 그대로라 효과 없음
3. **prefix/suffix 8자 진단** → 모두 같음 (Google client_id 모두 `apps.googleusercontent.com` 으로 끝남)
4. **prefix 12자 + 길이 진단** → `712169890278…(len=72)` 양쪽 동일
5. **char-level diff 진단** → 길이 72, 끝 5자 동일, prefix 12자 동일, **가운데만 다름**
6. **결론**: 같은 GCP 프로젝트의 Web vs Android client_id 패턴

> **반성**: 진단 round-trip 5번. "len=72 + prefix 같음 + suffix 같음" 패턴을 한 번에 인지했다면 30분 안에 끝났을 일. 사용자에게 사과.

### 정석 해결 — `project_id` 기반 검증

```ts
// `{PROJECT_NUMBER}-{UNIQUE}.apps.googleusercontent.com` 형식에서 project number 추출
const projectIdOf = (id) => id.match(/^(\d+)-[^.]+\.apps\.googleusercontent\.com$/)?.[1];
const projectMatch = projectIdOf(info.aud) === projectIdOf(env.GOOGLE_CLIENT_ID);
```

**보안 영향**:
- ✅ 다른 GCP 프로젝트 토큰 거부 유지 (project number 다름)
- ✅ 같은 앱의 Web/Android/iOS client_id 모두 정상 통과 (Google OAuth 표준 권장 패턴)
- ✅ 명시 strict 매칭 (`GOOGLE_ALLOWED_AUDIENCES`) 도 백업으로 유지

### 수정 파일
- `backend/src/services/social.auth.ts` — verifyGoogleToken project_id 매칭
- `backend/src/config/env.ts` — `E()` 헬퍼로 secret 값 일괄 trim (\n 안전), `GOOGLE_ALLOWED_AUDIENCES` 추가

### 부가 발견 — Secret Manager trailing newline
모든 OAuth 관련 secret 에 trailing newline 가능성 → `E()` 헬퍼로 모두 trim 처리. 이전 TOKEN_ENCRYPTION_KEY 같은 문제 패턴 일반화.

### Commits
- `ac1c9c2` — char-level diff 진단 (임시)
- `다음 commit` — project_id 매칭 fix + 진단 로직 정리

### 검증
- backend tsc pass
- 카카오/네이버 정상 (Hotfix1 으로 이미 복구)
- Google 단말 실측 대기 중

---

## 2026-05-04 — Hotfix1: JWT jwtid 중복 해결 (카카오/네이버 500)

> **증상**: T1 배포 직후 카카오/네이버 소셜 로그인 모두 500 에러.
> **로그**: `Bad "options.jwtid" option. The payload already has an "jti" property.`
> **원인**: `jwt.sign({ ..., jti: refreshJti }, secret, { jwtid: refreshJti })` — payload 와 options 양쪽에 jti 동시 지정 → jsonwebtoken 라이브러리가 거부.

### 수정
- `RefreshTokenPayload.jti` 를 sign 시 빼고 verify 결과용 optional 로만 유지
- `jwt.sign({ userId, typ: 'refresh', fam }, secret, { jwtid: refreshJti })` — payload 에서 jti 제거
- jsonwebtoken 의 `jwtid` 옵션이 자동으로 표준 jti claim 추가
- `/refresh` 핸들러에서 narrowing 보존을 위해 `const jti = payload.jti` 추출

### Commit
- `2fe79c1` (또는 유사) — `fix(auth): JWT sign 충돌 해결`

### 검증
- backend tsc pass
- 카카오/네이버 단말 실측 정상 동작 확인

---

## 2026-05-04 — T1 출시 블로커 14건 일괄 fix (commit `ad28dfe`)

> 20-에이전트 종합 감사에서 발견된 🔴 Critical 14건. 정석 방법으로 일괄 처리.
> 18 files changed, +578/-96 lines.

### #1 JWT 알고리즘 핀 + 표준 클레임
- `backend/src/middleware/auth.ts`, `backend/src/middleware/security.ts`, `backend/src/routes/auth.ts`
- `algorithm: 'HS256'` 명시 핀 (sign + verify 모두) — 알고리즘 confusion 공격 차단
- `iss: 'amatda-api'`, `aud: 'amatda-app'` 표준 claim
- `typ: 'access' | 'refresh'` — 토큰 종류를 클레임으로 구분
- 모든 verify 경로에 algorithms/issuer/audience 검증

### #2 Refresh token rotation + reuse detection (RFC 6819)
- `backend/src/services/firestore.ts` — `refreshTokens` 컬렉션 추가
- `backend/src/routes/auth.ts` — Firestore 트랜잭션으로 jti 상태 atomic read+update
- 사용된 jti 재시도 시 **패밀리 전체 무효화** (탈취 방어)
- 정상 회전: 새 jti 발급 + `replacedBy` 추적

### #3 Kakao app_id strict equality
- `backend/src/config/env.ts` — `KAKAO_APP_ID` 추가
- `backend/src/services/social.auth.ts` — `info.app_id !== expected` 시 거부
- 다른 카카오 앱 토큰으로 우리 사용자 가장 시도 차단

### #4 Naver 토큰 검증 강화
- `resultcode === '00'` + `response.id` 명시 검증
- audience namespace 분리 설명 코멘트 강화

### #5 서버측 logout + 계정 삭제 시 JWT 무효화
- `POST /api/auth/logout` — 패밀리 전체 revoke 라우트 추가
- `DELETE /api/auth/account` — refreshTokens 모두 삭제
- 클라이언트 `logout()` — `authApi.logout(refreshToken)` fire-and-forget 호출
- `frontend/services/api.ts` — `authApi.logout` endpoint 추가

### #9 AI prompt injection 방어
- `backend/src/services/coaching/prompt.builder.ts`
- `<<<USER_MESSAGE>>>...<<<END_USER_MESSAGE>>>` 펜스 delimiter
- `[INST]`, `<system>`, `<|tag|>`, `BEGIN/END SYSTEM` 등 control sequence strip
- 길이 제한 2000자
- 임산부 모드 + 일반 모드 양쪽 적용

### #13 응급 경로 Sentry 캡처
- `frontend/app/(main)/labor-monitor.tsx` — 4곳 (kick save, dialPhone, 119 두 번)
- `frontend/app/(main)/sos.tsx` — 3곳 (delivery dial, call119 두 번)
- 모든 응급 경로의 catch 에 `captureError(e, { ctx: ... })` + 메타데이터

### #14 Sentry beforeSend PII scrubber
- `frontend/services/sentry.ts` + `backend/src/services/sentry.ts`
- redact 키: Authorization, Cookie, password, token, refreshToken, accessToken, jwt, secret, phone, email, childName, fcmToken, pushToken, kakao_token, naver_token, google_token, cardNumber, billingKey, raw 등
- 문자열 내 phone-like 패턴은 last 4 digit만 남김
- scrub 실패 시 이벤트 drop (안전 우선)

### #15 ScheduledIds per-child
- `frontend/services/pushNotifications.ts`
- `SCHEDULED_IDS_KEY(childId)` 함수형 키 — 다둥이 가구에서 자녀별 분리
- `PREGNANCY_NOTIF_IDS_KEY(childId)` 동일 처리
- `cancelAllPregnancyLocalNotifications(childId?)` — 자녀별 또는 전체 모드
- `runOneTimeOrphanCleanup` — legacy 글로벌 키 일회성 정리
- 모든 caller (`scheduleCoachingFollowup`, `syncScheduledNotifications`, `syncReengagementNotifications`, `cancelAllChildLocalNotifications`) 마이그레이션

### #16 isHighRiskPregnancy 토글 시 reschedule
- `schedulePregnancyReminders(childId, dueDate, { isHighRisk })` 시그니처
- `PREGNANCY_EXAMS` 에 24주 분만 병원 등록 권유 (고위험 전용 `highRiskOnly: true`)
- 30주 일반 권유 알림
- D-3/D-Day 알림은 `screen: 'labor-monitor'` 로 라우팅 (진통 모니터 직접 진입)
- `frontend/app/(main)/child-edit.tsx` 저장 시 자동 재스케줄

### #17 알림 본문 PII 제거 (잠금화면 노출 방지)
- `pushNotifications.ts` 7곳 모두 `${childName}` → "우리 아기" / "우리 아기의" generic
- `REENGAGEMENT_MESSAGES`, `scheduleMorning`, `scheduleAfternoon`, `scheduleCoachingFollowup`, `scheduleFirstCoachingNudge`, `scheduleNextDayNudge`, `scheduleFeverRecheckReminder` 모두 적용

### #21 home.tsx 35주 reorder Fragment key
- `frontend/app/(main)/home.tsx`
- `<Fragment key="hero">{heroCard}</Fragment>` / `<Fragment key="actions">{actionsGrid}</Fragment>`
- 35주 전후 isLatePregnancy reorder 시 React 가 같은 컴포넌트로 인식 → unmount/remount 방지
- AllActionsGrid 내부 상태 (애니메이션, async state) 보존

### #24 HospitalRegisterModal bare catch 제거
- `frontend/components/pregnancy/HospitalRegisterModal.tsx`
- `} catch (e) { captureError(e, { ctx: 'HospitalRegisterModal/save', tab, childId }); ... }`
- `openMap` 실패도 `captureError` 추가
- CLAUDE.md "에러를 조용히 삼키지 말 것" 준수

### #25 labor-monitor / sos 국제번호 +82 보존
- `frontend/app/(main)/labor-monitor.tsx`, `frontend/app/(main)/sos.tsx`
- `phone.replace(/[^0-9+]/g, '')` — `+` 보존 → `+82-10-...` 같은 국제번호 깨지지 않음

### 검증
- backend tsc pass
- frontend tsc pass
- expo lint 0 errors (warnings 만 162개 — 기존)

### Breaking change 안내
- 이전 access/refresh token (without iss/aud/typ) 무효화 → 사용자 1회 강제 재로그인
- 베타 단계라 영향 최소
- access token 1h 만료, refresh token 7d 만료 — 7일 후 모든 stale 토큰 자동 정리

### 배포
- commit `ad28dfe`
- git push `release/v2.9.0`
- 백엔드 `firebase deploy --only functions:api` ✅
- OTA preview channel `eas update --branch preview` (group `56a17030`) ✅

### 단말 실측 권장 시나리오
1. 재로그인 (기존 토큰 무효화 → 정상 흐름 확인)
2. 카카오/네이버/구글 소셜 로그인 (각각 정상 + 잘못된 앱 토큰 거부)
3. logout API (명시 로그아웃 시 같은 refreshToken 으로 재시도 시 401)
4. 임신 자녀 + 고위험 체크 → 24주 알림 새로 추가 확인
5. 다둥이 가구 → 자녀 1 삭제 시 다른 자녀 알림 살아있는지
6. 잠금화면 → 알림 본문에 아이 이름 안 노출 확인

---

## 2026-05-04 — 20-에이전트 종합 감사

> 사용자 요청: "전문 에이전트 20명 호출해서 전체적으로 확실히 확인해줘"

### 감사 영역 (20건 병렬 실행)

| # | 영역 | 결과 |
|---|---|---|
| 1 | deliveryHospital.ts 전화 라우팅 | 🟡 일부 edge-case + 🟢 대부분 clean |
| 2 | HospitalRegisterModal UX flow | 🔴 race condition 2건 + 🟡 UX 2건 |
| 3 | labor-monitor emergency flow | 🔴 key collision + 🟡 5건 |
| 4 | child.ts backend 스키마 변경 | 🟢 OK + 🟡 audit log 누락 |
| 5 | child-edit.tsx 폼 | 🔴 race + 🟡 다중 |
| 6 | home.tsx IIFE 리팩터 | 🔴 missing keys (T1-#21 처리) |
| 7 | Firestore + Storage rules | 🟢 clean (deny-all + Admin SDK) |
| 8 | 인증/OAuth | 🔴 7건 critical (T1-#1~#5 처리) |
| 9 | 결제/Webhooks | 🟢 강 + 🟡 트랜잭션 atomicity |
| 10 | Sentry 커버리지 | 🔴 emergency 경로 미캡처 (T1-#13/#14 처리) |
| 11 | HospitalRegisterPrompt + Banner | 🔴 a11y + 🟡 race |
| 12 | AI 파이프라인 | 🟡 prompt injection (T1-#9 처리) |
| 13 | Secrets/env 설정 | 🟢 강함 |
| 14 | DenseStatsRow tap counter | 🟡 race + threshold |
| 15 | 알림 라우팅 | 🔴 per-child + PII (T1-#15/#16/#17 처리) |
| 16 | 타입 안전성 (any 사용) | 🟢 최근 수정 4파일 0건 |
| 17 | API client interceptor | 🔴 refresh queue 없음 |
| 18 | Zustand stores | 🔴 race 2건 + 🟡 다수 |
| 19 | expo-router 라우트 가드 | 🔴 premium gate, 온보딩 gate, isHydrated 가드 |
| 20 | 성능/번들 사이즈 | 🔴 4MB PNG 4장, god-files |

### Tier 분류

- **T1 (출시 블로커, 즉시)** 14건 — ✅ 완료 (commit ad28dfe)
- **T2 (결제/Store/API client)** 8건 — pending
- **T3 (라우팅/온보딩 게이트)** 3건 — pending
- **🟡/🟢 후순위** 30+건 — v2.10.0 이월 예정

---

## 2026-05-04 — Batch C: 홈 시각 강약 정리 (commit `2fe92ec`)

> 간호사 출신 기획자 피드백: 35주차 홈 화면 강조 요소가 많아 부담. 강약만 조절.

### C-1 HospitalRegisterBanner 톤 다운
- 일반 임신부: 빨강(`#FFEBEE` / `#E53935`) → 코랄/살구(`#FFF3EC` / `#FFB89A`)
- 아이콘 ⚠️ → 📞 (압박 ↓, "미리 준비하자" 톤)
- 고위험 임신부는 기존 빨강 유지 (안전 우선)

### C-2 "탭해서 기록 · 길게 누르면 가이드" 캡션 폴리시
- `frontend/components/home/DenseStatsRow.tsx`
- 색상 #E91E63 + 보라 강조 → 보조 텍스트 회색(`textSub`) + opacity 0.75
- fontSize 11 → 10, fontWeight 700 → 500
- 누적 기록 3회 이상 시 자동 숨김 (`TAP_HINT_COUNTER_KEY` AsyncStorage per-child)
- `bumpTapHint()` — 물/영양제/컨디션 입력 시마다 +1 누적

### C-3 SOS 버튼 위치 미세 조정
- `frontend/app/(main)/home.tsx`
- 64×64 → 56×56, right 16 → 10
- 출산가방/카드 컨텐츠 가리지 않게

### C-4 35주+ 임신부 홈 우선순위 재배치
- `isLatePregnancy = weeks >= 35` 분기 추가
- 35주+: 오늘체크 → **출산가방** → 아이콘 메뉴 → 임신여정
- 그 외: 오늘체크 → 아이콘 메뉴 → 강조카드 → 임신여정 (기존 순서)

### 검증/배포
- frontend tsc pass, expo lint 0 errors
- commit `2fe92ec` (3 files, +158/-103)
- OTA preview group `87f70478`

---

## 2026-05-04 — Batch B: 등록 UX + 안내 톤 + 전화 모달 개선 (commit `fa7f693`)

> 간호사 출신 기획자 피드백 5건.

### B-5/6 등록 폼 진입 장벽 ↓ + MFICU 라벨 개선
- `frontend/components/pregnancy/HospitalRegisterModal.tsx`
- 필수: 병원명 + "📞 급할 때 바로 연결할 번호"
- 선택 (아코디언): 분만실/산부인과 직통 + 주소 + 메모
- 처음 진입 시 접힌 상태, 기존 데이터 있으면 자동 펼침
- 라벨: "분만실 직통번호 (선택)" → "분만실/산부인과 직통 번호 (선택)"
- 대학병원 sub: "(고위험산모센터(MFICU) 번호를 등록하면 좋아요)"
- 분만실 미입력 후 저장 시 권유 Alert → "직통번호 추가하기" 누르면 아코디언 자동 펼침

### B-8 안내 박스 문구 정비
- 보라색 박스: "낮에는 외래, 밤·휴일엔 분만실! 시간에 맞춰 똑똑하게 연결합니다."
- 노란색 박스 (대학병원): "병원 안내에 따라 가장 빠르게 연결되는 번호를 등록해 주세요. 대학병원은 분만실 또는 고위험산모센터(MFICU) 직통번호 등록을 권장해요." (병원 자율성 존중)
- 사용 안 하는 `warnText` 스타일 제거

### B-9 전화 모달에 병원명 노출
- `frontend/services/deliveryHospital.ts`
- `PickedPhone.hospitalName` 필드 추가
- `buildCandidates` → 각 후보에 `delivery.name` / `clinic.name` 매핑
- 모달: "⭐ 분만실 직통" 아래 "삼성서울병원" 가독성 ↑

### B-7 35주+ 홈 진통 체크 옆 상시 배너 (Phase 5에서 이미 구현)
- ChildSelector 행 바로 아래 HospitalRegisterBanner 배치
- "병원 번호를 미리 등록해 주세요" 문구로 충족됨

### 검증/배포
- frontend tsc pass, expo lint 0 errors
- commit `fa7f693` (3 files, +120/-65)
- OTA preview group `d6b084ef`

---

## 2026-05-04 — Batch A: 안전 critical 4건 (commit `3d61ecc`)

> 간호사 출신 기획자 피드백 — 출시 전 필수 안전 수정.

### A-1 태동 12h 멈춤 → "태동 감소·느껴지지 않음"
- `frontend/app/(main)/labor-monitor.tsx`
- 태동 이상은 시간 기준 기다리지 말고 즉시 병원 — 사산 위험 차단

### A-2 35주 배너 멘트 강화
- "36주 이후 기록 권장" → "36주 전이라도 규칙적 진통/복통 시 기록보다 병원에 먼저 연락"
- 기록하다 골든타임 놓치는 시나리오 차단

### A-3 양수파수 골든타임 모드 (`diagAnswers.ruptured === true`)
- `pickAllPhones / pickDeliveryPhone` 에 `isEmergency` 옵션 추가
- 외래(clinic_main) 후보 자동 제외 → 분만실/MFICU/대표 만 노출
- 119/병원 버튼 대형화 (paddingVertical 14→22, fontSize 16→22)
- 배너 타이틀 "🚨 양수 파수 확인 — 골든타임", 외래 안 받는다는 안내

### A-4 토요일 13시 cutoff (간호사 짬바)
- `isClinicHours` 평일/토요일/일요일 분기:
  - 평일 09-18 외래 / 토요일 09-13 외래 / 일요일 24h 분만실
- TODO: 공휴일 캘린더 연동

### 검증/배포
- frontend tsc pass
- commit `3d61ecc` (2 files, +72/-19)
- OTA preview group `87f70478`

---

## 2026-05-04 — 지능형 SOS 시스템 (고위험 임신 + 대학병원 분기)

> 사용자 요구: 산모 유형(일반/고위험)과 병원 급수(의원/대병)에 따라 응급 안내 강도/임계/우선순위가 자동 분기.
>
> **6단계 정석 구현. 모두 BACKEND tsc + FRONTEND tsc 통과, expo lint 0 errors.**

### Phase 1 — 데이터 모델
- `frontend/services/deliveryHospital.ts` — `HospitalInfo.isUniversityHospital?: boolean` 추가
- `frontend/stores/childStore.ts` — `Child.isHighRiskPregnancy?: boolean` 추가
- `backend/src/routes/child.ts` — formatChild 출력에 `isHighRiskPregnancy` 포함 (Firestore raw → API DTO 매핑), PUT /:id route 에서 boolean validation 후 저장

### Phase 2 — HospitalRegisterModal 대학병원 체크박스 + 조건부 UI
- 분만 탭에서만 "🏥 대학병원(상급종합병원)이에요" 체크박스 노출
- 체크 시 보라색 안내 박스 (낮에도 분만실/MFICU 우선 안내됨)
- 분만실 직통 라벨/플레이스홀더가 "고위험 산모센터(MFICU)/분만실 직통 *" 로 변경 + 미입력 시 빨강 경고
- save 시 `isUniversityHospital` 필드 함께 전송 (delivery 탭일 때만)

### Phase 3 — child-edit.tsx 고위험 체크박스
- 임신 정보 편집 화면(자녀 정보 관리)의 출산예정일 다음에 "⚠️ 고위험 임신이에요" 체크박스 배치
- 체크 시 노란 안내 박스 (24주부터 알림 + 진통 시 더 빠른 응급 안내)
- handleSave 페이로드에 `payload.isHighRiskPregnancy = isHighRiskPregnancy` 추가
- 옛 문서 호환: `isHighRiskPregnancy === true` 비교로 undefined/false 안전 처리
- 추후 수정 가능 — 사용자가 잘못 체크해도 다시 풀 수 있음

### Phase 4 — pickAllPhones 대학병원 분기
- `buildCandidates()` / `buildOrder()` helper 분리로 후보 라벨 + 우선순위가 대학병원 여부에 따라 분기
- 일반 의원/종합병원: 시간대 스위칭 (외래 시간 → 외래 대표, 야간 → 분만실)
- **대학병원 (delivery.isUniversityHospital=true)**: 시간대 무관, 분만실(MFICU) 직통이 항상 1순위. 대표 번호는 "교환 통해 분만실 연결 요청" subLabel
- 라벨도 "분만실 직통" → "고위험 산모센터(MFICU) / 분만실" 자동 변경

### Phase 5 — 24주/30주 임계 분기 + 진통 위급 강조 (고위험)
- `HospitalRegisterPrompt`: 일반 30주+ → 고위험 24주+ 노출 임계 차등화. UI 강조 (빨강 보더, 🚨 아이콘, "고위험 임신 — 병원 등록이 꼭 필요해요" 타이틀)
- `HospitalRegisterBanner`: 일반 35주+ → 고위험 28주+ 노출. 타이틀/문구 분기
- `home.tsx`: 두 컴포넌트에 `isHighRisk={child.isHighRiskPregnancy === true}` 전달
- `labor-monitor.tsx` emergency banner: 고위험이면 짙은 빨강 + "🚨 고위험 임신 — 위험 신호 시 즉시 119" 톤으로 자동 전환

### Phase 6 — 진통 화면 [등록하기] 강제 버튼
- `labor-monitor.tsx`: 화면 마운트 시 `pickAllPhones` 으로 등록 여부 사전 조회 (`hasRegisteredHospital`)
- 미등록 시 emergency banner 안에 "🏥 분만 병원이 아직 등록되지 않았어요 — 지금 등록하기 ›" 버튼 강제 노출
- `callDeliveryWard` 미등록 분기: 단순 Alert → "119 전화 / 병원 등록 / 취소" 3-way Alert. 등록 선택 시 `HospitalRegisterModal` 즉시 오픈
- 등록 완료 onSaved 콜백에서 `refreshHospitalRegistered()` 호출 → 버튼 자동 사라짐

### 검증
- `cd backend && npx tsc --noEmit` — 통과
- `cd frontend && npx tsc --noEmit` — 통과
- `cd frontend && npx expo lint` — 0 errors (기존 warning 만 존재, 신규 코드 무관)

### 수정 파일
- `frontend/services/deliveryHospital.ts`
- `frontend/stores/childStore.ts`
- `frontend/components/pregnancy/HospitalRegisterModal.tsx`
- `frontend/components/pregnancy/HospitalRegisterPrompt.tsx`
- `frontend/components/pregnancy/HospitalRegisterBanner.tsx`
- `frontend/app/(main)/child-edit.tsx`
- `frontend/app/(main)/home.tsx`
- `frontend/app/(main)/labor-monitor.tsx`
- `backend/src/routes/child.ts`

### 남은 작업
- 백엔드 배포 (child route DTO 변경)
- OTA preview 채널 push (frontend UI)
- 사용자 단말 실측: 고위험 토글 → home에서 24주차에 prompt 노출 확인, labor-monitor에서 등록하기 버튼 작동 확인

---

## 2026-05-04 — 출시 전 종합 보안 강화 (배포 대기 중)

> 사용자가 "출시 늦어도 좋으니 위험요소 단계별 처리" 결정 → 결제 webhook 보안 / 결제 멱등성 / Sentry 커버리지 / 에셋 압축 / Firebase Secret Manager 마이그레이션 일괄 처리.
>
> **현재 상태: 모든 코드 변경 + secret 등록 완료. 배포 대기 중.**

### A. 결제 라우트 보안 강화 (3건)

**문제:** webhook 서명 검증이 우회 가능했음. 가짜 webhook 으로 사용자 결제 status 조작 가능.

1. **PortOne webhook raw body + 서명 검증**
   - 기존: `JSON.stringify(req.body)` 로 HMAC 계산 → 키 순서/공백 차이로 검증 실패
   - 기존: `webhook-id` 헤더 없으면 검증 자체 스킵 (우회 가능)
   - 기존: `PORTONE_WEBHOOK_SECRET` 미설정 시 무조건 통과
   - 변경: `index.ts` 의 `express.json` `verify` 콜백으로 `req.rawBody` Buffer 보존 → HMAC 정확 계산
   - 변경: 서명 헤더 누락 시 401 거부, secret 미설정 시 fail-closed
   - **live test 통과**: req.body 정상 파싱 + req.rawBody 원본 byte 일치 확인

2. **Google Pub/Sub OIDC JWT 검증**
   - 기존: 인증 없이 `messageData` 처리 → 누구나 직접 호출로 사용자 구독 조작 가능
   - 변경: `google-auth-library` 의 `OAuth2Client.verifyIdToken({audience})` 으로 OIDC 검증
   - 환경변수 `GOOGLE_PUBSUB_AUDIENCE` (필수), `GOOGLE_PUBSUB_SA_EMAIL` (선택)
   - fail-closed: audience 미설정 시 모든 webhook 거부

3. **Apple webhook Apple API 재조회 검증**
   - 기존: JWS payload 디코딩만 + `notificationType` 으로 status 결정 → 가짜 webhook 으로 EXPIRED 마크 가능
   - 변경: Google webhook 과 동일 패턴 — `signedTransactionInfo` 에서 `originalTransactionId` 만 추출
   - **Apple App Store Server API 재조회** 로 진위 검증 (위조된 originalId 는 Apple 이 거부)
   - bundleId 매칭 검증 추가
   - Apple JWS 정석 검증 (`@apple/app-store-server-library` + Apple Root CA) 은 별도 PR 로 미룸

### B. 결제 멱등성

**문제:** `paymentDocId = genId()` — 같은 `paymentId` 두 번 verify 호출 시 payments 문서 두 개 생성 + 사용자 활성화 두 번 실행.

**해결:** `paymentDocIdFor(platform, key)` 헬퍼 추가 — `${platform}_${SHA256(key)}` 형식으로 doc ID 생성. 같은 키는 항상 같은 docId → 두 번째 호출은 멱등 응답으로 처리.

3개 verify 엔드포인트 모두 적용 (PortOne 1회결제 / 빌링키 / IAP).

### C. payments 컬렉션 인덱스 추가

**문제:** `payment.history` 의 `where('userId').orderBy('createdAt desc')` 복합 인덱스 없음 → 첫 호출 시 500 에러.

**해결:** `firestore.indexes.json` 에 추가:
```json
{ "collectionGroup": "payments", "fields": [{"fieldPath":"userId","order":"ASCENDING"},{"fieldPath":"createdAt","order":"DESCENDING"}] }
```

### D. Sentry 커버리지 확대 (~50% → 100%)

**문제:** 코드 전반 `console.error` 44건 → Sentry 자동 전파 안 됨.

**해결:** 19개 파일 일괄 치환 — `console.error` → `logger.error` (Sentry 자동 전파).
파일: clinic / memories / growth / sleep / tracker / upload / momstagram / chatbot / gemini.client / proactive.insight / album / child / rateLimit / coaching/ask / dailyDiary / dailyInsight / history / weeklyReport / auth.

추가로 logger.ts 자체에 `import { logger } from '../utils/logger'` 누락 16개 파일 import 추가.

### E. Sentry flush 이중 안전망

**문제:** Cloud Functions 는 응답 종료 후 컨테이너가 곧바로 frozen → Sentry 비동기 큐가 마지막 요청 이벤트를 못 보낼 수 있음.

**해결:** `sentry.ts` 에:
- `captureException` 안에서 `Sentry.flush(2000)` fire-and-forget
- `flushOnFinishMiddleware()` — Express `res.on('finish')` 시 추가 flush
- index.ts 양쪽 app 에 부착

### F. /api/coaching rate-limit userId 키

**문제:** keyGenerator 가 `req.userId` 보지만 rate-limit 미들웨어는 authMiddleware 보다 먼저 실행 → 항상 IP 키로 fallback. 한국 통신사 CG-NAT 환경에서 다수 사용자가 같은 IP 로 묶여 false rate-limit 가능.

**해결:** `security.ts` 에 `rateLimitUserKey(req)` 헬퍼 추가 — JWT 를 가볍게 디코드 (DB 무접근) 해서 userId 키 산출. 위변조/만료된 토큰은 IP 키로 fallback.

### G. 출산가방 공유 페이지 CORS fix (운영 에러 발견)

**문제 (운영 로그):** `Error: CORS: origin not allowed: https://api-usglfifguq-uc.a.run.app` 6건.
- 출산가방 공유 페이지가 백엔드 자기 호스트에서 렌더링되고 fetch 호출 → 모바일 브라우저가 same-origin POST 에서도 preflight 보냄
- security.ts 의 CORS allowlist 에 운영 호스트 자기 자신이 없어서 거부됨
- 사용자가 항목 체크 시 "업데이트 실패" alert 발생

**해결:** `security.ts` allowlist 에 `https://api-usglfifguq-uc.a.run.app`, `https://coachingapi-usglfifguq-uc.a.run.app` 명시 추가 + `*.a.run.app` / `*.cloudfunctions.net` 정규식으로 일반 Cloud Run/Functions 호스트 자동 허용.

### H. birthbag-share 항목 업데이트 rate-limit

토큰 보유자 누구나 무한 호출 가능했던 문제 — 토큰 단위 30/분 제한 추가.

### I. firebase.json functions.ignore 보강

`scripts`, `src`, `tsconfig.json`, `tsconfig.tsbuildinfo`, `**/*.test.ts`, `**/*.spec.ts` 추가 — 함수 패키지 슬림화. 일회성 마이그레이션 스크립트 + ts 소스가 더 이상 deploy 안 됨.

⚠️ `.env` 도 한 번 추가했다가 즉시 되돌림 — backend/.env 가 dotenv 로 운영 환경변수 공급원이라 ignore 시 부팅 실패. Phase 5 (Secret Manager 마이그레이션 완료 후) 에 다시 추가 예정.

### J. Pretendard 폰트 제거

`backend/fonts/Pretendard-*.otf` 4개 (6.4MB) 제거 — 백엔드 src 에서 미참조 (album.pdf.service.ts 는 NotoSansKR 사용). 함수 패키지 6.4MB 슬림화.

### K. dead set-nickname 제거

`(auth)/set-nickname.tsx` 라우트 호출자 0건 — 실사용은 `onboarding/set-nickname.tsx`. 파일 삭제 + `(auth)/_layout.tsx` 분기 정리.

### L. 프론트 에셋 91% 압축 (41MB → 3.7MB)

**문제:** `quick-*.png` 7개 + `preg-*.png` 13개가 모두 1024x1024 / 1.3-1.6MB. 표시 크기는 80-200px 인데 원본 해상도 4-12배 과도.

**해결:** 기존 `frontend/scripts/optimize-assets.js` (sharp 기반) 활용:
- 카테고리별 캡: quick-* → 192px, preg-* → 512px, mascot → 640px, sos → 512px
- PNG 재인코딩 + palette quantization (256 색)
- in-place 변경, 원본은 `frontend/assets.backup/v2.9.0-pre-resize/` 자동 백업
- **결과: 78개 PNG, 41MB → 3.7MB (-91%)**, 코드 변경 0
- 빅 위너: sos-burn-fall (1.79MB → 76KB), main.png (1.09MB → 71KB), preg-mood-* (각 1.4MB → 30-45KB)

### M. Firebase Secret Manager 마이그레이션 (Phase 1-4 완료)

**배경:** backend/.env 가 deploy 패키지에 평문으로 포함되어 Cloud Functions 컨테이너 안에 그대로 저장됨. JWT_SECRET / PASSPORT_SALT / 소셜 로그인 키 등 16개 민감값 노출 위험.

**진행:** Firebase Functions Secret Manager (KMS 암호화 + 접근 감사) 로 단계별 마이그레이션.

**Phase 1 — TOKEN_ENCRYPTION_KEY 신규 등록**
- 32바이트 hex 자동 생성 + 등록 (이전엔 미설정 → 소셜 access_token 평문 저장)
- 효과: 소셜 토큰 AES-256-GCM 암호화 활성화 (배포 후)

**Phase 2-4 — 기존 13개 secret 마이그레이션**
- backend/.env 값을 grep + pipe 로 직접 읽지 않고 stdin 으로 firebase 에 전달 (값 화면 노출 0)
- 등록 완료: SENTRY_DSN_BACKEND, GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, KAKAO_JAVASCRIPT_KEY, KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET, KAKAO_ADMIN_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, JWT_SECRET, JWT_REFRESH_SECRET, PASSPORT_SALT
- **총 14개 secret Secret Manager 등록 완료**

**코드 변경:** `index.ts` 양쪽 함수 (api / coachingApi) 의 `onRequest` 옵션에 `secrets: REGISTERED_SECRETS` 추가 — Firebase 가 함수 시작 시 process.env 에 자동 주입.

**호환성:** backend/.env 도 그대로 유지 (이중 fallback). 배포 후 Secret Manager 가 우선, 동작 검증 통과하면 Phase 5 진행.

**보류 (결제사 승인 후 등록 예정):**
- PORTONE_API_SECRET, PORTONE_WEBHOOK_SECRET, PORTONE_STORE_ID, PORTONE_CHANNEL_KEY_TOSS/KAKAO/NAVER (PortOne 가입 승인 대기 중)
- GOOGLE_PUBSUB_AUDIENCE, GOOGLE_PUBSUB_SA_EMAIL (Google Play 결제 도입 시)
- GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (동일)
- APPLE_BUNDLE_ID, APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (Apple 결제 도입 시)

### 검증
- backend tsc --noEmit: EXIT 0 (모든 단계)
- frontend tsc --noEmit: EXIT 0
- frontend expo lint: 0 errors / 162 warnings (모두 기존)
- secret 등록 14개 모두 ENABLED 상태 확인

### 배포 결과 (2026-05-04)

**firestore 인덱스 배포** ✅
- payments 컬렉션 (userId ASC, createdAt DESC) 추가 빌드 완료

**functions 배포 — 4차 시도만에 성공** (시행착오 기록):

1차 ❌: `Secret environment variable overlaps non secret environment variable: JWT_SECRET`
- 원인: backend/.env 가 deploy 패키지에 있어 일반 env vars 로 등록되어 있는데, 같은 이름을 secret env 로 추가 시도 → 충돌

2차 ❌: 동일 에러
- firebase.json 에서 `.env` 만 ignore 추가 → 일반 env vars 가 자동 제거되지 않음 (Firebase 가 .env 없으면 기존 vars 보존)

3차 ❌: `dist/src/index.js does not exist`
- firebase.json ignore 의 `src` 패턴이 gitignore-style 로 모든 디렉토리 매칭 → `dist/src` 도 제외돼 빌드 산출물 사라짐

4차 ✅: 성공
- ignore 패턴을 `/src`, `/scripts`, `/tsconfig.*` 로 명시 (루트만)
- backend/.env 에서 14개 secret 키 → backend/.env.local 로 분리
- backend/.env 는 일반 변수(APP_PORT/MOCK_AI/MOCK_SOCIAL)만 보존
- env.ts 의 dotenv 가 .env + .env.local 둘 다 로드 (override:true)
- 빈 secret 키들이 deploy 시 일반 env vars 자동 제거 + secret env vars 14개 적용

**검증 결과:**
- api / coachingApi `/api/health` 200 OK
- 새 revision `api-00202-sus` ACTIVE 상태
- secret env 14개 모두 Cloud Run service config 에 정상 등록
- STARTUP TCP probe succeeded 확인 (18:05:49)
- 이전 함수 시작 시 발생하던 `[sentry] SENTRY_DSN_BACKEND 미설정` warn 더 이상 발생 안 함

**5차 배포 (긴급 핫픽스):**
- 사용자 카카오/네이버/구글 로그인 모두 500 에러 보고
- 운영 로그 분석: `TOKEN_ENCRYPTION_KEY 형식 오류: hex 64자 필요. 현재 길이: 65`
- 원인: 처음 등록 시 `node -e "console.log(...)"` 사용 → console.log 끝 newline(\n) 1자 포함되어 65자로 등록
- 해결 1: TOKEN_ENCRYPTION_KEY v2 새 버전 등록 (`process.stdout.write` 로 newline 없이)
- 해결 2: backend/src/utils/crypto.ts 의 loadKey() 에 `.trim()` 방어 추가 — Secret Manager 값에 leading/trailing whitespace 가 들어와도 안전
- 5차 배포 후 사용자 재테스트: **카카오/네이버/구글 3개 모두 로그인 성공 확인**

**최종 파일 상태:**
- backend/.env (deploy 됨): APP_PORT, MOCK_AI, MOCK_SOCIAL (일반 변수만)
- backend/.env.local (deploy 제외, git 제외): 14개 secret 키 (로컬 개발용)
- backend/.env.backup-pre-secret-migration (deploy/git 제외): 마이그레이션 전 원본 백업
- Firebase Secret Manager: 14개 secret 등록 완료
- 코드: index.ts 의 REGISTERED_SECRETS 배열 + 양쪽 함수 secrets 옵션

### 남은 작업

1. **사용자 직접 검증**:
   - 출산가방 공유 페이지 항목 체크/상태 변경 정상 동작 확인 (CORS fix 효과)
   - 카카오/네이버/구글 로그인 정상 동작 (secret 정상 주입 확인)
   - 새 사용자 가입 → 소셜 access_token 암호화 저장 확인 (선택)
2. **결제사 승인 후 등록 예정 (Phase 별도)**:
   - PortOne 가입 승인 후: PORTONE_API_SECRET, PORTONE_WEBHOOK_SECRET, PORTONE_STORE_ID, PORTONE_CHANNEL_KEY_*
   - Google Play 결제 도입 시: GOOGLE_PUBSUB_AUDIENCE, GOOGLE_PUBSUB_SA_EMAIL, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
   - Apple 결제 도입 시: APPLE_BUNDLE_ID, APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
   - 등록 후 index.ts 의 REGISTERED_SECRETS 에 추가 + 재배포

---

## 2026-05-04 (00:00~) — 백엔드 Sentry 자동 수집 + 매일 8시 자동 점검 routine

### A. 백엔드 Sentry 자동 수집 활성화

**문제:** 프론트(Expo)는 `@sentry/react-native` 으로 자동 수집되지만 백엔드(Firebase Functions) 는
Cloud Logging 까지만 — 실시간 알림 / 스택 트레이스 분류 / 빈도 분석 없었음.

**구현:**
- `npm install @sentry/node` (v10.51.0)
- 신규 `backend/src/services/sentry.ts` — `initSentry()` / `attachSentryErrorHandler(app)` / `captureException()`
- `backend/src/index.ts` 최상단에서 `initSentry()` 호출 (다른 import 보다 먼저)
- 두 Express 앱(api, coachingApi) 모두 `attachSentryErrorHandler` 부착
- `backend/src/utils/logger.ts` → `logger.error` 가 자동으로 `Sentry.captureException` 호출
  → 기존 라우트 코드 수정 0줄. 라우트 안 `logger.error('context', err)` 호출 전부 자동 Sentry 전파

**환경변수:**
- `SENTRY_DSN_BACKEND` (`backend/.env` 추가) — 프론트와 동일 Sentry 프로젝트 DSN 사용
- 미설정 시: warn 로그만 + capture 모두 no-op (회귀 0)
- 보호: PII 자동 첨부 끔 (`sendDefaultPii: false`), tag `runtime: 'backend'` / `service: K_SERVICE`
- traces sample 10% (성능 트레이싱 가벼움)

**배포:**
- `cd backend && npm run build && firebase deploy --only functions`
- 1차 시도 직후 재배포 시 HTTP 409 (Cloud Functions 큐 충돌) → 잠시 후 재시도 성공
- 두 함수 (api, coachingApi) 모두 `Successful update operation` ✅

### B. 매일 아침 8시 KST 자동 점검 routine (별도 세션에서 생성)

**목표:** 매일 한 번 운영 에러 자동 점검 + 단순 fix 자동 / 위험 항목 보고 파일.

**준비 작업 (이 세션에서):**
- Sentry MCP 커넥터 본인 계정 연결: https://claude.ai/customize/connectors
- 첫 시도 시 이 대화 세션이 연결 전 스냅샷을 캐시해 인식 못 함 → 새 채팅 세션 안내

**실제 routine 생성: 별도 채팅 세션에서 `/schedule` 으로 진행**
- 새 세션은 fresh 커넥터 목록 로드 → Sentry MCP 자동 attach 가능
- 이 세션은 정리/기록 담당

**routine 사양 (별도 세션 진행 내용):**
- 모델: claude-sonnet-4-6
- 레포: `https://github.com/syh9912-cyber/amatda`
- 환경: `env_01YcDVdCMjMcReC3Z5myt1FD` (기본 클라우드)
- 스케줄: 8am KST = `0 23 * * *` UTC

### 종합 검증
- `cd backend && npx tsc --noEmit` — EXIT 0
- 운영 배포: api / coachingApi 모두 정상 갱신
- Sentry init 로그: 운영에서 DSN 인식 후 silent 활성 (테스트 에러 발생 시 대시보드에 도착 확인 가능)

### 본인이 추가로 해야 할 일 (선택)
1. **`TOKEN_ENCRYPTION_KEY` 등록** — 소셜 access_token 암호화 활성 (#3 작업 후속)
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   firebase functions:secrets:set TOKEN_ENCRYPTION_KEY
   ```
2. **Sentry 대시보드에서 Alert Rule 설정** — 새 issue 발생 시 메일/슬랙 알림
3. **매일 routine 결과 확인** — `daily-checkup-YYYY-MM-DD.md` 또는 Sentry 정리 결과 commit 검토

---

## 2026-05-03 (심야) — 보안 강화 3건 (storage 검증 / 소셜 race / 토큰 암호화)

앞선 리뷰에서 Rule of Two 로 보류했던 3건 모두 처리.

### #1 storage.rules — 검증 → URL 재작성 → rules 닫기 → 배포 (전 단계 완료)

**작성한 파일:**
- `backend/scripts/audit-storage-urls.cjs` — Storage 메타 + Firestore URL 양쪽 토큰 보유 검사
- `backend/scripts/rewrite-firestore-urls.cjs` — 토큰 누락된 Firestore URL 에 `?alt=media&token=<UUID>` 부착 (--dry / --apply)

**실행 결과:**
1. `audit-storage-urls.cjs` 1차: A) Storage 78/78 PASS / B) Firestore 46건 누락 (albumPhotos 20, milestonePhotos 20, momGroupPosts 3, children 2, posts 1)
2. `rewrite-firestore-urls.cjs --apply`: 26 docs / 46 URLs 재작성, 실패 0
3. `audit-storage-urls.cjs` 2차: A/B 모두 100% PASS
4. `storage.rules` 7개 경로 (`pregnancy`, `profiles`, `momstagram`, `diary`, `album`, `lullaby`, `growth_albums`) 모두 `allow read: if true` → `allow read: if false`
5. `firebase deploy --only storage` — Deploy complete ✅

**효과:**
- 익명 사용자가 경로 추측으로 사진/PDF 직접 받기 차단
- 정상 토큰 URL (`?alt=media&token=<UUID>`) 은 storage.rules 와 무관하게 그대로 동작 → 운영 사진 깨짐 0건

### #2 소셜 가입 race condition — Firestore Transaction + 결정적 인덱스

**문제:** `/social`, `/social-code`, `/kakao/callback` 세 곳이 50ms 내 동시 호출 시
같은 socialId 로 user 두 개 생성될 수 있음 (TODO 주석으로 명시되어 있던 항목).

**해결 구조:**
- `socialIdIndex/{provider}_{socialId}` 결정적 ID 인덱스 컬렉션 도입 (firestore.ts collections 추가)
- 새 헬퍼: `backend/src/services/socialUser.service.ts` → `findOrCreateSocialUser()`
- `db.runTransaction` 안에서 인덱스 → socialId query → email 매칭 → 새 user 순으로 처리
- 두 동시 요청이 같은 인덱스 id 로 set 시도하면 transaction 이 retry → 한쪽이 기존 user 발견

**변경한 파일:**
- `backend/src/services/firestore.ts` — `socialIdIndex` 컬렉션 추가
- `backend/src/services/socialUser.service.ts` — 신규
- `backend/src/routes/auth.ts` — `/social`, `/social-code`, `/kakao/callback` 헬퍼 사용으로 단순화 + TODO 주석 제거

**호환성:**
- 기존 가입자 (인덱스 없음) → 첫 로그인 시 socialId query 매칭 → 인덱스 lazy 생성
- 인덱스만 남고 user 삭제된 고아 케이스 → 인덱스 덮어쓰기로 새 user
- DELETE /account 에 socialIdIndex 삭제 추가 → 재가입 시 깨끗한 상태

### #3 소셜 access_token Firestore 암호화 (AES-256-GCM)

**문제:** `lastSocialAccessToken` 평문 저장. Firestore export 유출 시 모든 사용자
카카오/네이버 access_token 노출. (Naver/Google unlink 가 access_token 필수라 제거 불가.)

**해결:**
- `backend/src/utils/crypto.ts` — AES-256-GCM 암복호화 유틸
- `encryptToken()` / `decryptToken()` — `gcm:<iv>:<ct>:<tag>` 형식
- 환경변수 `TOKEN_ENCRYPTION_KEY` (hex 64자 = 32바이트)
- **옵션:** 키 미설정 시 평문 통과 + warn 로그 (회귀 없음). 운영 강화 시 secret 등록.
- 복호화는 `gcm:` prefix 감지 → legacy 평문도 그대로 반환 (점진적 마이그레이션)

**변경한 파일:**
- `backend/src/utils/crypto.ts` — 신규
- `backend/src/routes/auth.ts` — 저장 3곳 (`/social`, `/social-code`, `/kakao/callback`) `encryptToken()`,
  DELETE /account unlink 흐름에 `decryptToken()`

**운영 배포 전 권장:**
```bash
# 32바이트 hex 키 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 출력값을 EAS / Cloud Run / Firebase Functions secret 으로 등록
firebase functions:secrets:set TOKEN_ENCRYPTION_KEY
```

### 검증
- `cd backend && npx tsc --noEmit` — EXIT 0
- `cd frontend && npx tsc --noEmit` — EXIT 0
- `cd frontend && npx expo lint` — EXIT 0

### 부수 정리
- auth.ts 의 `console.error` / `console.log` (kakao/callback, deleteAccount unlink) 모두 logger 로 변경

---

## 2026-05-03 (밤) — 출시 전 종합 리뷰 + 안전한 fix 일괄 적용

전체 코드베이스 보안·구조 검토 후 위험 낮은 5건 수정. 구조 변경이 필요한 항목은 별도 승인 대기.

### 통과 (정상 항목)
- backend/frontend tsc --noEmit, expo lint 모두 EXIT 0
- Firestore rules 클라 직접 접근 전면 차단 (`allow read, write: if false`)
- JWT_SECRET / PASSPORT_SALT — env 미설정 시 throw (fail-closed)
- AI 파이프라인 순서 정확 (redflag → RAG → trait → Gemini)
- 출산가방 공유 페이지 escapeHtml + jsonForScriptTag XSS 방어
- /api/seed 라우트 제거 확인
- `any` 타입 / `onSnapshot` / 사주·오행 UI 노출 모두 0건

### 수정 적용

**P1 — 운영 디버깅 / 보안**

1. `auth.ts` 빈 catch에 logger 추가 — register/login/refresh/nickname/me/change-password/set-password
   - 운영에서 회원가입·로그인 실패 원인 추적 가능
2. bcrypt rounds 10 → 12 — register, change-password, set-password
3. `/api/coaching/*` 전용 rate limit 추가 — 사용자당 60회/15분 (Gemini 빌링 폭주 방어)
   - keyGenerator: 인증 후 userId, 미인증 IP
4. `useLoginHandlers` console.log에서 email 제거 — Sentry breadcrumb PII 유출 방지
5. `birthbag-share` items 상한 200 → 100 (주석과 일치)

### 보류 (Rule of Two — 별도 승인 필요)

- **storage.rules `allow read: if true` 제거** (P0)
  - 사유: 토큰 백필 검증 없이 닫으면 기존 운영 사진/PDF 모두 403
  - 필요 작업: 백필 객체 비율 실측 → 0건 미적용 확인 → 단계별 전환
- **소셜 가입 race condition transaction** (auth.ts /social, /social-code, /kakao/callback)
  - 사유: socialId 기반 인덱스 컬렉션 도입 또는 doc ID 전략 변경 = 인증 흐름 핵심 구조 변경
  - 현재 TODO 명시 상태 유지. 별도 PR 권장
- **소셜 access_token Firestore 평문 저장**
  - 사유: 제거 시 unlink 흐름(KAKAO_ADMIN_KEY 미설정 환경) 영향. 정책 결정 필요

### 검증
- `cd backend && npx tsc --noEmit` — EXIT 0
- `cd frontend && npx tsc --noEmit` — EXIT 0
- `cd frontend && npx expo lint` — EXIT 0 (162 warnings 모두 기존, 신규 0)

---

## 2026-05-03 (오후/저녁) — 출시 준비 마지막 단계: 브랜드 + 인증 + APK

오전 작업 후 오후/저녁에 진행한 출시 직전 작업 모음.

### A. 새 브랜드 아이덴티티

**앱 아이콘 (rembg AI 배경 제거 + 정사각 크롭)**
- `assets/amatda.png` — 사용자 제공 원본 (1698×926, 흰 배경)
- `assets/login-hero.png` — 배경 투명 + 캐릭터+책 영역만 크롭 (692×658, 비율 1.05)
- `assets/icon.png` — iOS opaque 피치 배경(#FFF5EC) + 캐릭터+책만 88% 영역
- `assets/adaptive-icon.png` — Android transparent foreground (동일 크롭)
- `app.json` adaptiveIcon backgroundColor #FFFFFF → #FFF5EC

**로그인 화면 리뉴얼**
- AppNameDisplay (아맞다 텍스트) + tagline 제거
- 캐릭터 일러스트만 + 그라디언트 배경 (#FFF5EC → #F8FAFD)
- 여러 차례 사이즈 조정 후 SW * 0.85 width / SW * 0.81 height (중간값) 정착
- AuthInput 56→46px, borderRadius 16→12, fontSize 16→14
- 로그인 버튼 48→44px, fontSize 14, fontWeight 700
- marginTop 60 (status bar 아래 여유)

### B. Sentry 에러 자동 추적 활성화

**SDK 설치 + 설정**
- `@sentry/react-native` 이미 설치
- `services/sentry.ts` DSN 하드코딩 fallback (OTA로 즉시 활성화)
- DSN: `https://dd7124a12d7082892c04cee84ecc0aac@o4511325473865728.ingest.us.sentry.io/4511325488873472`
- EAS env에 `EXPO_PUBLIC_SENTRY_DSN` 등록 (preview/production)

**자동 추적 통합**
- `Sentry.reactNavigationIntegration` 등록 — Expo Router 화면 이동 자동 추적
- `Sentry.wrap(RootLayout)` — 모든 unhandled error 자동 캡처 + Touch event 추적
- `screenshot 첨부` + `네이티브 frames tracking`

**사용자 식별 연동**
- `authStore.setAuth` → `sentrySetUser(userId, email)`
- `authStore.logout` → `sentryClearUser()`
- `authStore.hydrate` → 앱 재시작 시 사용자 복원

**Source Map 자동 업로드 (Auth Token)**
- Sentry Auth Token 발급 + EAS Secret `SENTRY_AUTH_TOKEN` 등록 (preview/production)
- `app.config.js` plugins에 `@sentry/react-native/expo` 등록
- 다음 APK 빌드부터 source map 자동 업로드 → 운영 스택 트레이스 가독성 ↑

### C. 보안 + 인증 마무리

**Naver Client Secret 회전**
- 새 시크릿 발급 → EAS env `EXPO_PUBLIC_NAVER_CLIENT_SECRET` 등록 (sensitive)
- 이전 노출됐던 secret 무효화 효과

**Storage 백필 — 78개 객체**
- `backend/scripts/backfill-storage-tokens.cjs --apply`
- 기존 firestore-backup-2026-04-30, growth_albums, pregnancy 객체 모두 토큰 메타데이터 추가
- storage.rules 강화 가능한 기반 마련

**Firestore TTL — 스킵**
- `share_birthbag` 컬렉션에 첫 문서 생성 후 활성화 예정
- 출시 후 첫 사용자가 공유하면 그때 적용

**출생일 암호화 — 영구 스킵**
- 분석 결과: Firestore 기본 암호화로 충분, 앱 레벨 암호화는 효과 미미 + 30곳 코드 수정 위험 ↑
- 한국 PIPA상 일반 개인정보 분류 (민감정보 X)

### D. 개인정보 처리방침 — 네이버 검수 대비

**`public/privacy.html` + `app/(main)/privacy.tsx` 동기화 보강**
- 새 섹션 "1-1. 소셜 로그인 정보 처리"
  · 카카오/네이버/구글 각각 수집 정보, 이용 목적, 보유 기간, 처리방침 URL
  · 회원 탈퇴 시 unlink 요청 명시
- 1번 (수집 항목) 보강: 소셜 로그인 + 푸시 토큰 + 커뮤니티 닉네임
- 8번 (위탁) 보강: Sentry, Kakao Corp, NAVER Cloud, Google LLC + **국외 이전 고지** (개인정보보호법 제28조의8)
- 배포: https://amatda-parenting.web.app/privacy 갱신 + OTA로 인앱 화면 동기화

### E. 출산가방 공유 — 4번의 fix

**Fix 1: undefined 필드 거부** (Firestore)
- `sanitizedItems` 안 `hint: undefined` → Firestore가 거부 → 모든 공유 silent 500
- 조건부 추가로 변경 (hint 있으면만 포함)
- `logger.error` 호출 호환성 fix (잘못된 인자 전달 → safeStringify로 JSON.stringify)

**Fix 2: CSP가 인라인 스크립트 차단**
- 글로벌 helmet `script-src 'self'` → 공유 페이지 인라인 JS 차단 → 항목 리스트 빈 화면
- 이 endpoint만 CSP 완화 (`'unsafe-inline'`) — XSS는 escapeHtml + jsonForScriptTag로 방어 완료

**Fix 3: 체크 ↔ 상태 자동 동기화 (앱)**
- `toggleChecked`: ✓ → 'packed' / ✗ → 'packed'였으면 'ready'로 다운그레이드
- `setItemStatus`: 'packed' → 자동 ✓ / 그 외 → 자동 ✗

**Fix 4: 공유 받은 사람도 인터랙티브** (단방향 → 양방향)
- 신규 endpoint `POST /api/birthbag-share/:token/items/:itemId` (트랜잭션 atomic)
- 공유 페이지 HTML: 체크박스 + 상태 버튼 클릭 시 즉시 백엔드 업데이트
- 진행률/chip 실시간 갱신
- 가족이 가방에 넣으면 즉시 반영

### F. 맘스톡 공식 계정 시드 글 — 각자 다른 셋

**스크립트 리팩토링**
- `backend/scripts/seed-official-posts.cjs`
- POSTS_A (운영팀 페르소나): 정보 8 + 모유 균형 정보 1 + 공지 1 = 10개
- POSTS_B (도우미 페르소나): 질문 4 + 수다 4 + 공감 1 + 챌린지 1 = 10개
- 계정 사전순 인덱스로 자동 분배 (재실행 시 매핑 안정)
- `--cleanup` 모드 추가 — `_seedKey` 있는 글 일괄 삭제 (재시작 용이)

**실행 결과**
- 공식 계정 2개 발견 ("아맞다 공식" + "아맞다공식")
- 기존 중복 20개 cleanup → 신규 unique 20개 작성

### G. 자녀 미등록 사용자 월방 접근

- `mom-group.tsx`: 자녀 birthDate 없으면 현재 월(YYYY-MM)을 myGroupKey로 fallback
- 공식 계정(자녀 없음)도 월방 진입 + 글쓰기 가능

### H. 401 무한루프 fix

- `subscription.ts`, `auth.ts`: 토큰 유효한데 userDoc 없는 경우 → **404 → 401 변경**
- 프론트 axios interceptor가 401 자동 logout 처리 → OTA 다이얼로그 무한 루프 해소

### I. APK 빌드 — 여러 차례

- `eb58d56f` (취소) — 새 아이콘 + 로그인 변경 적용 전이라 취소
- `a11bd1f1` — 새 아이콘 + 로그인 화면 + Pretendard + Sentry
- `f204c77e` — 아이콘 재크롭 (전체 콘텐츠) + 로그인 텍스트 제거
- `59c615ac` — **최종**: 아이콘 캐릭터+책만 (별/배너 제거) + 88% 영역

### 검증
- `cd backend && npx tsc --noEmit` ✅ EXIT=0
- `cd frontend && npx tsc --noEmit` ✅ EXIT=0
- 백엔드 배포: 5+회 (보안 fix, isOfficial, 폴백, 핀, 401 fix, CSP fix, 인터랙티브 share)
- 프론트 OTA: 30+회 (preview 채널)

### 남은 작업 (사용자)
1. **카카오 콘솔 로고 업데이트** (5분, 즉시 가능)
2. **네이버 검수 신청** — 캡처 9개 + privacy URL + 새 아이콘 첨부
3. **Google OAuth 확인 신청** — 사용자 100명 가까워질 때
4. **Firestore TTL** — 첫 출산가방 공유 발생 후
5. **Storage backfill 추가** (선택, 새 사용자 사진 늘어날 때)

### 메모
- Sentry source map 다음 빌드부터 자동 업로드 (Auth token 등록 완료)
- APK 다운로드 링크: https://expo.dev/accounts/song9912/projects/amatda/builds/59c615ac-c638-4f1f-b7bd-9449258d26f9
- 공식 계정 시드 글 20개 작성 완료 (운영팀/도우미 페르소나 각 10개)
- 출산가방 공유: 양방향 작동 (가족이 체크 가능)

---

## 2026-05-03 (오전) — 알람·인증 안정화 + 맘스톡 전면 개편 + Pretendard 폰트

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


---

## 2026-06-05 — 공동육아 연결 해제 시 공유받은 앱 자동 동기화

**수정 파일**
- `frontend/app/(main)/home.tsx` — `useFocusEffect` + `didInitialFocus` ref 추가

**작업 목적**
소유자(아빠)가 공동육아 연결을 끊었는데, 공유받은 사람(엄마) 앱에 아이가 그대로 남아있던 문제.

**원인**
- 데이터 모델은 owner-centric(정상): 아이는 1개, 소유자 소유. 엄마는 `familyMembers`(status=accepted) 문서로 같은 아이에 **공유 접근** (복사 아님).
- 백엔드 `getAccessibleChildIds`는 멤버 문서 삭제 즉시 권한을 회수해 정상. 단, 홈 `loadChildren()`이 **mount 1회만** 실행돼서, 앱을 껐다 켜기 전까지 in-memory store에 아이가 유령처럼 남음. 그 상태 편집 시 백엔드 404.

**해결**
- 홈 화면 포커스(탭/네비 복귀) 시 `loadChildren()` 재실행 → `setChildren`이 목록 전체 교체 → 권한 사라진 아이 자동 제거. 첫 포커스는 mount useEffect와 중복 방지 위해 skip.

**올바른 동작 정의(확정)**
- 소유자가 연결 해제 → 공유받은 사람 앱에서 해당 아이 사라짐. 그동안 기록한 데이터는 소유자 아이에 그대로 남음(엄마에게 복사본 없음).

**검증**
- `frontend tsc --noEmit` 통과 / `expo lint` 0 error
- 사용자 확인: "껐다키니깐 삭제됨" → 이제 포커스 재동기화로 재시작 불필요
- OTA 배포: preview, runtime 2.9.1, group 1b95ebba

**남은 이슈**
- 공동육아 초대받은 사람 연결상태 표시 + "나가기" 버튼(task chip #1)
- 아기시간 기록 작성자(가족) 표시(task chip #2, Firestore 필드 추가 → 승인 필요)

---

## 2026-06-05 — 공동육아 권한·필드 버그 수정 (1·2·3번)

**수정 파일**
- `backend/src/routes/momstagram.ts` — 가족피드 멤버 수집 필드 `userId`→`inviteeUserId` (113/118)
- `backend/src/routes/sos.ts` — notify-family 멤버검사 `userId`→`inviteeUserId`; fever-calculator·check-symptom 에 `getChildIfAccessible(null)` 접근검증 추가
- `backend/src/utils/cascadeDelete.ts` — 계정탈퇴 familyMembers 정리 `userId`(없는필드)→`invitedBy`+`inviteeUserId` 2쿼리
- `backend/src/routes/album.ts` — `verifyChildOwnership`(소유자전용) 제거 → `getChildIfAccessible`(POST=editTimeline, GET/generate/albums=viewTimeline)
- `backend/src/routes/vaccination.ts` — schedule(viewRecords)/complete(editRecords)/schedule-alerts(editRecords) 소유자전용 → `getChildIfAccessible`

**원인**
- `familyMembers` 스키마에 `userId` 필드 없음(`invitedBy`/`inviteeUserId`만 존재). 세 곳이 없는 필드로 쿼리 → 항상 빈 결과.
  - momstagram: 공동육아 상대 글이 가족피드에 안 뜸
  - sos notify-family: 공유 멤버가 SOS 못 보냄(소유자만 가능) ※보안구멍 아님, 기능버그
  - cascadeDelete: 탈퇴해도 연결문서 유령 잔존
- album/vaccination/sos응급도구: 소유자 전용/무인증 → 공유 멤버 기능 배제 또는 BOLA.

**해결**
- 필드명 정정(3곳), 권한 헬퍼 `getChildIfAccessible`로 통일(공유 멤버 권한 기반 접근 허용).

**검증**
- `backend tsc --noEmit` 통과
- `npm run build` + `firebase deploy --only functions:api` 성공 (api us-central1 업데이트)

**미적용(제품 결정 필요 — 4번)**
- 중복 수락 가드(같은 사람 2번 수락 시 accepted 문서 중복)
- AI 코칭 useCoaching 권한 무시(context.builder 의도적) — 권한모델 일치 여부 결정 필요
- pending 초대 만료 정책

**참고**
- Firestore composite 인덱스: familyMembers 쿼리는 전부 순수 equality → 불필요(에이전트 과장 정정).

---

## 2026-06-05 — 공동육아 4번(제품 결정 항목) 반영

**수정 파일**
- `backend/src/routes/coparenting.ts` — INVITE_EXPIRY_MS(7일) + sweepExpiredInvites() 추가; accept 트랜잭션에 만료 거부(410) + 중복 가드(이미 accepted 멤버면 새 멤버십 안 만들고 pending 초대만 삭제, alreadyMember 반환)
- `backend/src/services/coaching/context.builder.ts` — buildChildContext 에 requiredPermission(기본 'useCoaching') 인자 추가, 공유 멤버 권한 잠금
- `backend/src/routes/coaching/history.handler.ts` — 마일스톤 열람은 'viewProfile' 로 호출(코칭 생성과 구분, 열람 막힘 방지)
- `backend/src/index.ts` — dormantUserSweep(매일 03:30 KST) 콜백에서 sweepExpiredInvites() 호출

**결정/해결**
1. 중복 수락 → "이미 멤버면 안 만든다": accept 트랜잭션에서 dup(accepted) 존재 시 새 멤버십 생성 안 함, 중복 pending 만 소비. (읽기 후 쓰기 트랜잭션 규칙 준수)
2. AI 코칭 권한 → "잠그기": 공유 멤버는 useCoaching 보유해야 코칭 생성(ask/firstTalk/dailyDiary/analyzeMedia/followup) 가능. 소유자는 항상 통과. 마일스톤 열람은 viewProfile 로 분리해 과잉 차단 방지.
3. pending 초대 만료 → "안 쓴 초대코드 삭제": 7일 경과 pending 은 수락 불가(410) + 매일 sweep 으로 삭제. createdAt(기존 필드) 비교 → 스키마 변경 없음.

**검증**
- `backend tsc --noEmit` 통과
- `npm run build` + `firebase deploy --only functions:api,functions:dormantUserSweep` 성공

**비고**
- accept 응답에 alreadyMember 필드 추가(하위호환 — 프론트 무변경).
- 만료 sweep 은 status 단일 equality 쿼리 + 코드 비교 → 복합 인덱스 불필요.

---

## 2026-06-05 — 아기시간 열람전용 멤버 기록 차단 (할머니 기록 버그)

**증상**: 할머니(grandparent, 열람전용)인데 아기시간에 기록이 되고 "할머니가 기록함" 표시됨.

**진단(실데이터 확인)**: accepted 멤버십 1개(중복 아님), 권한도 정확히 열람전용(editRecords 없음). 서버 PUT 은 editRecords 로 정상 차단. → 원인은 프론트.
- `features/baby-tracker/storage.ts`: putDay/putSessions 가 `.catch(()=>{})` fire-and-forget → 403 조용히 삼킴.
- 아기시간은 offline-first → 로컬에 먼저 저장+표시. 즉 할머니 폰 로컬에만 보이고 실제 공유 데이터엔 미반영. 프론트가 권한 게이팅을 안 함.

**수정 파일**
- `frontend/features/baby-tracker/author.ts` — resolveCanEditRecords(childId) 추가 (owner 또는 editRecords 보유 → true, 조회실패 fail-open, 캐시)
- `frontend/app/(main)/baby-tracker.tsx` — canEditRecords 상태/effect + ensureCanEdit() 가드를 핵심 4 진입점(handleBottomAction/handleTimedActionRequest/handleEditSave/handleDeleteRecord)에 적용 + 열람전용 배너

**해결**: 열람전용 멤버는 입력/수정/삭제 시 "열람 전용" 안내 후 차단, 상단에 열람전용 배너 표시. 소유자/편집권한 멤버는 영향 없음.

**검증**
- `frontend tsc --noEmit` 통과, `expo lint` 0 error(기존 경고만)
- OTA: preview, runtime 2.9.1, group e326bed7

**비고**: 보안 구멍 아님(서버는 항상 editRecords 로 차단). 프론트 UX 갭만 수정. 진단 스크립트(backend/scripts/diag-familymembers.js)는 사용 후 삭제.

---

## 2026-06-05 — 공동육아 권한 게이팅 정석화 (클라이언트 전수)

**배경**: 서버는 권한 강제 정상이나, 프론트가 거의 모든 화면에서 권한 미확인 + offline-first 로컬저장 + fire-and-forget(.catch(()=>{})) → 열람전용 멤버가 "로컬엔 되는데 공유 안 됨" 착각. 아기시간만 게이팅돼 있었음.

**정석 원칙**: 서버=진실의 원천, 클라=권한 반영(못쓰는 기능 차단/안내), 조회실패는 fail-open(서버가 최종 차단).

**신규**: `frontend/features/coparenting/permissions.ts` — 공용 권한 레이어
- resolveChildPermissions/canDo(비동기, 캐시) + useChildPermissions(훅). owner=전권, 실패=fail-open.

**적용 화면(권한)**
- chatbot.tsx — useCoaching (입력창 비활성+안내, 전송 가드). CoachingInput 에 placeholder prop 추가.
- cry-analyzer/poop-analyzer.tsx — useCoaching (analyzeMedia 가드)
- diary.tsx — handleSubmit=editRecords, handleGenerateAiDiary=useCoaching
- growth-stats.tsx — editProfile (성장기록 저장 가드 — 기존 .catch 로컬착각 차단)
- album.tsx — editTimeline (saveEntry/handleBatchConfirm/handleEditSave/삭제 가드)
- baby-tracker.tsx — 기존 editRecords 게이팅(이전 작업)

**감사로 확인(정정)**: 백엔드는 이미 견고. 에이전트가 flag 한 followups(userId 필터—본인것만, 누수X)·recommendations(childId는 AI트리거 플래그—데이터 미접근)는 실제 버그 아님 → 변경 안 함.

**검증**: frontend tsc 0 error, expo lint 0 error(기존 경고만). OTA preview runtime 2.9.1 group a358f981.

**남은 후속(선택)**: 각 화면 상단 "열람 전용" 배너 일관 적용(현재 아기시간만 배너, 나머지는 액션시 안내), 권한변경 후 캐시 무효화 호출(invalidatePermissions) 연결.

---

## 2026-06-05 — iOS/Android 플랫폼 패리티 전수 감사 (정석 검증)

**요청**: iOS도 동일 방식 전수 확인, 안드와 다른 점/잘못된 것 수정, 정석 문서 기준, 끝나면 OTA.

**방법**: Platform.OS/select 101곳(49파일) + app.json/app.config.js 직접 검증. RN/Expo 공식 KeyboardAvoidingView/Platform 문서 참조.

**결론: 수정할 OTA 가능한 플랫폼 버그 없음. 현재 처리 방식이 정석.**

에이전트 over-flag 직접 검증·반박:
- NSPhotoLibraryAddUsageDescription "누락" → 오진. expo-media-library savePhotosPermission 이 자동 주입.
- NSUserTrackingUsageDescription "누락" → 오진. react-native-google-mobile-ads userTrackingUsageDescription 자동 주입.
- aps-environment "누락" → 오진. Expo+EAS 빌드 시 provisioning 으로 자동 관리.
- associated-domains "누락" → 버그 아님. 커스텀 스킴 amatda:// 사용(유니버설 링크는 선택).
- mom-group 신고 ActionSheetIOS "Android 불가" → 오진. else 분기에 Alert fallback 있음.
- payment IAP "iOS 크래시" → 오진. available:true 양쪽 동일, expo-iap 플러그인 구성됨.
- KeyboardAvoidingView undefined(Android) → 정석 허용 패턴(Platform.select ios만 지정 시 undefined). 버그 아님 → 미변경.
- 안드 전용 분기(음성 핀/알림채널)·iOS 전용(Siri 플러그인) → 의도된 분기, 정상.

**유일한 실제 항목(미구현·승인 필요)**:
- Sign in with Apple (App Store 정책 4.8: 타 소셜로그인 제공 시 Apple 로그인 필수). 단 이는 (1)네이티브 변경→OTA 불가, (2)인증 핵심 구조 변경→Rule of Two 승인 필요, (3)백엔드 핸들러 추가 필요. → 구현 보류, 사용자 결정 대기.

**데드코드(선택 정리)**: profile.tsx handleChangePassword(미사용, eslint-disable). Alert.prompt iOS 전용 분기.

**OTA**: JS 변경 없음 → OTA 불필요(빈 퍼블리시 안 함). iOS 설정 변경도 없음(빌드 불필요).

---

## 2026-06-05 — Sign in with Apple 추가 (iOS 전용, App Store 정책 4.8)

**범위**: Apple 로그인은 iOS 에만 노출(Android 미노출 — 정책상 의무도 iOS만). Android 기존 카카오/네이버/구글 유지.

**백엔드(배포 완료)**
- `services/social.auth.ts` — SocialProvider 에 'APPLE' 추가. verifyAppleToken(): identityToken(RS256 JWT)을 Apple JWKS(공개키)로 검증 — Node 내장 crypto.createPublicKey({format:'jwk'}) + jsonwebtoken(신규 의존성 0). iss(Apple)/aud(com.sylabs.amatda)/exp/서명 검증, sub→socialId, email_verified=true 만 신뢰. unlink 는 no-op(추후 revoke 보강).
- `routes/auth.ts` — /auth/social validProviders 에 'APPLE' 추가. findOrCreateSocialUser 는 provider 제네릭이라 무수정.

**프론트(OTA 완료 — 단 실제 동작은 새 빌드 필요)**
- `services/social-auth.ts` — appleLogin(): expo-apple-authentication 동적 require + signInAsync → identityToken 을 /auth/social(provider=APPLE) 로. 취소(ERR_REQUEST_CANCELED)는 null.
- `components/ui/socialButtonConfig.ts` — APPLE 버튼(검정/Apple로고 글리프, iosOnly) 최상단.
- `components/ui/SocialLoginButtons.tsx` — isAppleAuthAvailable(동적 require 가드): iOS + 네이티브 모듈 존재 시에만 노출 → 구빌드 OTA 안전(버튼 숨김), 새 빌드에서 자동 노출.
- `app.json` — ios.usesAppleSignIn:true + plugins 에 expo-apple-authentication. expo-apple-authentication ~8.0.8 설치.

**검증**: backend tsc / frontend tsc / expo lint 0 error. backend firebase deploy 완료. OTA preview runtime 2.9.1 group 38fc79a0.

**⚠️ 남은 필수(사용자/빌드)**:
1. 새 iOS 빌드 필요(`eas build -p ios`) — 네이티브 모듈+entitlement 포함돼야 버튼 실제 노출/동작. OTA만으론 동작 안 함(가드로 숨김).
2. Apple Developer: App ID 에 "Sign in with Apple" capability 활성화(EAS 자동관리 시도하나 확인 필요). App Store Connect 제출.
3. (선택) Apple 토큰 revocation(/auth/revoke, .p8 client_secret) — 탈퇴 시 Apple 측 연결 해제 강화.

---

## 2026-06-05 — iOS preview 빌드 (Apple 로그인 활성화)

- 1차 빌드 실패: GoogleService-Info.plist 가 git 미추적 → EAS 빌드에 미업로드.
- 해결: `eas env:create --environment preview --name GOOGLE_SERVICES_PLIST --type file --value ./GoogleService-Info.plist --visibility secret` (안드로이드 GOOGLE_SERVICES_JSON 과 동일 방식). app.config.js 가 process.env.GOOGLE_SERVICES_PLIST 를 이미 읽음.
- 자격증명: 배포 인증서 재사용(NKS49W7XV6), 프로비저닝 프로필에 Sign in with Apple entitlement + iPhone 11 등록.
- 재빌드 성공 큐잉: build 5d9df328-b2af-42c2-b157-cc57f1a9c200 (클라우드 진행 중).
- 빌드 완료 후 등록된 기기에 설치 → 로그인 화면에 Apple 버튼 노출/동작 예상.

---

## 2026-06-05 — iOS production 빌드 + TestFlight 제출 성공 (Apple 로그인)

**문제**: production(App Store) 빌드가 "Provisioning profile doesn't include com.apple.developer.applesignin entitlement" 로 반복 실패. 원인 = Apple 로그인 추가(usesAppleSignIn) 전 6/2 에 생성된 App Store 프로필엔 권한 없음. EAS 는 만료 전 캐시 프로필 재사용 → 비대화형으론 갱신 안 함.

**해결 (정석, 공식 CI 문서 기준)**:
1. 낡은 App Store 프로비저닝 프로필을 Expo 대시보드에서 삭제(사용자).
2. ASC API 키 환경변수 5개로 비대화형 재빌드 → EAS 가 새 프로필(ZK443R6KAD) 자동 생성(App ID 의 Sign in with Apple capability 자동 포함):
   - EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID, EXPO_APPLE_TEAM_ID, **EXPO_APPLE_TEAM_TYPE=INDIVIDUAL**
   - 핵심: EXPO_APPLE_TEAM_TYPE 누락 시 Apple ID 대화형 로그인("Select your Apple Team Type")으로 빠져 실패. 5개 다 줘야 ASC 키로 비대화형 인증.
3. 빌드 성공: 8fe4885f (build number 21, .ipa). 사이닝 통과.
4. `eas submit -p ios --profile production --id 8fe4885f --non-interactive` → App Store Connect/TestFlight 업로드 성공(submission 5deb12d4).

**상태**: Apple 처리 중(~5-10분) → TestFlight 노출 예정. ITSAppUsesNonExemptEncryption=false 라 수출규정 자동 통과.

**남은 사용자 작업**: TestFlight 에서 빌드 확인 → 테스터 배포 → Apple 로그인 실동작 테스트.

---

## 2026-06-05 — 소셜/Apple 로그인 409 에러 메시지 개선 + 양채널 OTA

**증상**: Apple 로그인 시 "소셜 로그인 실패 409". 원인 = Apple ID 이메일이 이미 다른 provider 로 가입된 계정과 충돌(findOrCreateSocialUser 의 의도된 takeover 방지 409). Apple 로그인 자체는 정상.

**결정**: A(차단 유지) — 자동 연결 안 함(보안). 백엔드 로직 무변경.

**수정**: `hooks/useLoginHandlers.ts` — catch 에서 axios e.message("Request failed with status code 409") 대신 서버 메시지(e.response.data.error: "이미 OO로 가입된 이메일이에요...")를 우선 노출. 친절한 안내가 가려지던 문제 해결.

**검증/배포**: frontend tsc 통과. OTA preview(f0a0802f) + production(b52bc4fb), runtime 2.9.1 — TestFlight 빌드(8fe4885f, 2.9.1)와 런타임 일치하여 반영됨.

**테스트 가이드**: Apple 로그인 성공 확인은 (1) Apple 시트에서 "이메일 가리기(Hide My Email)" → 새 계정, (2) 충돌 이메일은 원래 provider 로 로그인.

---

## 2026-06-05 — IAP 구독 상품 생성 (App Store Connect API) — 결제 "SKU not found" 대응

**증상**: TestFlight 에서 Apple IAP 구독 시 "결제 실패: requestPurchase ... SKU not found". 원인 = ASC 에 구독 상품 미존재(구독 그룹 0개 확인).

**앱 코드 상품 ID**: premium_monthly(3900), premium_yearly(33900) — services/payment.ts. apple:{sku:productId}.

**API 작업(ASC API 키 SQ3HB62VCH, ES256 JWT, jsonwebtoken)**:
- 구독 그룹 "아맞다 VIP" 생성(id 22135877) + ko 현지화.
- 구독 premium_monthly(id 6777005928, ONE_MONTH) + premium_yearly(id 6777006158, ONE_YEAR) 생성 — productId 코드와 정확 일치.
- ko 현지화(이름/설명, 설명 55자 제한 준수) 성공.
- 가격 포인트 KOR 3900/33900 정확 매칭 확인. **단 가격 설정 POST /v1/subscriptionPrices 가 409 "processing the pricing information" 로 반복 실패 → 유료 앱 계약 미활성으로 추정.**

**상태**: 두 구독 모두 MISSING_METADATA (가격 미설정).

**사용자 필수(법적/금융 — 대행 불가)**: ASC 비즈니스 → 유료 앱 계약 동의 + 은행/세금 정보 → 활성화. 이후 가격 설정(재시도 스크립트 backend/asc-price.js) + Ready to Submit.

**비고**: 임시 스크립트 asc-check/create/finish.js 삭제, asc-price.js 만 보관(계약 후 가격 재설정용).

---

## 2026-06-05 — 출시 점검 + 온보딩/가이드 대개편 (계획 승인 후 구현)

**Part A 출시필수**
- `components/profile/ProfileMenuList.tsx` — 마이 메뉴에 "이용약관"(/terms) + "개인정보처리방침"(/privacy) 링크 추가(스토어 심사 필수, 기존엔 온보딩 동의에서만 노출).
- (검증) AdMob 실제 ID는 app.json plugin에 있고 app.config.js 테스트 fallback은 hasAdMob 가드로 스킵 → 차단 아님. 계정삭제(cascadeDelete) 정상. → 에이전트 과장 정정.

**Part B 가이드 시스템(B1)** — BabyTrackerGuide 패턴 일반화
- 신규 `components/common/GuideCarousel.tsx` — 목업+진행점+애니메이션 공용 쉘. export: GUIDE_C, GuideFrame, GuidePill, GuideBubble. accent prop.
- 신규 `components/common/GuideButton.tsx` — 헤더 '?' 재열람 버튼.
- 신규 `features/guide/seen.ts` — shouldAutoShowGuide/markGuideSeen (guide_seen_<key>).

**B2 환영 투어 개편**
- `components/common/OnboardingGuide.tsx` — 빈약 4스텝 텍스트 → 마스코트+목업 6스텝(환영/기질분석/상담이모/아기시간/공동육아/탭지도). GuideCarousel 사용.

**B3 탭별 가이드**(헤더 '?' + 첫방문 1회 자동표시)
- 신규 콘텐츠: `features/guide/{chatbotGuide,coparentingGuide,growthGuide,sosGuide}.tsx`
- 연결: chatbot.tsx(커스텀헤더), coparenting/growth-stats/sos(ScreenHeader right 슬롯). growth는 GrowthHeader에 onGuide prop 추가. sos는 기존 guideKey와 분리(guideVisible). baby-tracker는 기존 가이드 유지(이미 '?' 있음).

**검증**: frontend tsc 0 error / expo lint 0 error(기존 경고만).

**미적용(B4 선택)**: 기질카드 툴팁, 기준치 설명, 분석기 촬영가이드, 권한 예시, SOS 다음행동 — 승인 시 선별.

---

## 2026-06-05 — B4: 기질 분석 가이드 추가
- 신규 `features/guide/traitGuide.tsx` (4스텝: 기질이란/분석법/활용처/참고용). 사주·오행 용어 미사용.
- `app/(main)/trait-detail.tsx` 다크 헤더에 GuideButton('?') + 첫방문 자동표시(guide key 'trait') + GuideCarousel 연결. useEffect import 추가.
- 검증: frontend tsc 0 error / lint 0 error. OTA preview(21626831).
- production 채널 OTA는 사용자 명시 승인 대기(자동모드 soft-block).

---

## 2026-06-05 — B4 보강 3건 (사용자 "다해줘")
- 아기시간 DailyReferenceCard 하단에 "ⓘ 권장치는 월령·몸무게 맞춤 자동 계산" 한 줄 추가 (baby-tracker.tsx).
- poop-analyzer: "📸 잘 나오는 사진 팁" 카드 추가(미리보기는 기존 존재). cry-analyzer는 이미 녹음 팁+파일미리보기 보유 → 무변경.
- sos ResultCard: 행동 목록 위 "👉 지금 할 일" 헤더 추가로 다음 행동 명확화.
- 검증 tsc 0 / lint 0. OTA preview(e2c14ae7). production은 명시 승인 대기.

---

## 2026-06-06 — 상담 인사 성별화 + 음성핀 재요청 (사용자 피드백)
- chatbot.tsx 첫 인사 `${childName}맘` → parentRole 기반 호칭(아빠/맘/할머니/할아버지/이모/삼촌). authApi.getProfile()로 parentRole 조회. parentGreetingSuffix 헬퍼.
- baby-tracker.tsx promptVoicePinOnce(force) — completeGuide 가 force=true 로 호출 → 가이드를 '?'로 재열람 후 완료해도 음성입력 아이콘 추가를 다시 물어봄(이전엔 1회 거부 시 영구 미표시).
- 광고: 빌드 프로필별 ID(production=실광고 ca-app-pub-1736147235986434, preview=테스트). OTA로 변경 불가. 요약칸 미표시는 AdMob fill 일시 실패(재시도 시 표시) → 코드 문제 아님. ⚠️ 실광고 자기클릭 금지(계정 정지 위험) — 테스트는 preview 빌드/테스트기기로.
- 검증 tsc 0 / lint 0. OTA preview 예정.

---

## 2026-06-06 — 상담인사/음성핀 수정 production 반영 + 배포정책 변경
- 원인: 상담 첫인사 부모역할 호칭 + 음성핀 재요청 수정이 preview 채널에만 있었음 → 사용자는 production 빌드(Play/TestFlight) 테스트라 미반영.
- parentRole 저장값 확인: register/set-nickname 모두 '엄마'/'아빠' → parentGreetingSuffix 매칭 정확(코드 정상).
- production 채널 OTA(faf15d2e). 
- ⚠️ 배포정책 변경: 사용자 요청 — 앞으로 OTA는 **production 채널로만** (preview 생략).

---

## 2026-06-06 — 광고 버그: 프리미엄 상태 조회 실패 시 PAID 강제처리 제거
- 원인: stores/premiumStore.ts catch 블록이 status 조회 실패 시 무조건 {tier:'PAID'}로 set + 5분 캐시 → 무료 계정이 일시적 네트워크 실패(예: WiFi 끊김) 한 번에 광고가 사라지고 5분간 유지됨. useShowAds가 PAID로 판단 → AdSlot이 공간째 null.
- 수정: 실패 시 `set({ isLoading:false, lastFetched:null })` — 직전 상태 유지(VIP 보호 + FREE 광고 유지) + 캐시 안 함(다음 호출 재조회). 최초 실패는 null 유지 후 재시도.
- 검증 tsc 0. production OTA(85497612).
- 확인 필요: 사용자 계정 실제 tier(마이→프리미엄 플랜이 '무료'인지 '체험 N일'인지). 무료인데도 재시작 후 광고 없으면 status 조회 자체 실패 추가 조사.


---

## 2026-07-02 — 해외 출시 후속: 로케일 게이팅 + 음성/사진분석 다국어 인식 + playActivities 번역
- 배경: 화면 문자열 다국어화(4259개 키) 완료 후, "번역만으로는 해외 출시 불가" 판단 — 한국 특화 데이터/AI 인식 언어 문제 별도 조치.
- **로케일 게이팅** (커밋 2eb5c05): 한국 자료 기반이라 번역 무의미한 3개 기능을 `i18n.language !== 'ko'`일 때 UI에서 숨김.
  - `home.tsx`: 예방접종 퀵탭(질병관리청 국가예방접종 일정 기반), 월령별특징 카드.
  - `recommendations.tsx`: 음식추천 카테고리(한국 이유식/식재료 데이터 기반), 임산부음식도 동일.
- **음성/사진분석 다국어 인식** (커밋 2eb5c05, 8bdb514, 14f0092): 사용자 명시 승인(Rule of Two, "추가형·기존 로직 안 건드림") 하에 진행.
  - `voice.tsx`: `expo-speech-recognition` STT lang 파라미터 로케일 매핑(ko-KR/ja-JP/zh-TW).
  - `backend/src/routes/tracker.ts`: `LOCALE_VOCAB_HINT` 상수(ja/zh-Hant 어휘 힌트) 신설 — 기존 한국어 systemPrompt 뒤에 **append만** 하는 방식(voice-parse, photo-parse 둘 다 동일 패턴 적용). 출력 필드명/값은 한국어 유지 지시 포함. locale이 'ko'거나 미지정이면 한국어 사용자 동작은 byte-identical.
  - `frontend/services/api.ts`의 `trackerApi.voiceParse`/`photoParse`에 `locale?: string` 파라미터 추가, 호출부(`voice.tsx`, `PhotoLogReview.tsx`)에서 `i18n.language` 전달.
  - 알려진 미해결 갭: photo-parse 핸들러의 TS 후처리 정규식(예: `'왼'`/`'오른'`, `(일어|기상|깸|깼)`, 한국어 시간 포맷 정규식)은 한국어 전용 그대로 — Gemini 프롬프트 힌트만 추가했고 정규식 정규화는 확장 안 함.
- **constants/playActivities.ts 번역** (커밋 ace67da, 백그라운드 에이전트): 정적 `PLAY_ACTIVITIES` export → `getPlayActivities(t: TFunction)` 팩토리로 전환. name/duration/reason/materials/steps 번역(emoji/ageGroups/기질 키는 비번역). `play-learning.tsx`는 `useMemo(() => getPlayActivities(t), [t])`로 호출부 수정. 263개 키를 ko/ja/zh-Hant 3개 로케일에 병합 — 병합 후 키 개수 4522개로 3개 파일 완전 일치 확인.
- **확인된 죽은 코드(번역 불필요)**: `cryAnalysisData.ts`, `poopAnalysisData.ts`, `learningActivities.ts` — grep으로 전체 codebase import 0건 확인. `cry-analyzer.tsx`/`poop-analyzer.tsx`는 백엔드 Gemini(`coachingApi`)를 직접 호출하고 이 상수들을 쓰지 않음.
- 검증: 매 배치마다 `backend && npx tsc --noEmit`, `frontend && npx tsc --noEmit`, `frontend && npx expo lint` 실행 — 전부 0 error(기존 경고만 존재).
- 남은 작업(사용자 지시 "1234전부 + 안된곳 차례대로"): ③ 상담이모(coaching AI) 응답 언어가 실제 UI 언어를 따르는지 미확인 — 조사 중. ④ `services/payment.ts` KRW 고정 가격 — 다국가 통화 처리 방식 미정, 사용자 논의 필요.


---

## 2026-07-02 — 상담이모(코칭 AI) 다국어 응답 힌트 추가 (사용자 명시 승인, 추가형)
- 감사 결과: `backend/src/services/coaching/prompt.builder.ts`의 SYSTEM_PROMPT/PREGNANT_SYSTEM_PROMPT가 완전 한국어 하드코딩, `AskBodySchema`에 locale 필드 자체가 없었음(voice/photo-parse와 달리 미대응 확인).
- 사용자 승인("진행 (추가형)") 하에 tracker.ts와 동일 패턴 적용:
  - `prompt.builder.ts`: `LOCALE_RESPONSE_HINT`(ja/zh-Hant) 신설, `buildPrompt(ctx, pregnant?, locale?)`로 3번째 파라미터 추가 — locale이 ko가 아닐 때만 기존 systemPrompt 뒤에 "이 언어로 응답하라" 힌트 append. JSON 필드명(judgement 등) 번역 금지 명시. 기존 한국어 프롬프트 본문 완전 미수정.
  - `ask.handler.ts`: `AskBodySchema`에 `locale` 필드 추가, `buildPrompt` 호출에 locale 전달.
  - `frontend/services/api.ts`의 `coachingApi.send()`에 `locale?: string` 파라미터 추가.
  - `chatbot.tsx`: `useTranslation()`에서 `i18n` 추가 구조분해, `coachingApi.send()` 호출에 `i18n.language` 전달, `sendMessage` useCallback deps에 `i18n.language` 추가.
- 참고: `buildPrompt`의 pregnant 분기(PREGNANT_SYSTEM_PROMPT)는 현재 ask.handler.ts에서 pregnant 파라미터를 전달하지 않아 실질적으로 호출되지 않음(기존부터 존재하던 상태, 이번 세션에서 발견했으나 범위 밖이라 미수정).
- 검증: `backend && npx tsc --noEmit`, `frontend && npx tsc --noEmit`, `frontend && npx expo lint` 전부 0 error.
- 남은 작업: `services/payment.ts` KRW 고정 가격 — 다국가 통화 처리 방식 사용자와 논의 필요.


---

## 2026-07-02 — 해외 출시 후속 마무리: 결제화면 통화 표시 수정
- 발견: `subscription.tsx`의 요금제 가격 라벨(`t('subscription.plan.monthlyPriceLabel')` 등)이 ja/zh-Hant로도
  "3,900 한국원/월"처럼 그대로 번역되어 있었음(이전 세션 번역 스윕에서 문장 자체는 정확히 번역했으나
  실제 IAP 결제 통화와 무관한 KRW 문구가 남아있던 것). 사용자 확인 후("코드만 먼저 수정") 진행.
- `frontend/services/payment.ts`: `fetchLocalizedPrices()` 신설 — `fetchIAPSubscriptions()`(App Store/Play
  Console 실제 상품 조회) 결과에서 `displayPrice`(현지 통화 포맷 완성 문자열)를 추출해 ProductId별로 반환.
- `frontend/app/(main)/subscription.tsx`: `i18n.language !== 'ko'`일 때만 마운트 시 `fetchLocalizedPrices()`
  호출 → 조회 성공 시 새 번역 키(`subscription.plan.pricePerMonth`/`pricePerYear`, `{{price}}/월`·`/月`·`/年`
  형식)로 가격 라벨 재구성. 한국어 로케일이거나 조회 실패/로딩 전이면 기존 하드코딩 라벨(KRW) 그대로 유지 —
  한국 사용자는 완전히 동일한 동작.
- 부수 발견(범위 밖, 별도 태스크로 분리): `backend/routes/subscription.ts`의 `/premium/plans` 응답이
  `{ data: { plans: [...] } }` 형태인데 프론트 `loadData()`는 `plansRes.data?.data?.length`로 체크해서
  실제로는 서버 데이터가 한 번도 반영되지 않고 항상 클라 하드코딩 fallback만 사용되는 기존 버그 확인.
  현재는 fallback 값이 서버 값과 동일해서 사용자 영향 없음 — spawn_task로 별도 세션에 위임.
- 검증: `frontend && npx tsc --noEmit`, `frontend && npx expo lint` 모두 0 error. 키 파리티(ko/ja/zh-Hant
  4524개 동일) 확인.
- **국제 출시 4대 갭(①AI 참고자료 ②사진분석 프롬프트 ③상담이모 응답언어 ④결제 통화) 전체 완료.**


---

## 2026-07-02 — 최종 번역 검증 스윕 (사용자 요청: 순서대로 빠짐없이 확인)
- 전체 프론트엔드(app/components/features/constants/services/stores/utils) 재감사 → 하드코딩 한국어 후보 25개 발견, 6개 파일로 그룹화해 순서대로 처리.
- **죽은 코드로 확인되어 스킵(4건)**: `baby-tracker.tsx`의 `SleepSessionCard`(주석에 "제거" 명시, JSX 호출 0건), `trait-detail.tsx`의 `DetailContent`(lint "never used" 기존 경고와 일치), `voice-settings.tsx`의 `BIXBY_GUIDE`/`GOOGLE_GUIDE`(이전 세션에 이미 확인된 죽은 코드), `album.tsx`의 `getMonthKey()`(실제로는 `MILESTONE_PRESETS` 내부 조회 키일 뿐 — 화면 표시는 이미 번역된 `getMonthLabel()`이 담당, 오탐).
- **실제 수정(2건)**:
  - `features/baby-tracker/utils/time.ts`: `formatDateKorean`/`getRelativeTime`/`formatMinutes`가 '월/일/분/시간/방금 전' 등을 하드코딩 반환 → `TFunction` 파라미터 추가, `common.time.*` 신규 키(9개) ko/ja/zh-Hant 추가. `baby-tracker.tsx`의 실사용 호출부(`BabyTrackerInner`, `TimelineEntry`) 전부 갱신 + 죽은 코드(`RecordCard`/`SleepSessionCard`) 호출부도 타입 정합성만 맞춤.
  - `album.tsx`: 임신 앨범 타임라인의 "임신 {week}주차" 배지 2곳 — 기존에 동일한 문구의 `components.profileCard.pregnancyWeek` 키가 있어 재사용(신규 키 불필요).
- 검증: 매 배치 `frontend && npx tsc --noEmit`(0 error), `frontend && npx expo lint`(96 warnings, 기존과 동일 — 회귀 없음), 키 파리티(ko/ja/zh-Hant 4539개 동일) 확인.
- **이번 감사에서 발견된 진짜 미번역 텍스트는 모두 처리 완료. 프론트엔드 전체 번역 스윕 최종 마무리.**


---

## 2026-07-02 — 국제 출시 남은 8개 갭 전수 조사·수정 + 코칭 DB 487개 항목 완역
- 사용자 지시("이런 DB처럼 안된곳 있는지 전부 체크해줘")로 백엔드 전체 감사 진행 →
  코칭 DB 외에도 8곳이 한국어 전용으로 확인됨. 우선순위(P0~P2)대로 전부 처리.

### P0 — 최우선 (전체 사용자 필수 경로)
- **saju.interpreter.ts**: 온보딩 시 아이당 1회 생성되는 기질/성격 분석이 100% 한국어
  프롬프트, locale 파라미터 자체가 없었음. LOCALE_RESPONSE_HINT 추가(추가형).
  child.ts 3개 엔드포인트(등록/출산전환/수정)에 locale 파라미터 배선.
- **auto.diary.ts**: 감사 결과 실제 호출부가 전혀 없는 죽은 코드로 확인 — 수정 불필요.

### P1 — 핵심 경로
- **dailyDiary.handler.ts**: 프롬프트에 "한국어로 작성해"가 박혀있었음. 로케일 힌트로
  오버라이드 + 폴백 텍스트(buildMockDiary, 기록없음 안내) 로케일별 분기.
- **firstTalk.handler.ts**: 첫 대화 인사말(STARTER_TOPICS/OPEN_INVITATION/traitDesc)
  전부 하드코딩 한국어 — 로케일별 사전 준비 + AI 프롬프트 힌트 추가.
- **analyzeMedia.handler.ts**: 울음/대변 분석 프롬프트 + 목업 폴백 + 월한도 안내 메시지
  로케일 분기 추가.

### P2
- **child.report.ts**: 온보딩 설문 후 생성되는 기질별 종합 리포트(BASE_PROFILES 5종 +
  AGE_OVERLAYS 4개 연령대, ~1300줄)에 완역 데이터(child.report.ja.ts/zh-hant.ts) 추가.
  단, 답변 기반 미세조정(analyze*Answers, ~660줄 조건부 로직)은 비한국어에서 스킵 —
  부분 번역 노출 방지가 근사 번역보다 우선이라는 판단(완역된 기본 리포트까지만 반환).
- **red.flag.detector.ts**: EMERGENCY 단계는 AI를 거치지 않고 그대로 노출되는데 라벨/
  메시지가 한국어 전용이었음. 38개 라벨 + 메시지 템플릿 번역. **알려진 갭**: 정규식
  감지 자체는 여전히 한국어 입력 기준이라 일본어/중국어 직접 입력 시 미감지 가능 —
  별도 세션(task_7aca3316)으로 분리해 안전 검토 후 진행 예정.
- **followup.templates.ts**: 후속질문 폴백 템플릿(카테고리별 3개씩) 로케일 분기.

### 코칭 DB(487개 항목) 완역
- 24개 병렬 에이전트로 번역(메인 4청크+초등 6파일+임산부 2파일 × 2언어), 원본 대비
  id 순서/개수 100% 일치, traitAdvice 5키 전항목 존재, Hangul 잔존 0건 검증 후 병합.
- 18개 신규 파일(coaching.knowledge*.ja.ts/*.zh-hant.ts) — 기존 9개 한국어 원본 무변경.
- db.searcher.ts에 locale 파라미터로 DB 선택 분기, ko/미지정 시 byte-identical.

### 검증
- 전 배치마다 backend/frontend tsc 0 error, frontend lint 96 warnings(기존과 동일,
  회귀 없음) 확인 후 커밋. 총 10개 커밋으로 분리.

### 남은 갭 (별도 세션으로 분리)
- red.flag.detector.ts 정규식 패턴 자체의 다국어 확장(task_7aca3316) — 안전 관련이라
  신중한 검토 필요.
- premiumApi.plans() 응답 형태 불일치 버그(task_49ea8aa0, 사용자가 별도 세션에서 진행 중).

---
## [2026-07-04] 기질 유형명(감성형 등) 표시 번역 버그 수정

**증상:** 일본어/중국어 앱에서 분석결과·프로필·성장통계·맘스타그램 작성화면의
기질 유형명이 "감성형" 등 한글로 노출.

**원인:** innateData.dominantType 은 설계상 항상 한글 고정키(탐구형/활동형/조화형/
분석형/감성형)로 저장(saju.interpreter). 표시부 일부가 오행키(wood/water) 맵으로
조회하거나 원본을 그대로 렌더 → 한글명이 매칭 안 돼 그대로 노출.

**수정(추가형 — 한국어 표시 불변):**
- 신규 `frontend/utils/traitTypeName.ts` — getTraitTypeName(t, dominantType) 헬퍼
- i18n 3로케일 최상위 `traitTypeName` 사전 추가(ko=원본, ja/zh=〜型). 파리티 74/74/74
- 적용 4곳: onboarding/result.tsx, components/profile/ProfileCard.tsx,
  (main)/growth-stats.tsx, (main)/momstagram-post.tsx

**검증:** frontend tsc 0 / expo lint 0 error / JSON 파리티 유지.

**미해결(코드 아님, 배포·데이터):**
- 리포트 본문/기질 label = analysisReport·innateData 저장값 → 재분석 필요
- 인사말·상담답변 = 실시간 AI지만 백엔드(07-02 locale 커밋) 미배포 시 한국어 → 배포 필요

---
## [2026-07-04] 백엔드 푸시 알림 다국어화 (예측알람/휴면/체험/또래맘)

**증상:** 일본어/중국어 사용자도 모든 백엔드 발송 푸시를 한국어로 받음.
**원인:** ①사용자 locale이 어디에도 저장 안 됨 ②모든 푸시 문구 한국어 하드코딩.
**감사:** 실제 백엔드 발송 푸시는 4개 sweep뿐(predictive/dormant/trial/neighbor).
  예방접종·산모증상·SOS는 pushSchedules에 pending 저장되지만 디스패처 없음(앱 로컬알림/미사용).

**수정(추가형 — ko byte-identical):**
- 신규 `backend/src/utils/pushI18n.ts` — 4종 푸시 ko/ja/zh-Hant 빌더 + formatAgeByLocale + normalizePushLocale
- `pushSchedules` 문서에 `locale` 필드 저장(스키마 추가, 사용자 승인받음):
  - frontend `app/_layout.tsx` — pushSchedule 등록 시 `locale: i18n.language` 전송
  - `routes/retention.ts` — locale 수신·검증·저장(지원 언어만)
- 4개 sweep이 문서의 locale 읽어 로케일 문구 발송:
  - `services/predictiveAlarm.ts`(alarmPushText+locale) / `utils/predictiveAlarmSweep.ts`
  - `utils/dormantUserSweep.ts` / `utils/trialEndingSweep.ts` / `utils/neighborGroupSweep.ts`

**검증:** backend tsc 0 / frontend tsc 0 / expo lint 0 error.
**남은 것:** 기존 사용자 문서엔 locale 없음 → 앱 재진입 시 자동 저장. 그 전까지는 ko 폴백.

---
## [2026-07-04] 남은 작업 / 빠진 것 체크리스트 (i18n 출시 준비)

> 이번 세션에서 코드/배포는 완료됐지만 **실기기 검증 대기** 및 **미착수** 항목 정리.
> 새 프리뷰 빌드: 2.9.2 (commit 6ced479)
> https://expo.dev/accounts/song9912/projects/amatda/builds/1d675ac3-2d11-485f-adb4-a9f4c51c6a72

### A. 실기기 검증 대기 (코드 완료, 미확인)
- [ ] 기질 유형명 표시 — 분석결과/프로필/성장/맘스타그램에서 感性型·探究型 등(감성형 아님)
- [ ] 푸시 다국어 — 앱 1회 실행 → pushSchedules에 locale 저장 → 이후 체험/휴면/아기시간/또래맘 푸시가 ja/zh로
- [ ] 리포트 본문·기질 label — 새 아이 재분석 시 일본어/중국어 (백엔드 라이브)
- [ ] 인사말(first-talk)·상담답변 — 새 상담에서 ja/zh (백엔드 라이브, 프롬프트 강화 반영)
- [ ] 대만/홍콩(zh-Hant) 버전 동일 항목 재확인

### B. 미착수 / 조사 필요
- [ ] 예방접종·SOS·산모증상 pending 푸시 — 디스패처 없음. 앱 로컬알림인지 / i18n 됐는지 / 죽은 코드인지 확인
- [x] iOS Siri 단축어 문구 아직 한국어 — 완전 현지화 완료(앱이름 なるほど育児/育兒答 포함). 네이티브 검증 EAS/실기기
- [x] 홍콩 광둥어 STT 공백 — HK/MO 지역 판별 + 지원 시 광둥어 채택, 미지원 시 zh-TW 폴백. 완료·검증
- [ ] 기존 사용자 문서엔 locale 없음 → 앱 재진입 전까지 ko 폴백 (마이그레이션 아님, 자연 해소)

### C. 프로덕션 승격 (사용자 승인 + 사용자 스토어 계정 필요)
- [ ] 실기기 테스트 통과 후 2.9.2 production 빌드 (AAB, --profile production)
- [ ] Play Store + App Store 제출 (사용자 본인 계정)
- [ ] JP/TW/HK 국가 출시 지역 추가 + 각 스토어 리스팅 현지화
- [ ] 2.9.1→2.9.2 네이티브 변경 포함 → OTA 불가, 스토어 빌드 필수

---
## [2026-07-04] 홍콩 광둥어 STT + iOS Siri 단축어 완전 현지화

### 1) 홍콩 광둥어 음성인식(STT) — 완료·검증
**문제:** STT 로케일이 zh-Hant→zh-TW(만다린) 고정. 홍콩/마카오(광둥어) 사용자 인식 불가.
앱 로케일은 대만·홍콩 공통 zh-Hant라 구분 불가.
**수정(frontend/app/voice.tsx):**
- getLocales().regionCode 로 HK/MO 판별
- 광둥어 후보(yue-Hant-HK→yue-HK→zh-HK→yue-CN→yue) 중 기기가 실제 지원하는 코드만 채택
  (getSupportedLocales 조회), 없으면 zh-TW 안전 폴백 → 미지원 코드로 인식 깨짐 방지
- startListening 을 async 로 감싸 로케일 결정 후 start (콜백 시그니처 유지)
**검증:** frontend tsc 0 / expo lint 0 error (신규 경고 없음).

### 2) iOS Siri 단축어 완전 현지화 — 구현 완료, 네이티브 검증은 EAS/실기기 필요
**문제:** Siri 단축어 문구·제목이 한국어 하드코딩. Apple 규칙상 음성 문구에 앱 표시이름 필수 →
외국어 Siri로 호출하려면 앱 표시이름도 현지화해야 함.
**앱 표시이름 확정:** ko=아맞다 / ja=なるほど育児 / zh-Hant=育兒答
  (ja: '아, 맞다!'=なるほど 의미살림 / zh: 育兒(육아)+答(답), 원명 끝음 반영)
**수정:**
- frontend/locales/native/{ko,ja,zh-Hant}.json — iOS(CFBundleDisplayName) + Android(app_name) 앱이름 현지화
  ※ .gitignore 의 `ios/`·`android/` 패턴이 어느 위치든 해당 폴더를 무시 → 폴더명 native 사용
  ※ JSON 구조를 {ios:{...}, android:{...}} 로 분리 → 플랫폼별 올바른 키(CFBundleDisplayName / app_name)
- frontend/app.json — expo.locales 필드 추가(iOS·Android 앱이름 현지화 공식 경로)
- 안드로이드 현지화(실제 프리빌드로 검증 완료):
  - values-b+ja/strings.xml → app_name=なるほど育児 / values-b+zh+Hant/strings.xml → app_name=育兒答(대만·홍콩 공통)
  - values/strings.xml(기본)=아맞다, AndroidManifest android:label="@string/app_name" 참조 확인
- frontend/plugins/withIosSiriShortcut.js — 확장:
  - Supporting/<lang>.lproj/AppShortcuts.strings (음성 문구, key=한국어 base, ${applicationName} 토큰 유지)
  - Supporting/<lang>.lproj/Localizable.strings (title/description/shortTitle)
  - IOSConfig.XcodeUtils.addResourceFileToGroup + ensureGroupRecursively 로 Xcode 리소스 등록(멱등)
  - addKnownRegion(ja/zh-Hant/ko) + Info.plist CFBundleAllowMixedLocalizations=true
**검증(Windows 가능 범위):** config 정상 로드, locales 반영, 플러그인/라이브러리 API 존재 확인, .strings 포맷 확인.
  ※ iOS 프리빌드는 Windows 불가(Expo 제한) → pbxproj 생성·등록은 EAS 빌드(클라우드 Linux)에서 실행됨.
  ※ 실제 Siri 음성 호출은 일본어/중국어 Siri 설정 실기기에서만 최종 검증 가능.
**주의(사용자 확인 필요):**
- 홈화면 앱 라벨이 일/중 기기에서 なるほど育児 / 育兒答 로 바뀜(승인됨: '완전 현지화 앱이름 포함')
- 네이티브 변경 → OTA 불가, 새 스토어 빌드 필요. iOS 심사 중이면 현재 심사 통과 후 반영 권장.
- 중국어 앱이름 育兒答 은 제안 작명 — 스토어 제출 전 언제든 교체 가능(locales JSON + strings만 수정)

---
## [2026-07-05] 스토어 심사 리스크 점검 (공식문서 대조) + iOS 권한문자열 수정

**방법:** Apple App Store Review Guidelines / Google Play 정책을 리서치 에이전트로 공식문서 대조 + 실제 프리빌드로 네이티브 산출물 검증.

**코드 수정(커밋 10e59d1):**
- iOS 권한 사용목적 문자열(NS*UsageDescription 5종) ja/zh-Hant 현지화 → App Store 5.1.1(ii) 대응.
  기존: 일/중 기기에서 카메라·사진·위치·마이크·음성인식 권한 팝업이 한국어. locales/native/*.json 의 ios 오브젝트에 추가.
  (iOS 전용 — 안드로이드는 시스템 다이얼로그라 불필요. Android APK 재빌드 불필요.)

**검증 결과 — 문제없음:**
- 안드로이드 ACCESS_BACKGROUND_LOCATION 없음 → 위치 선언서 불필요(when-in-use만 사용)
- READ_MEDIA_IMAGES/VIDEO = tools:node="remove"로 정상 차단
- SYSTEM_ALERT_WINDOW = react-native 디버그 매니페스트 전용 → 릴리즈 미포함
- target/compileSdk 36(Expo SDK 54.0.34) ≥ Google 요구 API 35 → 제출 게이트 통과
- 알림 채널 default/engagement 분리 + i18n 채널명 → 마케팅 푸시 정책 대응
- Siri 문구 \(.applicationName) 토큰 + 언어별 현지화 완료
- 앱 표시이름 3종 모두 30자 이하

**🔴 최우선 리스크(사장님 결정 필요, 이번 세션 변경 아님):**
- 해열제 복용량 계산기 — Apple 1.4.2: 복용량 계산기는 "제조사/병원/대학/약국 등 승인기관 출처 또는 규제 승인" 요구(disclaimer만으론 불충분).
  Google: 헬스앱 선언 양식 + "의료기기 아님/전문가 상담" 고지 필수. 국가별 시럽 농도 정확성(홍콩 50mg/ml 2배) 재확인.
  → 심사노트 출처 명시 / 인앱 "의사·약사 상담" 강화 / 최악의 경우 초기 제출 시 게이팅 고려.

**🟡 제출 시 콘솔 작업(코드 아님):**
- 스토어 리스팅 이름=홈화면 이름(なるほど育児/育兒答), 각 30자↓
- Google 데이터안전 양식(오디오·위치 수집/공유 정확히), 헬스앱 선언 양식, 스토어 설명 의료 고지
- Apple App Privacy 라벨 = AdMob 비개인화/SKAdNetwork 설정과 일치(ATT 회피 조건)
- 무료체험 고지(기간·종료후요금·자동갱신) 각 언어 페이월

**🟡 확인 권장:** 마이크·위치 OS 권한요청 전 인앱 사전고지 화면(Google prominent disclosure 필수) 존재 여부.

---
## [2026-07-05] 권한 사전고지 + 해열제 고지 보강 (커밋 72ba07e)

**1) Google prominent disclosure — 마이크·위치 사전고지**
- 신규 utils/permissionDisclosure.ts: OS 권한창 전 인앱 고지(왜/무엇/어떻게) Alert, 최초(미결정) 1회만.
- 적용: voice.tsx(마이크), locationStore.ts·mom-location-setup.tsx(위치). getPermissions status로 게이팅.
- permissionDisclosure i18n 3로케일 추가(파리티 75/75/75).

**2) 해열제 disclaimer 보강** — '의료기기 아님·질병 진단/치료/예방 안 함' 문구 추가(Apple 1.4.1/1.4.2·Google 헬스). ko/ja/zh 3로케일.

**검증:** tsc 0 / lint 0 error / JSON 파리티 75.

**⚠️ 작업 중 발견 — 브랜드명 불일치(미결정, 사장님 판단 필요):**
- 앱 표시이름은 なるほど育児/育兒答로 바꿨으나, 인앱 i18n 곳곳(약 30+곳)은 옛 이름 アマッタ/Amatda 유지:
  - 안전 교체 가능: 알림 채널명(default/engagement), 구독 상품명, 리포트 푸터, 공식배너
  - **기능상 틀림(반드시 수정)**: voice-settings의 Siri 안내문구가 "アマッタ育児" 예시 → 실제 등록 문구(なるほど育児…)와 불일치 → 사용자가 안내대로 말하면 호출 실패
  - **법적/공식명 결정 필요**: 약관·개인정보 서비스명("サービス名: アマッタ/Amatda"), 이메일 템플릿 → 등록 서비스명을 바꿀지 여부
- pushNotifications.appName·socialAuth.appName 2곳 임시 수정했다가, 전면 정리는 별건이라 원복함.

**브랜드명 전면 통일 완료(커밋 a16fef9):**
- 사용자 결정: 인앱 표시명 전면 통일 / 법적문서·이메일 서비스명은 기존(Amatda·아맞다) 유지.
- ja: アマッタ→なるほど育児, zh: Amatda→育兒答 (앱 표시 스팟 ~16곳/언어).
  - Siri 안내문구를 실제 등록 문구와 일치(ja: なるほど育児で記録/で音声記録/で音声メモ, zh: 育兒答記錄/語音記錄/語音).
    → 이전 アマッタ育児/Amatda育兒 안내는 실제 호출문구와 달라 사용자가 따라하면 호출 실패했음(기능 버그 수정).
  - 알림채널·구독상품명·리포트푸터·공식배너·구독취소경로·환영/카카오·pushNotifications/socialAuth appName 통일.
- 유지: 약관·개인정보 '서비스명'(2764/2815/2818), 이메일 머리말/본문(4713/5132/5133) = Amatda·아맞다.
- 검증: JSON 파리티 75/75/75, tsc 0. 한글/구브랜드 잔재 0(법적·이메일 제외).

---
## [2026-07-05] 빌드 전 최종 정밀 감사 (Apple/Google 공식문서 대조) — 수정사항 없음, 전부 통과

**방법:** Apple 공식문서 검증 에이전트(App Intents/현지화 규격) + 안드로이드 실제 프리빌드 산출물 + 코드 감사.

**iOS 규격 검증(공식문서 인용 확보):**
- AppShortcuts.strings: ${applicationName} 토큰·키=Swift 문구 원문·파일명·메인번들 .lproj 배치 — 전부 규격 일치 (Xcode 검증기/WWDC22·23/Apple 엔지니어 포럼 답변 근거)
- 문구 값에 ${applicationName} 필수 → 우리 ja/zh 값 전부 포함 ✓. iOS16 .strings는 1:1 매핑만 허용 → 4키:4값 ✓
- CFBundleDisplayName·NS*UsageDescription의 InfoPlist.strings 현지화 = 공식 메커니즘 ✓. LSHasLocalizedDisplayName 불필요(iOS)
- 런타임 언어 선택은 번들 내 .lproj 존재로 결정(선언 불필요). ASC '언어' 목록은 바이너리 .lproj에서 자동 도출
  → expo.locales에 ko 포함 → ko.lproj 생성 → 한국어도 목록에 표시됨 ✓
- 저위험 실기기 확인 항목: 한국어 기기 Siri 호출(코드 리터럴 사용, dev region=en 조합은 문서화 안 됨) — 기존 2.9.1과 동일 구조라 회귀 아님

**코드/산출물 감사(전부 통과):**
- Android 프리빌드: app_name 3로케일(values-b+*) + 단축라벨(values-ja/zh-rTW/zh-rHK) 정상 생성, 매니페스트 라벨 참조 확인
- 권한 상태 'undetermined' = expo-modules-core 공통 enum 값과 일치(사전고지 게이팅 동작 보장)
- voice.tsx Siri 딥링크 Case1 흐름에서 사전고지 충돌 없음
- 무료체험 법적고지(자동갱신·자동청구·24h취소·해지경로) ja/zh 완비 — Apple 3.1.2/Google 구독 정책
- 해열제 응급번호: ja=119(일본 일치), zh=當地緊急電話(대만119/홍콩999 일반화)
- Swift 문구 ↔ .strings 키 공백 포함 정확 일치
- tsc 0 / lint 0 error / JSON 파리티 75/75/75

**결론: 코드 수정 불요. 스토어 빌드 진행 가능.**

---
## [2026-07-05] 실기기 검증 이슈 2건 수정 + OTA (preview)

**1) 홈 기질배지·마타니티앨범 기분칩 한글 노출 (커밋 6b26a7a):**
- 홈 배지: dominantType+getTraitTypeName 적용. 앨범 칩: 백엔드 프리셋을 id기준 t() 재매핑 + 누락 4키(nausea/itching/mood/bleeding) 3로케일 추가 + PostCard 이모지맵 ja/zh 라벨 확장.

**2) 스플래시 브랜드 + 토글 유지 (커밋 9675429):**
- 스플래시는 동영상 아님(코드 애니). 비한국어 워드마크 アマッタ/Amatda → なるほど育児/育兒答.
- 개발 언어토글 선택 AsyncStorage 저장 + _layout 모듈 로드 시 복원(스플래시 표시 전) — 한국어 기기에서 스플래시까지 테스트 언어로 검증 가능. 프로덕션 no-op.
- 참고: 실사용자는 기기 언어 기준이라 일본/대만 기기는 원래 워드마크 경로.

**OTA:** preview 채널 2회 배포(runtime 2.9.2, SHOW_LANG_TOGGLE·SENTRY_DSN env 명시 주입). 검증: tsc 0/lint 0 error/파리티 75.

---
## [2026-07-05] i18n 전면 감사(신규 방법 4각도) 완료 — 15건 발견·수정, OTA 배포

**방법:** ①leaf 단위 깊은 파리티 ②ja/zh 값 속 한글 ③코드 t()키 3,915개 대조 ④에이전트 2개(프론트 데이터경유/백엔드 응답) — 기존 하드코딩 grep으로 안 잡히던 "데이터 경유 한글" 전수.

**결과(커밋 순):**
- fc1fc95 백엔드발 6곳: 알람 슬롯라벨·1년전배너·결제완료문구·아이카드 나이/기질·음성설정 나이·챗봇 에러원문 (신규 utils/ageLabel.ts)
- 74f667f 모유 좌/우 3언어(신규 breastSide.ts — 표시+집계버그 동반 해결) + 진행중수면 감지 ja/zh
- 89e091f 진통체크 한국어 전용 게이팅(사용자 지시. 태동은 유지, 홈 pill·푸시라우팅 포함)
- 77d8475 발달 체크리스트 80항목+도메인7종(milestonesChecklist, leaf 5060) + U+FFFD 복구('써요') + 진통타이머 언급 문구 정리(D-3푸시·task14)
- 6f33b4f 성장분석(growthAnalysisI18n 107키, metric/level/percentile 코드 기반)·기질인사이트(13키 역매핑)·익명닉네임(displayNickname)·앨범 '추억' 폴백

**검증:** tsc 0 / lint 0 error / 파리티 5182/5182/5182 / ko 표시 byte-identical. OTA preview 2회 배포(최종 019f3156).

**수정 불필요로 판정(검증됨):** cry-analyzer/gdm 429·처리된 에러는 백엔드 로케일 분기 확인(일반 500만 드묾), 해열제·앨범 마일스톤·주수표 등 기존 게이팅 정상.

**남은 것:**
- [ ] 예방접종(한국 NIP 일정) — 사용자 방향 결정 대기(①비한국어 숨김 권장 ②국가별 구축 ③한국기준 명시)
- [ ] 출산가방 공유 웹페이지(백엔드 HTML) 한국어 — P3
- [ ] (별도 세션) pending 푸시 디스패처 부재 — spawn task 진행 중
- 잠재(현재 미노출): nutrition.tsx 미연결 화면 전체 한국어, monthly-characteristic 푸시 화이트리스트 잔존

**[2026-07-05 추가] 예방접종 한국어 전용 게이팅 완료(커밋 4c0901e, 사용자 결정 ①):**
- vaccination.tsx 에 비한국어 Redirect 추가(홈 퀵액션은 기존 게이팅 확인). OTA preview 배포(019f31ac).
- 전면 감사 남은 항목: 출산가방 공유 웹페이지(P3), nutrition.tsx(미연결) — 잠재만.

**[2026-07-05 추가] 공유 웹페이지 2종 다국어화 배포 완료(커밋 919293d):**
- 출산가방 공유 HTML: 공유자 locale을 share_birthbag 문서에 저장 → 렌더 34키×3언어 (ko byte-identical)
- 가족초대 랜딩(public/invite.html): &lang= 쿼리로 8요소 전환 (なるほど育児/育兒答)
- 배포: functions:api + hosting + OTA preview(019f31be) 전부 성공. 라이브 검증: invite?lang=ja → なるほど育児 家族招待 확인, 기본 한국어 불변.
- 기존 생성 링크는 lang 없음 → ko 표시(자연 해소, 30일 TTL).

---
## [2026-07-05] 세션 마감 정리 — i18n 전면 감사 사이클 완료

**이번 세션 커밋(시간순):**
6b26a7a 홈 기질배지+앨범 기분칩 / 9675429 스플래시 브랜드+토글유지 / fc1fc95 백엔드발 6곳 /
74f667f 모유 좌우+수면감지 / 89e091f 진통체크 ko전용 / 77d8475 발달체크리스트 80항목+U+FFFD /
6f33b4f 성장분석·기질인사이트·익명닉네임·추억폴백 / 4c0901e 예방접종 ko전용 / 919293d 공유페이지 2종

**배포 상태:** OTA preview 최종 019f31be / functions:api·hosting 배포·라이브검증 완료.
**검증 상태:** tsc 0(양쪽) / lint 0 error / i18n 파리티 leaf 5182×3 / ko 표시 byte-identical.

**한국어 전용(비한국어 게이팅) 기능 3종 확정:** SOS · 진통체크 · 예방접종 (국가별 응급체계/의료일정 상이).
**공유 표면 locale 흐름:** 출산가방=문서에 lang 저장(공유자 언어), 가족초대=&lang= 쿼리, 앱이름 なるほど育児/育兒答.

**미결(다음 세션):**
- [ ] pending 푸시 디스패처 부재(예방접종D-2/D-1·산모증상 팔로업·SOS 가족알림 — pushSchedules status:'pending' 문서를 읽는 스케줄러 없음, 기능 자체 미동작) — 별도 세션 spawn 했으나 사용자가 세션 삭제, 미착수 상태로 남음
- [ ] 실기기 최종 확인 후 2.9.2 프로덕션 빌드(AAB+iOS) → 스토어 제출(사용자 계정) → JP/TW/HK 지역·리스팅
- 잠재(현재 미노출): nutrition.tsx 미연결 화면 한국어, monthly-characteristic 푸시 화이트리스트 잔존
