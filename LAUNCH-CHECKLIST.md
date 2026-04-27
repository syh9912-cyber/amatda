# 아맞다(A-matda) 출시 체크리스트

> 최초 작성: 2026-04-27
> 목적: 반복되는 출시 직전 에러를 끊고, **동결 → 검증 → 출시** 절차로 안정 출시.
> 사용법: 위에서 아래로 순서대로. 각 항목 완료 시 `- [ ]` → `- [x]`.

---

## 🟥 STEP 0 — 코드 동결 (Code Freeze)

> **이 시점부터 새 기능 / 리팩토링 / "이거 하나만 더" 절대 금지.**
> P0(출시 차단) 버그만 수정. 나머지는 출시 후 OTA 패치.

- [x] 출시 목표일을 캘린더에 적었다 → **2026-05-15**
- [x] 동결 시작일부터 신기능 추가 금지 선언 → **2026-04-27 동결 시작, `FREEZE.md` 생성, `CLAUDE.md` 상단 배너 추가**
- [x] 현재 작업 중인 미완성 기능은 feature flag로 숨기거나 PR을 stash → **`release/v2.9.0` 브랜치 생성, main과 분리**

### 동결 후 허용/금지 작업
| 허용 | 금지 |
|------|------|
| P0 크래시 / 로그인 불가 / 결제 실패 수정 | 신기능 추가 |
| 텍스트 오타 수정 | UI 디자인 변경 |
| 보안 핫픽스 | "더 깔끔하게" 리팩토링 |
| Play Console 메타데이터 입력 | 라이브러리 업그레이드 |

---

## 🟧 STEP 1 — 코드/저장소 정리

- [ ] `git status` 확인 → 미커밋 파일 의도 분류
  - 의도한 변경 → 커밋
  - 의도하지 않은 변경 → `git restore`
  - 빌드 산출물 → `.gitignore` 추가
- [ ] `git push origin main` 으로 백업 (3 commits ahead 상태 해소)
- [ ] `app.json` `version` / `versionCode` / iOS `buildNumber` 출시 버전으로 통일
- [ ] `claude-progress.md` 최신 작업 반영
- [ ] `LOCAL-CONFIG.md` 가 `.gitignore`에 있는지 재확인 (시크릿 누출 방지)

---

## 🟨 STEP 2 — 정적 검증 (CLAUDE.md 필수)

```bash
cd backend && npx tsc --noEmit       # 통과해야 함
cd frontend && npx tsc --noEmit      # 통과해야 함
cd frontend && npx expo lint         # 에러 0
```

- [ ] 백엔드 타입체크 통과
- [ ] 프론트 타입체크 통과
- [ ] 프론트 lint 에러 0 (경고는 P2로 미룸)
- [ ] `any` 타입 신규 추가 0건
- [ ] `\uXXXX` 유니코드 이스케이프 신규 추가 0건
- [ ] `onSnapshot` unsubscribe 누락 0건 (`grep -r "onSnapshot" frontend/`)

---

## 🟩 STEP 3 — 환경/시크릿 점검

### eas.json production
- [ ] `EXPO_PUBLIC_API_URL` 운영값
- [ ] `EXPO_PUBLIC_COACHING_API_URL` 운영값
- [ ] `EXPO_PUBLIC_KAKAO_REST_API_KEY` 운영값
- [ ] `EXPO_PUBLIC_SENTRY_DSN` 주입 ← **현재 누락**
- [ ] `EXPO_PUBLIC_ADS_MOCK=false`

### Firebase / 외부
- [ ] `google-services.json` 운영 패키지(`com.amatda.app`)와 일치
- [ ] Firebase Functions 배포 최신 (`firebase deploy --only functions`)
- [ ] Firestore 인덱스 빌드 100% 완료 (Console 확인)
- [ ] `firestore.rules` 운영 규칙 배포
- [ ] `storage.rules` 운영 규칙 배포
- [ ] FCM 발송 테스트 (Firebase Console → 테스트 메시지)

### 키스토어
- [ ] `amatda-keystore-backup.jks` 외부(USB/Drive)에 백업 ← **분실 시 앱 영구 업데이트 불가**
- [ ] 키스토어 비밀번호 `LOCAL-CONFIG.md` 또는 1Password에 보관

---

## 🟦 STEP 4 — runtimeVersion 정책 결정

> 이 결정 없이 production 빌드하면 기존 OTA 사용자 끊길 수 있음.

- [ ] 현재 운영에 배포된 빌드의 runtimeVersion 확인
- [ ] 새 빌드 정책 결정:
  - [ ] `"1.0.0"` 유지 (기존 사용자 OTA 호환)
  - [ ] `{"policy": "appVersion"}` 전환 (네이티브 빌드 강제)
- [ ] DEPLOY.md에 결정 사항 기록

---

## 🟪 STEP 5 — Play Console / 스토어 메타데이터

- [ ] 앱 이름 / 짧은 설명 / 자세한 설명
- [ ] 스크린샷 (최소 2장, 권장 4~8장)
- [ ] 피처 그래픽 1024×500
- [ ] 앱 아이콘 512×512
- [ ] **개인정보처리방침 URL** = `https://amatda-parenting.web.app/privacy` 입력
- [ ] 데이터 보안 양식 (Firebase Auth, Firestore, FCM, 카카오 SDK 수집 항목 신고)
- [ ] 콘텐츠 등급 설문
- [ ] 대상 연령층 (가족 프로그램 정책 검토 — 영유아 콘텐츠 다수)
- [ ] 광고 포함 여부 (`AdSlot` 사용 → "광고 포함" 표시)
- [ ] 결제 / 구독 항목 등록 (인앱 결제 사용 시)
- [ ] 카테고리 = 육아

---

## 🟫 STEP 6 — 실기기 검증 (가장 중요)

> 코드 리뷰만으로 못 잡는 버그를 잡는 단계. **반드시 production 빌드로** 진행.

### 빌드
- [ ] `cd frontend && npx eas build -p android --profile production` 성공
- [ ] AAB 다운로드 후 internal testing 트랙 업로드
- [ ] 테스터 계정으로 Play Store 설치

### 핵심 시나리오 (각 시나리오 완주)
- [ ] **신규 회원가입 (이메일)** → 온보딩(60문항) → 메인 진입
- [ ] **신규 회원가입 (카카오)** → 온보딩 → 메인 진입
- [ ] **로그인 → 강제종료 → 재실행 시 자동 로그인 유지**
- [ ] **AI 코칭 질문 1회** → 실제 Gemini 응답 수신 (mock 아님)
- [ ] **위험 키워드 EMERGENCY** ("아이가 경련해요") → 119 안내, AI 미호출
- [ ] **위험 키워드 HOSPITAL** ("열이 39도") → 병원 권고
- [ ] **자녀 사진 업로드** → Storage 저장 확인
- [ ] **성장앨범 PDF 생성** → 공유 시트 정상
- [ ] **푸시 알림 수신** (Firebase Console에서 발송 → 기기에 도착)
- [ ] **결제 / 구독 흐름** (테스트 카드)
- [ ] **비행기 모드 → 온라인 복귀** 시 정상 동작
- [ ] **백그라운드 30분 후 복귀** 시 토큰 갱신
- [ ] **연령별 분기** 영유아/초등저/초등고 각 1명씩 등록 후 홈 메뉴 차이 확인
- [ ] **임신 모드** 등록 → 임당 관리 → 식단 사진 분석
- [ ] **로그아웃 → 재로그인** 정상

### 환경 다양화
- [ ] Android 실기기 1대 (개발자 본인)
- [ ] Android 실기기 1대 (다른 기종, 다른 OS 버전)
- [ ] 가능하면 저사양 기기 1대 (메모리 4GB 이하)

---

## 🟦 STEP 7 — 비개발자 베타 테스트

> 가장 효과 좋은 단계. 개발자가 못 보는 UX 막힘 발견.

- [ ] 가족/지인 3~5명에게 internal testing 링크 공유
- [ ] **아무 안내 없이** 사용 요청
- [ ] 막힌 지점 / 헷갈린 화면 피드백 수집 (텍스트 메시지 OK)
- [ ] P0 (못 쓰는 수준) 이슈만 수정, P1/P2는 출시 후 OTA
- [ ] 피드백 수렴 후 빌드 1회 갱신

---

## 🟥 STEP 8 — 출시 직전 최종 점검

- [ ] 모든 STEP 1~7 완료
- [ ] `claude-progress.md`에 출시 빌드 정보 기록 (버전, EAS Build ID, 빌드 일시)
- [ ] `git tag v__ -m "Production release"` + push
- [ ] Play Console **프로덕션 트랙 단계적 출시** (5% → 20% → 50% → 100%, 각 24시간 관찰)
- [ ] Firebase Functions 로그 / Sentry 에러 첫 24시간 30분 간격 확인
- [ ] 크래시율 1% 미만 유지 확인 후 100% 단계 진행

---

## 📞 출시 후 24시간 모니터링 항목

- Sentry 신규 이슈
- Firebase Functions 에러 로그 (`firebase functions:log`)
- Firestore 사용량 (예상치 대비)
- 신규 가입자 → 온보딩 완료 전환율
- AI 코칭 호출 → 응답 수신 성공률
- 결제/구독 실패 건수

---

## 🔁 OTA 핫픽스 절차 (출시 후 P1 발견 시)

1. 작은 단위 수정 → 검증 명령 3종 통과
2. `eas update --branch production --message "v2.x.y: 설명"`
3. 30분 내 사용자 영향도 확인 (Sentry / 사용자 피드백)
4. `claude-progress.md` 기록

> **네이티브 코드 변경(라이브러리 추가, 권한 추가, app.json 변경)은 OTA로 못 보냄 → 새 빌드 필요.**

---

## 🚫 출시 직전 절대 하지 말 것

- "한 가지만 더 다듬자" → 99% 새 버그 만듦
- 검증 안 거친 라이브러리 업그레이드
- Firestore 스키마 변경
- 인증 흐름 구조 변경
- runtimeVersion 변경 (기존 사용자 OTA 끊김)
- `firestore.rules` / `storage.rules` 임의 변경

---

> **기억할 것**: 거의 다 만든 앱은 **건드릴수록 나빠진다**.
> 동결하고, 검증하고, 출시한 다음, OTA로 다듬는다.
