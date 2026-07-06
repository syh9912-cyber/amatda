/**
 * create-promo-code.cjs
 *
 * 프로모 코드를 생성/갱신한다. (인플루언서 팔로워 대상 무료 이용권 등)
 * promoCodes/{CODE} 문서를 upsert — 앱의 POST /subscription/premium/redeem-code 가 소비.
 *
 * 실행:
 *   cd backend
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json \
 *     node scripts/create-promo-code.cjs <CODE> <months> <maxRedemptions> [label] [expiresAt-ISO]
 *
 * 예)
 *   node scripts/create-promo-code.cjs ABC3M 3 100 "influencer:@abc"
 *   node scripts/create-promo-code.cjs XMAS 1 500 "event:xmas" 2026-12-31T23:59:59+09:00
 *
 * 끄기(비활성):
 *   node scripts/create-promo-code.cjs <CODE> --off
 *
 * 현황 조회:
 *   node scripts/create-promo-code.cjs --list
 */
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'amatda-parenting' });
}
const db = admin.firestore();

async function list() {
  const snap = await db.collection('promoCodes').get();
  console.log(`[promoCodes] ${snap.size}건:`);
  snap.docs.forEach((d) => {
    const c = d.data();
    console.log(
      `  - ${d.id} | ${c.months}개월 | ${c.redeemedCount || 0}/${c.maxRedemptions || '∞'} | active=${c.active} | ${c.label || ''}`,
    );
  });
}

async function main() {
  if (process.argv[2] === '--list') {
    await list();
    return;
  }

  const code = (process.argv[2] || '').trim().toUpperCase();
  if (!code) {
    console.error('Usage: node create-promo-code.cjs <CODE> <months> <maxRedemptions> [label] [expiresAt]');
    console.error('   or: node create-promo-code.cjs <CODE> --off');
    console.error('   or: node create-promo-code.cjs --list');
    process.exit(1);
  }

  const ref = db.collection('promoCodes').doc(code);

  // 비활성화
  if (process.argv[3] === '--off') {
    await ref.set({ active: false }, { merge: true });
    console.log(`[promoCodes] OFF — ${code} active=false`);
    return;
  }

  const months = parseInt(process.argv[3] || '', 10);
  const maxRedemptions = parseInt(process.argv[4] || '', 10);
  const label = process.argv[5] || '';
  const expiresAt = process.argv[6] || null;

  if (!months || months <= 0) {
    console.error('❌ months 필요 (예: 3)');
    process.exit(1);
  }
  if (Number.isNaN(maxRedemptions) || maxRedemptions < 0) {
    console.error('❌ maxRedemptions 필요 (0=무제한, 예: 100)');
    process.exit(1);
  }

  const existing = await ref.get();
  const redeemedCount = existing.exists ? existing.data().redeemedCount || 0 : 0;

  await ref.set(
    {
      months,
      maxRedemptions,
      redeemedCount, // 기존 사용 횟수 보존
      active: true,
      label,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`[promoCodes] ON — ${code}`);
  console.log(`  ${months}개월 · 한도 ${maxRedemptions || '무제한'} · 사용 ${redeemedCount} · label="${label}"${expiresAt ? ` · 만료 ${expiresAt}` : ''}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(99);
  });
