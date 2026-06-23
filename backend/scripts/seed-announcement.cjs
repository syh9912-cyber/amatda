/**
 * seed-announcement.cjs
 *
 * 앱 시작 공지 팝업(announcements 컬렉션)을 켜고/끈다.
 * 테스터 모집 공지를 안정적인 문서 ID로 upsert → active:true 로 노출.
 *
 * 실행:
 *   cd backend
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/seed-announcement.cjs
 *
 * 끄려면(전체 비활성):
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/seed-announcement.cjs off
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'amatda-parenting' });
}

const db = admin.firestore();
const DOC_ID = 'tester-recruit-2026';

const ANNOUNCEMENT = {
  title: '🎁 출시 기념 테스터 100명 모집',
  body:
    '✨ 전원 혜택\n' +
    '• 프리미엄 1년 무료 (39,900원 상당)\n' +
    '• AI 코칭 무제한 · 광고 완전 제거\n\n' +
    '🏆 우수 리뷰어 5명\n' +
    '• 신세계상품권 10만원\n\n' +
    '📅 모집 6월 22일 ~ 6월 28일\n' +
    '📣 발표 7월 1일',
  imageUrl: null,
  linkUrl: 'https://forms.gle/yRigYK7fSxWeqVke7',
  linkLabel: '📝 신청하기',
  active: true,
  priority: 100,
  endAt: '2026-07-02T00:00:00+09:00', // 발표(7/1) 후 자동 비노출
};

async function main() {
  const off = process.argv[2] === 'off';

  // 현재 announcements 현황 출력
  const all = await db.collection('announcements').get();
  console.log(`[seed-announcement] 기존 공지 ${all.size}건:`);
  all.docs.forEach((d) => {
    const a = d.data();
    console.log(`  - ${d.id} | active=${a.active} | "${(a.title || '').slice(0, 30)}"`);
  });

  if (off) {
    await db.collection('announcements').doc(DOC_ID).set({ active: false }, { merge: true });
    console.log(`[seed-announcement] OFF — ${DOC_ID} active=false`);
    return;
  }

  await db.collection('announcements').doc(DOC_ID).set(
    { ...ANNOUNCEMENT, createdAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );
  console.log(`[seed-announcement] ON — ${DOC_ID} active=true 노출 설정 완료`);
  console.log(`  title: ${ANNOUNCEMENT.title}`);
  console.log(`  link : ${ANNOUNCEMENT.linkUrl}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(99);
  });
