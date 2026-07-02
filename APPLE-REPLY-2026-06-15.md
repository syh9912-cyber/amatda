# Apple 심사 회신 (2026-06-15, Submission 083a5ae0)

> ⚠️ **보내기 전 반드시 선행 작업 완료할 것** (아래 "선행 작업" 섹션).
> 선행 작업 안 하면 회신해도 또 같은 사유로 거절됩니다.

---

## 📌 보내기 전 선행 작업 (순서대로)

### 1. 2.1(b) 결제 503 — Apple 시크릿 생성 + 백엔드 배포 + 유료앱 계약
**(A) App Store Connect에서 In-App Purchase 키 발급**
- App Store Connect → 사용자 및 액세스(Users and Access) → 통합(Integrations) →
  키(Keys) → **In-App Purchase** 키 생성 → `.p8` 파일 다운로드
- 메모: **Key ID**(키 목록에 표시), **Issuer ID**(키 페이지 상단)

**(B) Firebase Secret Manager에 4개 등록** (값은 본인 터미널에서 직접 입력 — 프롬프트가 뜸)
```bash
cd backend
npx firebase functions:secrets:set APPLE_ISSUER_ID  --project amatda-parenting
npx firebase functions:secrets:set APPLE_KEY_ID     --project amatda-parenting
npx firebase functions:secrets:set APPLE_PRIVATE_KEY --project amatda-parenting   # .p8 파일 전체 내용(-----BEGIN PRIVATE KEY----- 포함) 붙여넣기
npx firebase functions:secrets:set APPLE_BUNDLE_ID  --project amatda-parenting    # 값: com.sylabs.amatda
```

**(C) 백엔드 배포** (이미 코드는 시크릿을 등록하도록 수정·커밋됨)
```bash
cd backend && npx firebase deploy --only functions --project amatda-parenting
```
- 배포 후 확인: `GET https://api-usglfifguq-uc.a.run.app/payment/status` →
  `apple: true` 면 정상.

**(D) 유료 앱 계약 (Paid Apps Agreement)**
- App Store Connect → 비즈니스(Business) → **Paid Apps 계약 활성(In Effect)** 확인.
  미체결이면 IAP가 작동하지 않음 (Apple이 회신에서 명시).

### 2. 1.4.1 / 1.2 — 새 iOS 빌드(30) 제출
- 출처/EULA 변경은 JS라 OTA로는 심사 빌드에 안전하게 안 닿음 → 새 빌드 필요.
```bash
cd frontend && npx eas build -p ios --profile production --auto-submit --non-interactive
```

### 3. 1.2 — 화면 녹화 (실기기, App Review Information 노트에 첨부)
다음 3가지를 한 영상에 순서대로 보여줄 것:
1. **로그인 전 약관(EULA) 동의 화면** — 커뮤니티 무관용 문구가 보이게
2. **게시물 신고** — 맘스톡 글 → 메뉴 → 신고
3. **사용자 차단** — 맘스톡 글 → 메뉴 → 차단

---

## ✉️ 회신문 (영문 — App Store Connect에 붙여넣기)

> 아래는 선행 작업(시크릿+배포+유료앱계약+새 빌드+녹화)을 모두 마친 뒤 보낼 것.

Hello,

Thank you for the detailed feedback. We have addressed all three items.

**Guideline 1.4.1 — Medical citations**
We added clearly visible source citations to the AI chat ("상담이모") feature. Directly beneath the medical disclaimer banner — persistently visible at the top of the chat — users now see tappable links to authoritative medical sources:
- Korea Disease Control and Prevention Agency (KDCA) National Health Information Portal — health.kdca.go.kr
- The Korean Pediatric Society — pediatrics.or.kr

All other screens that present health information (fever guide, stool/cry analysis, nutrition, vaccination, maternal health, etc.) already include an on-screen "Sources (정보 출처)" citation block with links. The citations are easy to find and always visible on the relevant screens.

**Guideline 1.2 — User-Generated Content**
The app implements the following moderation precautions:
- Posting is account-based (no anonymous posting).
- An automated profanity/abusive-language filter blocks objectionable submissions.
- Users can report/flag objectionable content.
- Users can block abusive users (blocked users' content is removed from the feed immediately).
- Users must agree to our Terms/EULA before registering or logging in. The agreement screen now explicitly states a zero-tolerance policy for objectionable content and abusive users, that violations result in content removal and account restriction, and that reporting and blocking tools are provided.

A screen recording captured on a physical device demonstrating (1) the EULA/terms agreement presented before registration, (2) the report/flag mechanism, and (3) the block-user mechanism has been added to the Notes field of the App Review Information section.

**Guideline 2.1(b) — In-App Purchase**
We identified and fixed the cause of the purchase error. Our backend receipt-verification service returned HTTP 503 because the Apple App Store Server API credentials were not being injected into the server runtime environment. We corrected the configuration so the credentials are loaded correctly, and the verification endpoint now functions. We have also confirmed the Paid Apps Agreement is in effect. In-App Purchases now complete successfully in the sandbox.

A new build (1.0 build 30) including the 1.4.1 and 1.2 changes has been submitted.

Thank you for your time and review.

Best regards,
SY Labs
