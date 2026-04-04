# 아맞다(A-matda)

아이의 생년월일시 기반 고유 기질 분석 + 연령/성별 맞춤 육아 솔루션 앱

## Phase 체크리스트

- [x] **Phase 1**: 프로젝트 초기화, Prisma 스키마, Seed, 사주 연산기
- [x] **Phase 2**: Core API (Auth JWT, Children CRUD, Questions, Food)
- [x] **Phase 3**: 프론트 Core (로그인, 온보딩, 홈 화면)
- [ ] **Phase 4**: AI 연동 (관찰 일기, Whisper, GPT-4o)
- [ ] **Phase 5**: LBS (지도, pgvector, 구독, 기질 날씨)
- [ ] **Phase 6**: Polish (OAuth, 푸시, CS 챗봇, 다자녀 궁합)

## 실행 방법

```bash
# 백엔드
cd backend && npm install
npx prisma db push
npx prisma db seed
npm run dev

# 프론트엔드
cd frontend && npm install
npx expo start
```

## 테스트 계정

- Email: test@amatda.com
- Password: test1234
