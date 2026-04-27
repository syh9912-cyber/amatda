# A-matda Codex Progress

> Last updated: 2026-04-23
> Note: `Codex-progress.md` was missing. Existing history was reviewed from `claude-progress.md`.

---

## 2026-04-23 Release Audit Stabilization

### Modified files
| File | Purpose |
|------|---------|
| `.gitignore` | Prevent signing keys, OAuth secret text files, Firebase config files, and local secret docs from being committed accidentally. |
| `frontend/.gitignore` | Add frontend-local OAuth/signing secret ignore patterns. |
| `backend/src/services/firestore.ts` | Add an explicit Cloud Storage bucket type annotation so backend declaration output does not infer a non-portable nested dependency path. |
| `frontend/components/ads/AdSlot.tsx` | Make mock ads opt-in only with `EXPO_PUBLIC_ADS_MOCK=true`; missing env no longer shows mock ad UI in release builds. |
| `frontend/eas.json` | Explicitly disable mock ads for preview and production EAS profiles. |
| `Codex-progress.md` | Recreate Codex work log required by project rules. |

### Cause
- Release builds should not show placeholder/mock ad inventory when mock env flags are omitted.
- Sensitive local files existed at the repo root and needed stronger ignore coverage.
- Backend storage export should be declaration-safe for production builds and CI.
- The required Codex progress document was missing from the workspace.

### Resolution
- Hardened ignore rules for signing, OAuth, and Firebase local config artifacts.
- Changed mock ad behavior from default-on to explicit opt-in.
- Added explicit `Bucket` typing for Firebase Storage bucket export.
- Recorded remaining high-risk audit items separately instead of changing Rule-of-Two areas without a dedicated approval step.

### Validation
- `cd backend && npx tsc --noEmit` passed.
- `cd frontend && npx tsc --noEmit` passed.
- `cd frontend && npx expo lint` passed with 60 warnings and 0 errors. Warnings are concentrated in existing screens such as `baby-tracker.tsx`, `academy.tsx`, `child-card.tsx`, and several hook dependency/import-order issues.
- `cd frontend && npx expo config --type public` passed. It still shows Android `SCHEDULE_EXACT_ALARM` and local `.env` export of `EXPO_PUBLIC_NAVER_CLIENT_SECRET`, so both remain release audit follow-ups.

### Remaining issues requiring explicit approval
- Naver login currently references `EXPO_PUBLIC_NAVER_CLIENT_SECRET` in frontend code. Moving secret handling to backend changes the authentication flow and requires Rule-of-Two approval before implementation.
- Coaching and media analysis handlers still return mock-looking AI results when Gemini is unavailable or fails. Replacing this with explicit retry/failure UX changes the AI pipeline and requires Rule-of-Two approval before implementation.
- Many Firestore writes still use ISO strings from `new Date().toISOString()`. Migrating stored fields to `FieldValue.serverTimestamp()` can change stored data types and requires schema compatibility review before implementation.
- Store review follow-up remains needed for Android `SCHEDULE_EXACT_ALARM`, location permission prompts, and privacy/terms contact consistency.
- Root secret-looking files remain present locally (`amatda-keystore-backup.jks`, `Web Client의IDSecret.txt`, `아맞다 키스토어.txt`) but are now covered by ignore rules. They should not be committed.
