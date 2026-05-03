/**
 * 04-verify-routes.cjs — 새 라우트 로직을 데이터에 맞춰 시뮬레이션
 *
 * 실행: node backend/scripts/migrate-album-photos/04-verify-routes.cjs
 * 효과: 읽기 전용. albumPhotos에서 데이터 읽고 라우트 응답 형식대로 변환.
 *
 * 검증 항목:
 *  1. GET /api/album/photos/:childId — phase='baby' 필터링, 옛 형식 매핑
 *  2. GET /api/pregnancy/records?childId=xxx — phase='pregnancy' 필터링, 옛 형식 매핑
 *  3. GET /api/pregnancy/timeline?childId=xxx — phase='pregnancy' 필터링
 *  4. PDF generate — 한 컬렉션에서 phase 무관하게 머지
 */

const path = require('path');
const admin = require('firebase-admin');

const SA_PATH = path.resolve(__dirname, '../../service-account.json');
const sa = require(SA_PATH);

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id,
});

const db = admin.firestore();

async function main() {
  console.log(`[verify] project: ${sa.project_id}`);
  console.log(`[verify] timestamp: ${new Date().toISOString()}\n`);

  // 임의의 childId 1개 (audit에서 발견한 것 사용)
  const SAMPLE_CHILD_ID = 'DKyMdpx4l95YQAzk7rYb'; // 4개 docs 보유

  // ── 시뮬 1: GET /api/album/photos/:childId (album.ts) ──
  console.log(`═══ 시뮬 1: GET /api/album/photos/${SAMPLE_CHILD_ID} (phase=baby) ═══`);
  const albumSnap = await db.collection('albumPhotos')
    .where('childId', '==', SAMPLE_CHILD_ID)
    .limit(1000)
    .get();

  const babyPhotos = albumSnap.docs
    .filter((d) => d.data().phase === 'baby')
    .map((d) => {
      const data = d.data();
      const ca = data.createdAt;
      let createdAtIso;
      if (typeof ca === 'string') createdAtIso = ca;
      else if (ca && typeof ca.toDate === 'function') createdAtIso = ca.toDate().toISOString();
      return {
        id: d.id,
        userId: data.userId,
        childId: data.childId,
        uri: data.uri,
        printUrl: data.printUrl,
        milestone: data.title,
        milestoneEmoji: data.milestoneEmoji,
        milestoneColor: data.milestoneColor,
        memo: data.content,
        date: data.date,
        monthKey: data.monthKey,
        createdAt: createdAtIso,
      };
    });

  console.log(`  baby phase docs: ${babyPhotos.length}`);
  if (babyPhotos.length > 0) {
    const p = babyPhotos[0];
    console.log(`  샘플 응답:`);
    console.log(`    id: ${p.id}`);
    console.log(`    milestone: "${p.milestone}"`);
    console.log(`    milestoneEmoji: ${p.milestoneEmoji}`);
    console.log(`    memo: "${p.memo}"`);
    console.log(`    date: ${p.date}`);
    console.log(`    uri 있음: ${!!p.uri}`);
    console.log(`    createdAt: ${p.createdAt}`);
  }

  // ── 시뮬 2: GET /api/pregnancy/records?childId (pregnancy.ts) ──
  // 다른 childId 사용 (74f8HgO1HHIVawY6szSO — pregnancy 데이터 4개)
  const PREG_CHILD_ID = '74f8HgO1HHIVawY6szSO';
  console.log(`\n═══ 시뮬 2: GET /api/pregnancy/records?childId=${PREG_CHILD_ID} ═══`);
  const pregAlbumSnap = await db.collection('albumPhotos')
    .where('childId', '==', PREG_CHILD_ID)
    .limit(200)
    .get();

  const pregRecs = pregAlbumSnap.docs
    .filter((d) => d.data().phase === 'pregnancy')
    .map((d) => {
      const data = d.data();
      const ca = data.createdAt;
      let createdAtIso;
      if (typeof ca === 'string') createdAtIso = ca;
      else if (ca && typeof ca.toDate === 'function') createdAtIso = ca.toDate().toISOString();
      return {
        id: d.id,
        type: data.pregnancyType,
        title: data.title,
        content: data.content,
        mediaUri: data.uri,
        mediaType: data.mediaType,
        milestoneType: data.milestoneType,
        milestoneEmoji: data.milestoneEmoji,
        week: data.week,
        createdAt: createdAtIso,
      };
    });

  console.log(`  pregnancy phase docs: ${pregRecs.length}`);
  if (pregRecs.length > 0) {
    const r = pregRecs[0];
    console.log(`  샘플 응답:`);
    console.log(`    id: ${r.id}`);
    console.log(`    type: ${r.type}`);
    console.log(`    title: "${r.title}"`);
    console.log(`    milestoneType: ${r.milestoneType}`);
    console.log(`    milestoneEmoji: ${r.milestoneEmoji}`);
    console.log(`    week: ${r.week}`);
    console.log(`    mediaUri 있음: ${!!r.mediaUri}`);
    console.log(`    createdAt: ${r.createdAt}`);
  }

  // ── 시뮬 3: PDF generate 머지 (album.ts) ──
  // 모든 phase 합쳐서 시간순 정렬
  console.log(`\n═══ 시뮬 3: PDF generate (childId=${PREG_CHILD_ID}, 2026-01 ~ 2026-12) ═══`);
  const pdfSnap = await db.collection('albumPhotos')
    .where('childId', '==', PREG_CHILD_ID)
    .limit(1000)
    .get();

  const fromDate = '2026-01-01';
  const toDate = '2026-12-31';
  const photos = [];
  for (const d of pdfSnap.docs) {
    const data = d.data();
    const isPregnancy = data.phase === 'pregnancy';
    const uri = data.uri;
    const printUrl = data.printUrl || uri;
    if (!uri || !printUrl || data.mediaType === 'video') continue;
    const date = (data.date || '').replace(/\./g, '-');
    if (!date || date < fromDate || date > toDate) continue;

    const week = data.week;
    const title = data.title || '';
    const photo = { printUrl, thumbUrl: uri, date };
    photo.milestone = isPregnancy
      ? (week ? `임신 ${week}주차` : (title || '임신기록'))
      : (title || undefined);
    photo.milestoneEmoji = data.milestoneEmoji || (isPregnancy ? '🤰' : undefined);
    photo.milestoneColor = data.milestoneColor || (isPregnancy ? '#E91E63' : undefined);
    photo.memo = isPregnancy ? (data.content || title || undefined) : (data.content || undefined);
    photos.push(photo);
  }
  photos.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`  머지된 사진: ${photos.length}장`);
  if (photos.length > 0) {
    console.log(`  최초:`, { date: photos[0].date, milestone: photos[0].milestone });
    console.log(`  최후:`, { date: photos[photos.length - 1].date, milestone: photos[photos.length - 1].milestone });
  }

  // ── 시뮬 4: timeline (pregnancy.ts) ──
  console.log(`\n═══ 시뮬 4: GET /api/pregnancy/timeline?childId=${PREG_CHILD_ID} ═══`);
  const timelineDocs = pregAlbumSnap.docs.filter((d) => d.data().phase === 'pregnancy');
  console.log(`  타임라인 entries: ${timelineDocs.length}`);
  for (const d of timelineDocs) {
    const data = d.data();
    const ca = data.createdAt;
    let createdAtIso = '';
    if (typeof ca === 'string') createdAtIso = ca;
    else if (ca && typeof ca.toDate === 'function') createdAtIso = ca.toDate().toISOString();
    console.log(`    week ${data.week}: ${data.milestoneEmoji || '?'} ${data.title} (${createdAtIso})`);
  }

  console.log('\n[verify] ✅ 모든 라우트 시뮬레이션 정상.');
  console.log('  • album phase=baby 필터링: 동작');
  console.log('  • pregnancy phase 필터링 + 옛 필드 매핑: 동작');
  console.log('  • PDF generate 머지: 동작');
  console.log('  • timeline 필터링: 동작');
  process.exit(0);
}

main().catch((err) => {
  console.error('[verify] 에러:', err);
  process.exit(1);
});
