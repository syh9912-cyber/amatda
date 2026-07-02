# Apple 심사 회신 — 1.4.1 의료 정보 출처 (2026-06-16, Submission 998588b1)

## 무엇이 문제였나
- Apple이 build 30에서 4개 화면에 "출처(citation)가 없다"고 재지적.
- 실제로는 build 30에도 출처 블록이 있었음. 단, **화면 맨 아래**에 있어서
  iPad 리뷰어가 스크롤 끝까지 내려가지 않아 "찾을 수 없다"고 판단한 것으로 추정.
- Apple 지침 핵심 문구: *"The citations should be easy for the user to find."*
- 이전 4차 대응 때 Apple이 인정한 패턴 = AI 챗 상단에 **항상 보이는** 출처 링크.

## 4개 지적 화면 → 실제 파일 매핑
| Apple 표기 | 화면(모드) | 파일 |
|---|---|---|
| 시기별 맞춤 가이드 | 주수별 발달(임신 모드) | `growth-stats.tsx` (임신 분기) |
| 성장 기록 & 통계 | 성장 통계(영유아 모드) | `growth-stats.tsx` (영유아 분기) |
| 혈당 & diet | 임당 관리 | `gdm.tsx` |
| 산전·산후 우울감 자가 체크 | 마음 진단(EPDS) | `mom-wellness.tsx` |

## 수정 내용 (코드)
- `components/common/MedicalCitation.tsx`: `compact`(접이식) 모드 추가.
  - 제목 줄 "📚 의학 정보 출처 · 근거"는 **항상 노출**, 탭하면 출처·링크·면책 문구가 펼쳐짐.
- 위 3개 파일에서 출처 블록을 **화면 맨 아래 → 헤더 바로 아래(상단)**로 이동하고 compact 적용.
  - 긴 스크롤 없이 즉시 보이도록 함.
- 검증: `tsc --noEmit` 0 errors, `expo lint` 0 errors.

## 재제출 절차 (JS 변경은 OTA로 심사 빌드에 안 닿음 → 새 빌드 필요)
```bash
cd frontend && npx eas build -p ios --profile production --auto-submit --non-interactive
```
- EAS 원격 버전 관리(appVersionSource: remote) 사용 중 → 빌드 번호 자동 증가(30 → 31).
  app.json의 version/buildNumber는 직접 수정하지 말 것.
- 빌드·제출 완료 후 아래 회신문을 App Store Connect에 붙여넣기.

---

## ✉️ 회신문 (영문)

Hello,

Thank you for the follow-up. We have made the medical-information source citations easy to find on each of the screens you identified.

In the previous build the source citations were present but placed at the bottom of these screens, below the content, so they were easy to miss on a long screen. We have now moved a clearly visible "📚 의학 정보 출처 · 근거 (Medical information sources & references)" section to the **top of each screen, directly under the header**, so it is the first thing the user sees. Tapping it expands the full list of authoritative sources with tappable links, plus a disclaimer that the information is for general reference and does not replace professional medical advice.

The sources now shown at the top of each flagged screen:

- **시기별 맞춤 가이드 / 성장 기록 & 통계 (Stage guide & Growth stats):** Korea Disease Control and Prevention Agency & The Korean Pediatric Society "2017 Growth Charts for Children and Adolescents"; WHO Child Growth Standards; Ministry of Health and Welfare "아이사랑" pregnancy week-by-week information; Korean Society of Obstetrics and Gynecology.
- **혈당 & diet (Blood glucose & diet):** Korean Diabetes Association "Clinical Practice Guidelines (Gestational Diabetes)"; Ministry of Food and Drug Safety Food Nutrient Database.
- **산전·산후 우울감 자가 체크 (Prenatal/Postnatal depression self-check):** Edinburgh Postnatal Depression Scale (Cox, Holden & Sagovsky, 1987); Ministry of Health and Welfare National Mental Health Information Portal.

All other screens that present health information continue to display an on-screen "정보 출처 (Sources)" section with links and a disclaimer.

A new build (build 31) including these changes has been submitted.

Thank you for your time and review.

Best regards,
SY Labs
