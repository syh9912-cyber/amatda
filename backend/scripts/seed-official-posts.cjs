/**
 * seed-official-posts.cjs
 *
 * 공식 계정(users.{uid}.isOfficial === true) 1개 이상에 대해
 * 사전에 작성된 시드 게시글을 momGroupPosts 컬렉션에 일괄 삽입.
 *
 * 멱등성: 마커 필드 `_seedKey`로 중복 방지. 이미 같은 _seedKey의 글이 있으면 스킵.
 *
 * 실행:
 *   cd backend
 *   node scripts/seed-official-posts.cjs --dry      # 미리보기
 *   node scripts/seed-official-posts.cjs --apply    # 실제 작성
 *
 * 작성된 글은 자동으로:
 *   - isOfficial: true
 *   - isPinned: false (필요하면 앱에서 토글)
 *   - 위치/연도 무관 (전국 노출)
 */

const path = require('path');
const admin = require('firebase-admin');

// 서비스 계정 — 환경변수 GOOGLE_APPLICATION_CREDENTIALS 필요
// 또는 firebase functions config 통해서도 가능. 가장 단순한 건 cred 파일.
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'amatda-parenting',
  });
}

const db = admin.firestore();
const POSTS = db.collection('momGroupPosts');
const USERS = db.collection('users');

// ── 시드 게시글 콘텐츠 ────────────────────────────────────────
// 작성 가이드: 일반 정보 위주 + 의학적 진단·처방 X + 마지막에 참여 유도 한 줄
const SEED_POSTS = [
  // 정보 카테고리 (가장 신뢰감)
  {
    _seedKey: 'info-newborn-sleep-v1',
    category: 'info',
    title: '신생아 수면 시간 가이드 (월령별)',
    content:
      '0~3개월: 하루 14~17시간 (한 번에 2~4시간씩 짧게 자요)\n4~6개월: 하루 12~15시간 (밤잠이 길어지기 시작)\n7~12개월: 하루 12~14시간 (낮잠 2회 → 1회로 줄어듭니다)\n\n이 시기 잠을 적게 잔다고 너무 걱정 마세요. 평균보다 ±2시간은 정상 범위예요. 우리 아기는 어떤가요? 댓글로 공유해주세요 💛',
  },
  {
    _seedKey: 'info-weaning-start-v1',
    category: 'info',
    title: '이유식 시작 시기와 단계별 식재료',
    content:
      '시작 시기: 생후 4~6개월 (목 가누기 + 침 흘리기 + 음식에 관심 보이면 OK)\n\n초기(4~6개월): 쌀미음 → 채소(애호박, 단호박) → 과일(사과, 배)\n중기(7~9개월): 닭고기, 흰살생선, 두부 추가\n후기(10~12개월): 잘게 다진 고기, 잎채소, 달걀노른자\n\n알레르기 가능성 있는 식재료(달걀흰자, 견과류)는 12개월 이후 권장. 이유식 시작하신 분들 어떤 재료부터 시작하셨어요?',
  },
  {
    _seedKey: 'info-vaccine-schedule-v1',
    category: 'info',
    title: '예방접종 필수 일정 한눈에 보기',
    content:
      '0~6개월:\n· B형간염 (출생, 1, 6개월)\n· BCG (4주 이내)\n· DTaP·소아마비·b형헤모필루스 (2, 4, 6개월)\n· 폐렴구균 (2, 4, 6개월)\n· 로타바이러스 (2, 4개월)\n\n12~15개월:\n· MMR (홍역·볼거리·풍진)\n· 수두\n· A형간염 1차\n\n자세한 일정은 보건소·소아과에서 받은 수첩 기준으로. 까먹기 쉬우니 앱 알림 설정 추천드려요!',
  },
  {
    _seedKey: 'info-development-checkpoint-v1',
    category: 'info',
    title: '월령별 발달 체크포인트 (3·6·9·12개월)',
    content:
      '3개월: 고개 들기, 옹알이, 미소 반응\n6개월: 뒤집기, 앉기 시작, 손 뻗기\n9개월: 기기, 짚고 일어서기, "엄마/아빠" 옹알\n12개월: 첫 걸음, 첫 단어, 손가락으로 가리키기\n\n아이마다 ±2~3개월 차이는 정상이에요. 너무 걱정되면 영유아 검진 때 의사에게 꼭 물어보세요. 정기 검진은 소중한 기회입니다.',
  },
  {
    _seedKey: 'info-bottle-sterilize-v1',
    category: 'info',
    title: '젖병·유축기 소독 — 안전한 4가지 방법',
    content:
      '1. 끓는 물 소독: 가장 보편적. 5~10분 담그기. 실리콘은 변형 주의.\n2. 전자레인지 소독기: 5~8분. 빠르고 안전, 매일 사용 권장.\n3. 자외선(UV) 소독기: 잔수 없이 건조 가능. 3개월 이후 자주 사용.\n4. 약물(밀튼) 소독: 외출 시 또는 화상 위험 있을 때.\n\n생후 3개월까지는 매번 소독. 이후 점진적으로 일상 세척 + 주 1~2회 소독으로 줄이셔도 OK입니다.',
  },
  {
    _seedKey: 'info-pregnancy-nt-v1',
    category: 'info',
    title: '임신 11~13주 — 1차 기형아 검사(NT) 체크 포인트',
    content:
      'NT(목투명대) 검사는 11~13주 6일 사이에만 가능해요.\n\n준비:\n· 공복 X (편하게 식사 후 가도 됨)\n· 충분한 물 섭취 (방광이 차야 잘 보임)\n· 검사 시간 약 20~30분\n\n결과 해석은 의사가 정확히 설명해줄 거예요. 수치 자체보다 의사 상담이 중요합니다. 검사 받으신 분들 후기 공유해주시면 좋겠어요!',
  },

  // 질문 카테고리 (대화 유도)
  {
    _seedKey: 'q-hardest-period-v1',
    category: 'question',
    title: '여러분이 가장 힘들었던 육아 시기는 언제예요?',
    content:
      '신생아 통잠 안 자는 시기? 이앓이? 미운 두살?\n\n저희 운영팀이 모은 후기로는 의외로 "100일~6개월"이 가장 많았어요. 혼자가 아닌 거 알아주세요. 댓글로 본인 가장 힘든 시기 + 어떻게 버티셨는지 공유해주세요. 나중에 오는 분들에게 큰 위로가 됩니다 💛',
  },
  {
    _seedKey: 'q-best-baby-item-v1',
    category: 'question',
    title: '가장 도움된 육아용품 1가지만 추천한다면?',
    content:
      '딱 하나만! 없으면 못 살 것 같았던 그 아이템.\n\n예시: 아기띠, 모빌, 분유포트, 휴대용 비데, 전동 흔들침대...\n\n태어나기 전 준비하는 분들에게 정말 도움됩니다. 후회한 아이템도 같이 적어주시면 더 도움될 거예요. 저희도 댓글 모아서 다음 정보 글로 정리해드릴게요!',
  },

  // 수다 카테고리
  {
    _seedKey: 'chat-today-mood-v1',
    category: 'chat',
    title: '오늘 엄마 컨디션 한 줄로 공유해요 💛',
    content:
      '잠 못 자서 좀비 모드 😴\n점심 못 먹고 버티는 중 🍙\n오늘은 컨디션 좋음! ✨\n남편이 도와줘서 살았어요 💛\n\n어떤 식으로든 좋아요. 한 줄씩 댓글 달아주세요. 다른 엄마들 보고 "나만 그런 게 아니구나" 위로받는 거 좋아요. 우리 같이 힘내요!',
  },

  // 축하/공지
  {
    _seedKey: 'celebration-welcome-v1',
    category: 'celebration',
    title: '안녕하세요, 아맞다 운영팀입니다 🎉',
    content:
      '맘스톡에 오신 것을 환영해요!\n\n여기는 같은 시기 엄마들이 모여 정보 나누고, 위로하고, 함께 성장하는 공간이에요.\n\n· 질문하기: 궁금한 거 부담 없이 ❓\n· 정보 나누기: 도움된 팁 공유 📚\n· 일상 수다: 오늘 어땠는지 한 마디 💬\n· 고민 털기: 힘들 때 마음 풀기 😔\n· 축하받기: 우리 아기 첫 이벤트 🎉\n\n좋은 인연 만드세요. 운영팀이 항상 함께합니다.',
  },
];

const SEED_KEY_FIELD = '_seedKey';

async function findOfficialUsers() {
  const snap = await USERS.where('isOfficial', '==', true).get();
  const list = [];
  snap.forEach((d) => {
    const data = d.data();
    list.push({
      id: d.id,
      nickname: data.nickname || '아맞다 공식',
      lat: data.lat,
      lng: data.lng,
      babyBirthYear: data.babyBirthYear,
    });
  });
  return list;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function seedForUser(user, dryRun) {
  console.log(`\n[user] ${user.id} (${user.nickname})`);
  let created = 0;
  let skipped = 0;

  for (const seed of SEED_POSTS) {
    // 멱등 체크: 동일 _seedKey 게시글이 이 user 명의로 이미 있나?
    const existing = await POSTS
      .where(SEED_KEY_FIELD, '==', seed._seedKey)
      .where('userId', '==', user.id)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log(`  - skip [${seed._seedKey}] (already exists)`);
      skipped++;
      continue;
    }

    const doc = {
      groupKey: currentMonthKey(),
      userId: user.id,
      nickname: user.nickname,
      category: seed.category,
      anonymous: false,
      title: seed.title,
      content: seed.content,
      imageUrl: null,
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      reportCount: 0,
      hidden: false,
      isOfficial: true,
      isPinned: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      [SEED_KEY_FIELD]: seed._seedKey,
    };
    if (typeof user.lat === 'number' && typeof user.lng === 'number') {
      doc.lat = user.lat;
      doc.lng = user.lng;
    }
    if (typeof user.babyBirthYear === 'number') {
      doc.babyBirthYear = user.babyBirthYear;
    }

    if (dryRun) {
      console.log(`  + DRY [${seed._seedKey}] ${seed.title}`);
      created++;
    } else {
      await POSTS.add(doc);
      console.log(`  + CREATE [${seed._seedKey}] ${seed.title}`);
      created++;
    }
  }
  console.log(`  → created: ${created}, skipped: ${skipped}`);
  return { created, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry') || !args.includes('--apply');

  console.log(`mode: ${dryRun ? 'DRY RUN (use --apply to write)' : 'APPLY'}`);

  const officials = await findOfficialUsers();
  if (officials.length === 0) {
    console.log('\nNo official users found. users/{uid}.isOfficial: true 인 계정이 없어요.');
    process.exit(1);
  }
  console.log(`\nofficial users: ${officials.length}`);

  let totalCreated = 0;
  let totalSkipped = 0;
  for (const u of officials) {
    const { created, skipped } = await seedForUser(u, dryRun);
    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log(`\n=== TOTAL ===`);
  console.log(`created: ${totalCreated}, skipped: ${totalSkipped}`);
  if (dryRun) {
    console.log('\n실제로 작성하려면: node scripts/seed-official-posts.cjs --apply');
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
