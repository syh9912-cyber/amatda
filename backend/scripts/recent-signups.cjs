/**
 * recent-signups.cjs — 최근 N일 내 신규 가입 계정 조회.
 * 실행: GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/recent-signups.cjs [days=30]
 */
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'amatda-parenting' });
const db = admin.firestore();

async function main() {
  const days = parseInt(process.argv[2] || '30', 10);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff);

  const snap = await db.collection('users').where('createdAt', '>=', cutoffTs).get();
  console.log(`최근 ${days}일(${cutoff.toISOString().slice(0, 10)} 이후) 신규 가입: ${snap.size}명\n`);

  const rows = snap.docs.map((d) => {
    const u = d.data();
    const c = u.createdAt && u.createdAt.toDate ? u.createdAt.toDate().toISOString().slice(0, 16).replace('T', ' ') : '?';
    return { at: c, provider: u.authProvider || u.provider || '-', email: u.email || '-', nick: u.nickname || '-', id: d.id };
  }).sort((a, b) => a.at.localeCompare(b.at));

  for (const r of rows) {
    console.log(`${r.at} | ${String(r.provider).padEnd(7)} | ${String(r.email).padEnd(30)} | ${r.nick} | ${r.id}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
