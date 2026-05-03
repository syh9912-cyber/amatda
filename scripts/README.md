# scripts/

일회성 자동화 스크립트.

## SOS 이미지 일괄 생성

DALL-E 3로 32장의 응급 대처법 일러스트를 일관된 스타일로 생성합니다.

### 사용법

1. **키 준비** — `scripts/.env` 파일 만들고 한 줄만 적기:

   ```
   OPENAI_API_KEY=sk-proj-...
   ```

   (`scripts/.env` 는 이미 `.gitignore` 로 보호됩니다)

2. **테스트 1장 먼저** — 스타일 확인:

   ```bash
   cd /c/amatda
   node scripts/gen-sos-images.js test
   ```

   → `frontend/assets/sos/heimlich-infant-1.png` 생성됨. 열어보고 OK면 진행.

3. **카테고리별 또는 전체 생성**:

   ```bash
   node scripts/gen-sos-images.js heimlich    # 12장
   node scripts/gen-sos-images.js cpr         # 12장
   node scripts/gen-sos-images.js burn_fall   # 4장
   node scripts/gen-sos-images.js foreign     # 4장
   node scripts/gen-sos-images.js all         # 32장 (재실행 시 이미 있는 파일은 skip)
   ```

   - DALL-E 3 standard quality, 1024x1024
   - 비용: 32장 × $0.04 = **약 $1.28** (실비)
   - 시간: ~30분 (rate limit 1초 간격)

4. **사용 끝난 후 반드시:**

   - `rm scripts/.env`
   - https://platform.openai.com/api-keys 에서 키 폐기

### 생성 파일 명세 (32장)

| 카테고리 | 연령 | 파일 | 씬 |
|---------|-----|------|---|
| 기도막힘 | 12개월 미만 | heimlich-infant-1~4 | 받침/등 두드리기/가슴 압박/CPR 전환 |
| 기도막힘 | 1세~사춘기 전 | heimlich-child-1~4 | 위치/주먹 위치/밀어올리기/의식소실 |
| 기도막힘 | 성인 | heimlich-adult-1~4 | 자세/주먹/밀어올리기/혼자할 때 |
| CPR | 12개월 미만 | cpr-infant-1~4 | 기도열기/2-finger 압박/인공호흡/30:2 |
| CPR | 1세~사춘기 전 | cpr-child-1~4 | 기도열기/한손압박/인공호흡/30:2+AED |
| CPR | 성인 | cpr-adult-1~4 | 반응확인/양손압박/체중실어/AED |
| 화상/낙상 | 공통 | burn_fall-1~4 | 찬물/금기 4종/낙상시 자세/24시간 관찰 |
| 이물질 삼킴 | 공통 | foreign-1~4 | 손가락 금지/코 풀기/귀 금지/배터리 응급 |
