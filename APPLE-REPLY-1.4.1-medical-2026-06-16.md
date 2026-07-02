# Apple 회신 — 1.4.1 의료기기 규제 (2026-06-16, build 31 거절 대응)

> ⚠️ 이 회신문은 **변경사항이 포함된 새 빌드(32)를 제출한 뒤** 보낼 것.
> (코드 수정 커밋: b17ada5 — 의료 기능을 '참고 정보'로 완화 + 면책 강화)

---

## 거절 요지
- 1.4.1: 앱이 **의료 측정·진단·치료 조언**을 제공하는데 **규제 승인이 없다** → 승인 서류 제출 요구.
- 개인 개발자는 의료기기 인증 불가 → **"진단·측정·치료가 아니라 정보 제공용"**으로 재정의 + 면책 강화로 대응.

## 적용한 코드 변경 (요약)
1. 열나열나: 해열제 명령형("먹여야 합니다")→참고형, "진단·치료 목적 아님" 면책 강화
2. 마음 진단→**마음 건강 자가체크**(진단 단어 제거), 결과에 "진단 아님" 면책
3. 임당: 혈당 분류 "일반 참고 기준, 진단 아님" 면책
4. 응가/울음: "가능성 분석 (참고 추정)" + 면책 강화
5. SOS: 결과 카드에 "진단 아님" 면책(119 안내는 안전상 유지)

---

## ✉️ 회신문 (영문 — App Store Connect Resolution Center에 붙여넣기)

Hello,

Thank you for the review. We would like to clarify the nature of the app and describe the changes we have made.

**Amatda (아맞다) is an informational and record-keeping parenting app. It is not a medical device and does not provide medical diagnosis, clinical health measurements, or treatment.** It does not connect to or rely on any medical hardware. All health-related content is general, educational reference information, and the app consistently directs users to consult licensed medical professionals. For this reason we do not hold, and we respectfully believe the app does not require, medical regulatory clearance.

To remove any ambiguity, we have revised the app so this is unmistakable on every health-related screen:

1. **Fever section:** Antipyretic information is now presented as general reference information only, not as an instruction to treat. We changed imperative wording (e.g., "give X ml now") to reference phrasing ("Reference: approx. X ml — administer only after consulting a doctor/pharmacist"), and added a prominent disclaimer stating the content "does not constitute a medical act for the purpose of diagnosis or treatment," and that all dosing must be decided in consultation with a pediatrician or pharmacist.

2. **Maternal mood self-check (EPDS):** Renamed from "Mind Diagnosis" to "Mental-Health Self-Check." The result now clearly states it is "a reference self-check, not a medical diagnosis," and directs users to mental-health professionals and crisis hotlines. It presents the standard EPDS questionnaire for self-reflection only, consistent with other self-check apps available on the App Store.

3. **Blood glucose log:** This is a user-entered logbook. Reference ranges are explicitly labeled "general reference, not a diagnosis," with a disclaimer directing users to their physician.

4. **Stool/cry analysis:** Re-labeled as "(reference estimate)," and the disclaimer clarifies it is "reference information, not a medical act for diagnosis or treatment."

5. **Emergency/symptom guidance:** Presented as general safety information with a disclaimer that it is "not a medical diagnosis." It directs users to call emergency services (119) or visit an emergency room when in doubt. We have intentionally retained these safety prompts because removing them would be less safe for users.

Across all health-related screens, a persistent "Medical information sources" section with authoritative citations and a disclaimer is shown, and each feature reminds users to consult a licensed professional before making any medical decision.

A new build including all of these changes has been submitted for review. If there is a specific feature you still consider to require regulatory clearance, we would be grateful if you could identify it so that we can address it precisely. We are also happy to discuss this on a call.

Thank you for your time and review.

Best regards,
SY Labs
