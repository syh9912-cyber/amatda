# 출시 흐름 한 장 요약 (아맞다 v2.9.0)

> 베타부터 정식 출시까지 전체 흐름. 막히면 이 문서 다시 보기.

---

## 🗓 타임라인

```
오늘(4/27)              5/1                 5/8 ~ 5/12             5/13 ~ 5/14            5/15
──────────────────────────────────────────────────────────────────────────────────────────▶
[베타 빌드]            [무료 크레딧]       [지인 5명 베타]         [P0 핫픽스+OTA]       [정식 출시 ⭐]
[STEP 6 본인검증]      [리셋]              [STEP 7]                [Play Console 등록]
                                                                  [Production 빌드]
                                                                  [STEP 5/8]
```

---

## 1️⃣ 지금 (4/27) — 베타 빌드 진행 중

진행 상황:
- ✅ STEP 0 코드 동결 + STEP 1~4 완료
- ✅ Firestore 룰 + SOS 이미지 P0 핫픽스
- ⏳ Preview APK 빌드 중 (25~30분)

**빌드 끝나면**:
1. APK 링크 받음 (https://expo.dev/.../builds/...)
2. 본인 폰에 설치 (출처 불명 앱 허용)
3. STEP 6 시작 (`STEP6-DEVICE-TEST.md` 시나리오 A~K)

---

## 2️⃣ STEP 6 — 본인 실기기 검증 (1~3시간)

**목표**: P0 (출시 차단급) 버그 발견.

체크리스트: `STEP6-DEVICE-TEST.md` 참조

- 시나리오 A~K 위에서 아래로 진행
- 막히면 어디서 막혔는지 메모만 (즉시 수정 X, 모아서 처리)
- **반드시 통과해야 할 것**:
  - A. 회원가입 (이메일 + 카카오)
  - C-2. EMERGENCY 키워드 → 119 안내 (안전 최우선)
  - D. SOS 이미지 한글 정상

**P0 발견 시 핫픽스 → OTA 또는 새 빌드 → 다시 검증**

P1/P2는 메모만 → 출시 후 OTA로 처리

---

## 3️⃣ STEP 7 — 지인 클로즈베타 (5/8 ~ 5/12, 약 4~5일)

### 베타 사용자 모으기 (4~5명 권장)
- 가족 / 친한 지인 / 다른 부모님
- 다양한 폰 기종이면 좋음 (삼성 / LG / 픽셀 등)
- 가능하면 **임신 사용자 1명 + 영유아 부모 2~3명** 섞기

### 배포 방법: APK 직접 전송 (가장 빠름)
1. EAS 빌드 결과물 APK 링크 복사
2. 카톡으로 링크 전송 + 안내 메시지:

```
[아맞다 베타 테스트 부탁드려요]

📲 설치 링크: <APK URL>
설정 → "출처 불명 앱 허용" 체크 후 설치

💌 부탁드릴 것:
- 회원가입부터 자유롭게 사용해보세요
- 이상한 점 / 헷갈린 점 무엇이든 알려주세요
- 스크린샷 + 한 줄 메모면 충분합니다
- 진짜 자녀 사진 대신 테스트 이미지 써주세요

기간: 5/8 ~ 5/12 (5일)
감사해요 🙏
```

### 베타 운영
- **카톡방 만들기** (베타 5명 + 본인) — 피드백 모이는 곳
- 매일 1회 확인 → 카테고리별 분류 (P0/P1/P2)
- P0 발견 → 즉시 핫픽스 → OTA로 5명 동시 배포 (`eas update --branch preview`)
- P1/P2 → 정식 출시 전 일괄 처리 또는 출시 후 OTA

### 베타 종료 시점 결정
- 다음 조건 모두 충족 → STEP 8 진행:
  - [ ] 24시간 새 P0 발견 없음
  - [ ] 5명 모두 핵심 시나리오(가입→코칭→앨범) 한 번씩 완주
  - [ ] 크래시 0건

---

## 4️⃣ STEP 5 + STEP 8 — 정식 출시 (5/13 ~ 5/15)

### 5/13: 사전 준비
- [ ] **EAS 무료 크레딧 리셋 확인** (5/1 이후라 OK)
- [ ] **Sentry 가입** + 프로젝트 생성 → DSN 받기 (5분)
- [ ] `eas.json` production env에 `EXPO_PUBLIC_SENTRY_DSN` 추가
- [ ] **`app.json` version `2.8.1` → `2.9.0`** (versionCode +1)
- [ ] **Production 빌드** 시작:
  ```
  eas build --profile production --platform android
  ```
- [ ] 빌드 진행 중 → STEP 5 (Play Console 등록) 시작

### 5/13 ~ 5/14: STEP 5 — Play Console 등록

`PLAY-CONSOLE-METADATA.md` 의 모든 텍스트 그대로 복사해서 입력.

#### 작업 순서
1. **앱 만들기** (이미 있으면 건너뛰기)
   - Play Console → 앱 만들기 → 한국어 / 무료 / 앱
   - 패키지명: `com.amatda.app`
2. **앱 정보 입력** (PLAY-CONSOLE-METADATA.md 1~2번)
   - 앱 이름 / 짧은 설명 / 자세한 설명 / 카테고리
3. **이미지 업로드** (PLAY-CONSOLE-METADATA.md 9번)
   - 아이콘 512×512 (`frontend/assets/icon.png`)
   - 피처 그래픽 1024×500 (별도 제작 필요)
   - 스크린샷 8장 (실기기 캡처)
4. **콘텐츠 등급 설문** (PLAY-CONSOLE-METADATA.md 5번)
5. **대상 연령층** (PLAY-CONSOLE-METADATA.md 3번 — "어린이 대상 아님" 선택)
6. **데이터 보안 양식** (PLAY-CONSOLE-METADATA.md 4번)
7. **광고 / 인앱 구매** (PLAY-CONSOLE-METADATA.md 6~7번)
8. **개인정보처리방침 URL** = `https://amatda-parenting.web.app/privacy`
9. **연락처** = syh9912@gmail.com

#### 인앱 상품 등록 (구독 사용 시)
- Play Console → 수익 창출 → 상품 → 구독
- 월간 / 연간 구독 등록 + 가격 입력
- 무료 체험 7일 권장

### 5/14: AAB 업로드 + 내부 테스트

1. EAS Production 빌드 완료 확인
2. **AAB 다운로드**
3. Play Console → 테스트 → 내부 테스트
4. 새 출시 만들기 → AAB 업로드
5. 출시 노트 입력 (`PLAY-CONSOLE-METADATA.md` 11번)
6. "내부 테스트 트랙으로 출시" 클릭
7. 테스터 그룹에 본인 이메일 추가 → opt-in URL 받기
8. 본인 폰으로 Play Store에서 설치 → 정식 빌드 마지막 검증

### 5/15: STEP 8 — 정식 출시 ⭐

#### 출시 전 30분 점검
- [ ] 프로덕션 빌드 정상 동작 (Play Store 설치 후 핵심 시나리오 1회)
- [ ] Firebase Functions 로그 깨끗함
- [ ] Firebase Functions 최신 배포 확인 (`firebase deploy --only functions`)
- [ ] LAUNCH-CHECKLIST.md STEP 1~7 모두 ✅
- [ ] git tag v2.9.0 + push

#### 단계적 출시 (Staged Rollout) ⭐ 강력 권장
**한 번에 100% 풀지 마세요.** 단계별로:

| 단계 | 비율 | 관찰 시간 | 다음 단계 조건 |
|---|---|---|---|
| 1 | 5% | 24시간 | 크래시율 < 1%, 신규 P0 0건 |
| 2 | 20% | 24시간 | 동일 |
| 3 | 50% | 24시간 | 동일 |
| 4 | 100% | — | 24시간 무사 통과 |

#### 출시 절차
1. Play Console → 프로덕션 → 새 출시 만들기
2. 동일 AAB 업로드 (또는 내부 테스트에서 승격)
3. 출시 노트 입력
4. **단계적 출시 비율 = 5%** 설정
5. "출시" 클릭 → Google 검토 (보통 2~24시간)
6. 승인되면 5%부터 자동 배포 시작

---

## 5️⃣ 출시 후 24시간 모니터링

### 30분 간격 첫 6시간
- [ ] Sentry 신규 이슈 (있으면 즉시 핫픽스)
- [ ] Firebase Functions 에러 로그 (`firebase functions:log`)
- [ ] Firestore 사용량 (예상보다 많으면 비정상 동작 의심)
- [ ] Play Console → Android Vitals (크래시율 / ANR)

### 1시간 간격 다음 18시간
- [ ] 신규 가입 → 온보딩 완료 전환율
- [ ] AI 코칭 호출 → 응답 성공률
- [ ] 결제/구독 실패 건수 (있으면 즉시 확인)
- [ ] 사용자 피드백 (Play Store 리뷰, 이메일)

### P0 발견 시
1. **Play Console에서 단계적 출시 일시정지** (배포 비율 0%로)
2. P0 핫픽스
3. OTA 가능 → `eas update --branch production`
4. OTA 불가 (네이티브) → 새 production 빌드 + AAB 재업로드

---

## 6️⃣ 핵심 명령어 모음

### 빌드 / 배포
```bash
# Preview (베타) 빌드
cd C:/amatda/frontend && eas build --profile preview --platform android

# Production (정식) 빌드
cd C:/amatda/frontend && eas build --profile production --platform android

# OTA 업데이트 (preview 채널 — 베타용)
# ⚠️ --environment preview 반드시 포함 — 누락 시 .env 사용 (사고 위험)
cd C:/amatda/frontend && eas update --branch preview --environment preview --message "v2.9.x: 설명"

# OTA 업데이트 (production 채널 — 정식 출시용)
# ⚠️ --environment production 반드시 포함
cd C:/amatda/frontend && eas update --branch production --environment production --message "v2.9.x: 설명"

# 빌드 상태 확인
eas build:list --limit 5

# 채널 / 런타임 확인
eas channel:list
```

### Firebase
```bash
# Firestore 룰 배포
cd C:/amatda && firebase deploy --only firestore:rules

# Firestore 인덱스 배포
cd C:/amatda && firebase deploy --only firestore:indexes

# Functions 배포
cd C:/amatda && firebase deploy --only functions

# Functions 로그
cd C:/amatda && firebase functions:log
```

### Git
```bash
# 현재 브랜치 (release/v2.9.0)
git branch --show-current

# 출시 태그
git tag v2.9.0 -m "Production release 2026-05-15"
git push --tags

# main으로 머지 (출시 후)
git checkout main
git merge release/v2.9.0
git push origin main
```

---

## 7️⃣ 동결 해제 조건

`FREEZE.md` 동결 해제 = 다음 모두 충족:
- [ ] STEP 1~8 완료
- [ ] Play Store 프로덕션 100% 출시
- [ ] 출시 후 24시간 크래시율 < 1%

→ 충족 시 `FREEZE.md` 삭제 + `CLAUDE.md` 동결 배너 제거 + 신기능 작업 재개

---

## 8️⃣ 자주 막히는 곳 (예방용)

| 막힘 지점 | 해결 |
|---|---|
| EAS 빌드 큐가 길다 | 평일 새벽 빌드 권장. 주말은 더 길다 |
| google-services.json 빌드 누락 | EAS 환경변수에 file 등록 (시크릿 visibility) |
| Play 검토 거부 — "어린이 대상" | 대상 연령층을 "어린이 대상 아님"으로 |
| Play 검토 거부 — 데이터 보안 누락 | PLAY-CONSOLE-METADATA.md 4번 항목 빠짐없이 |
| Play 검토 거부 — 개인정보처리방침 미연결 | URL 정상 접속(HTTPS) + 한글 정책 |
| 단계적 출시 멈춤 | Play Console에서 수동 다음 단계 클릭 필요 |
| OTA 안 받힘 | runtimeVersion 정책 일치 확인. 다른 빌드 사용자는 못 받음 |
| OTA 후 광고/소셜 키 잘못 박힘 | `eas update`에 `--environment preview/production` 누락 → .env 읽음. 항상 명시 |
| Sentry 에러 스택 안 보임 | 빌드 후 source map 업로드 확인 |

---

## 9️⃣ 비상 연락 / 참조

- 이 문서: `RELEASE-FLOW.md`
- 동결 정책: `FREEZE.md`
- 단계 체크: `LAUNCH-CHECKLIST.md`
- 실기기 시나리오: `STEP6-DEVICE-TEST.md`
- Play Console 텍스트: `PLAY-CONSOLE-METADATA.md`
- 개발 진행: `claude-progress.md`
- 핵심 규칙: `CLAUDE.md`
