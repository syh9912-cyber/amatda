/**
 * 사용자 결제 상태 진단 (이메일 기준).
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/check-user.cjs <email>
 */
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'amatda-parenting' });
const db = admin.firestore();

async function main() {
  const email = process.argv[2];
  if (!email) { console.error('Usage: <email>'); process.exit(1); }

  const usnap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (usnap.empty) { console.error('user not found'); process.exit(2); }
  const u = usnap.docs[0];
  const ud = u.data();
  console.log('=== USER ===');
  console.log('  userId        ', u.id);
  console.log('  email         ', ud.email);
  console.log('  tier          ', ud.subscriptionTier ?? 'FREE');
  console.log('  premiumExpAt  ', ud.premiumExpiresAt ?? 'null');
  console.log('  premiumStartAt', ud.premiumStartedAt ?? 'null');
  console.log('  autoRenew     ', ud.subscriptionAutoRenew ?? 'null');

  console.log('\n=== payments (userId match) ===');
  const psnap = await db.collection('payments').where('userId', '==', u.id).orderBy('createdAt', 'desc').limit(5).get();
  if (psnap.empty) {
    console.log('  (none)');
  } else {
    psnap.docs.forEach((d, i) => {
      const data = d.data();
      console.log(`  [${i}] docId=${d.id}`);
      console.log(`      platform=${data.platform} productId=${data.productId} status=${data.status}`);
      console.log(`      paidAt=${data.paidAt} expiresAt=${data.expiresAt}`);
      console.log(`      tokenPrefix=${(data.purchaseToken || data.originalTransactionId || '').substring(0, 20)}...`);
    });
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(99); });
