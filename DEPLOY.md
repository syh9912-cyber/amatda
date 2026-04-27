# DEPLOY.md — 빌드/배포/OTA 정책
> 배포 관련 모든 정책은 이 파일에서 관리한다.
> CLAUDE.md에는 배포 명령을 반복하지 않는다.

---

## 버전 관리 원칙
- `app.json`의 `version`: 기능 변경 시 올림 (예: 2.1.0 → 2.2.0)
- `runtimeVersion`: **"1.0.0" 고정** — 절대 변경 금지
  - 변경하면 기존 APK가 OTA 업데이트를 받지 못함
- 회사명: SY Labs

---

## 빌드 프로필 (eas.json)

| 프로필 | 용도 | 결과물 | OTA 채널 |
|--------|------|--------|----------|
| `preview` | 테스트/내부 배포 | APK | preview |
| `production` | Play Store 배포 | AAB | production |
| `development` | 로컬 개발 | APK (dev client) | - |

> ⚠️ OTA는 **반드시 `--branch preview`** 로만 배포한다.
> `--branch production`으로 배포하면 APK에서 업데이트가 적용되지 않는다.

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
```bash
cd frontend && npx eas update --branch preview --message '변경 내용'
```

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
