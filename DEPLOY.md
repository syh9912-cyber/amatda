# DEPLOY.md — 빌드/배포/OTA 정책
> 배포 관련 모든 정책은 이 파일에서 관리한다.
> CLAUDE.md에는 배포 명령을 반복하지 않는다.

---

## 버전 관리 원칙
- `app.json`의 `version`: 기능 변경 시 올림 (예: 2.1.0 → 2.2.0)
- `runtimeVersion`: **`{ "policy": "appVersion" }`** — `version` 값과 자동 연동 (현재 2.9.1)
  - ⚠️ `version`을 올리면 `runtimeVersion`도 함께 올라간다.
  - OTA는 **동일 runtimeVersion 빌드에만** 적용되므로, `version`을 올린 뒤 OTA를 쏘면 그 전 버전 APK는 해당 OTA를 못 받는다.
  - 따라서 OTA만으로 배포할 변경이면 `version`을 유지하고, version을 올렸다면 신규 APK/AAB 빌드도 함께 배포할 것.
- `eas.json`: `appVersionSource: "remote"` (버전 소스는 EAS 원격 관리)
- 회사명: SY Labs

---

## 빌드 프로필 (eas.json)

| 프로필 | 용도 | 결과물 | OTA 채널 |
|--------|------|--------|----------|
| `preview` | 테스트/내부 배포 | APK | preview |
| `production` | Play Store 배포 | AAB | production |
| `development` | 로컬 개발 | APK (dev client) | - |

> ℹ️ OTA 배포 채널 정책 (2026-06-06 업데이트 — 실제 운영 기준):
> - 정식 사용자 대상 OTA는 **`--branch production`** 으로 배포한다.
> - `preview` 브랜치는 내부 테스트용으로 필요 시 선택적으로 함께 배포한다.
> - OTA는 **동일 `runtimeVersion` 빌드에만** 도달한다. runtime이 다른 빌드에는 적용되지 않으므로 배포 후 발행된 runtimeVersion을 확인할 것.

---

## 환경변수 규칙

- `EXPO_PUBLIC_*` 변수는 **빌드 시점에 APK에 고정**된다 (OTA로 변경 불가)
- 새 Cloud Run URL/함수가 추가되면 **반드시 APK 재빌드 필요**
- 모든 빌드 프로필(preview, production)에 동일한 URL 변수를 명시할 것
- 시크릿/키는 `eas.json`에 직접 넣지 말고 EAS Secrets 또는 `.env`로 관리

---

## 배포 명령

### 백엔드 배포
```bash
cd backend && npm run build
firebase deploy --only functions
```

### OTA 업데이트 (코드 변경, 환경변수 변경 없을 때)

> 🚨 **반드시 `eas env:exec production` 으로 감싸서 배포할 것.**
> `eas update` 는 **로컬에서 번들링**하므로, 환경을 명시하지 않으면 `EXPO_PUBLIC_*` 값을
> 로컬 `.env` 에서 읽어 번들에 그대로 구울 위험이 있다. `eas.json` 의 build env 는 OTA 에
> 적용되지 않는다(그건 `eas build` 전용). 환경을 명시해야 **개발용 값이 실 사용자에게
> 나가는 사고**를 확실히 막을 수 있다.
>
> **검증된 사실 (2026-07-16)**
> - 로컬 `.env` 에는 구글 **테스트 광고 ID** 가 들어있었고, `expo export` 로 로컬 번들을 뽑으면
>   그 테스트 ID 가 실제로 구워지는 것을 확인함 → **환경 미지정 시의 실질적 위험**.
> - `eas env:exec production` 을 씌우면 EAS 서버의 **실제 광고 ID 가 주입**되는 것도 번들에서 확인함.
> - ⚠️ 다만 **"production OTA 로 테스트 광고가 실제 배포된 사고"는 확인되지 않았다.**
>   당시 프로덕션 앱은 실제 광고가 정상 게재 중이었고 AdMob 수익도 발생하고 있었다.
>   (테스트 광고는 preview 프로필 빌드의 정상 동작) 과거 2026-06-22 에는 반대로
>   광고 ID 가 빠져 "유닛아이디 미설정" 이 뜬 적이 있어, EAS 서버 환경에 값을 등록해 해결했다.
> - 결론: 사고가 난 적은 없지만 **구조적으로 언제든 날 수 있는 형태**였으므로, 아래처럼
>   환경을 명시하는 것을 표준 절차로 고정한다.

```bash
# 정식 배포 (Play Store 사용자 대상) — production 환경변수 주입 필수
cd frontend && npx eas env:exec production \
  "npx eas update --branch production --message 변경내용 --non-interactive"

# 내부 테스트 배포 (선택)
cd frontend && npx eas env:exec preview \
  "npx eas update --branch preview --message 변경내용 --non-interactive"
```

> ⚠️ `env:exec` 의 bash 명령은 중첩 따옴표가 깨지므로 `--message` 는 **공백 없이**
> (예: `fix-ads-restore`) 쓰거나 하이픈으로 잇는다.

**배포 후 검증 (광고·API 주소 등 환경변수가 걸린 변경일 때 필수)**
```bash
# production env 를 주입해 로컬 export 후, 번들에 실제 값이 박혔는지 확인
cd frontend && npx eas env:exec production \
  "npx expo export --platform android --output-dir /tmp/verify-bundle"
# 번들(.hbc) 안에서 실제 광고 유닛 ID(ca-app-pub-1736147235986434/...) 존재 확인
```
> EAS CDN 의 배포 번들은 직접 다운로드가 403 이라, 위처럼 **같은 env 로 로컬 export 해서
> 검증**하는 것이 실질적인 확인 방법이다.

### APK 빌드 (환경변수 추가/변경, 네이티브 모듈 변경 시)
```bash
cd frontend && npx eas build -p android --profile preview
```

### Play Store 빌드
```bash
cd frontend && npx eas build -p android --profile production
```

---

## 언제 APK 재빌드가 필요한가?

| 변경 종류 | OTA 가능 | APK 재빌드 필요 |
|-----------|----------|-----------------|
| JS 코드 변경 | ✅ | - |
| `EXPO_PUBLIC_*` 환경변수 추가/변경 | ❌ | ✅ |
| 새 네이티브 모듈 추가 (expo-av 등) | ❌ | ✅ |
| 새 Cloud Run 함수 URL 추가 | ❌ | ✅ |
| app.json version 변경 | - | ✅ (선택) |
| 아이콘/스플래시 이미지 변경 | ❌ | ✅ |

---

## 배포 후 검증 체크리스트

- [ ] Firebase Functions 로그 에러 없음 확인
- [ ] 수정한 API 엔드포인트 실제 호출 확인 (PowerShell Invoke-WebRequest)
- [ ] Firestore 실데이터 포맷 확인
- [ ] 새 Firestore 인덱스 빌드 완료 확인 (Firebase Console)
- [ ] OTA 적용 확인 (앱 재시작 후 업데이트 수신)

---

## Axios + baseURL 주의사항
> 오늘(2026-04-16) 발생한 코칭 404 버그 재발 방지

- `baseURL = 'https://.../api'` (trailing slash 없음)
- 요청 path는 **leading slash 없이** 작성: `'coaching/ask'` ✅ / `'/coaching/ask'` ❌
- leading slash가 있으면 Axios가 baseURL의 path를 버리고 host에만 붙임
- 새 API 경로 추가 시 이 규칙 반드시 준수
