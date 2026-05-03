/**
 * seed-official-posts.cjs
 *
 * 공식 계정마다 다른 게시글을 분배해서 작성.
 * 계정 0번 → POSTS_A (운영팀 페르소나, 정보·공지 위주)
 * 계정 1번 → POSTS_B (도우미 페르소나, 질문·수다·공감 위주)
 * 계정 2번+ → POSTS_A 재사용 (확장 가능)
 *
 * 멱등성: _seedKey로 중복 방지.
 *
 * 실행:
 *   cd backend
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/seed-official-posts.cjs --dry
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/seed-official-posts.cjs --apply
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/seed-official-posts.cjs --cleanup     # _seedKey 있는 글 모두 삭제
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'amatda-parenting' });
}

const db = admin.firestore();
const POSTS = db.collection('momGroupPosts');
const USERS = db.collection('users');

// ── A 셋: 운영팀 페르소나 (정보·공지) ─────────────────────────────────────
const POSTS_A = [
  {
    _seedKey: 'a-info-newborn-sleep-v1',
    category: 'info',
    title: '신생아 수면 시간 가이드 (월령별)',
    content:
      '0~3개월: 하루 14~17시간 (한 번에 2~4시간씩 짧게 자요)\n4~6개월: 하루 12~15시간 (밤잠이 길어지기 시작)\n7~12개월: 하루 12~14시간 (낮잠 2회 → 1회로 줄어듭니다)\n\n평균보다 ±2시간은 정상 범위예요. 우리 아기는 어떤가요? 댓글로 공유해주세요 💛',
  },
  {
    _seedKey: 'a-info-weaning-start-v1',
    category: 'info',
    title: '이유식 시작 시기와 단계별 식재료',
    content:
      '시작 시기: 생후 4~6개월 (목 가누기 + 침 흘리기 + 음식에 관심 보이면 OK)\n\n초기(4~6개월): 쌀미음 → 채소 → 과일\n중기(7~9개월): 닭고기, 흰살생선, 두부 추가\n후기(10~12개월): 잘게 다진 고기, 잎채소, 달걀노른자\n\n알레르기 가능 식재료(달걀흰자, 견과류)는 12개월 이후 권장.',
  },
  {
    _seedKey: 'a-info-vaccine-schedule-v1',
    category: 'info',
    title: '예방접종 필수 일정 한눈에 보기',
    content:
      '0~6개월: B형간염 / BCG / DTaP·소아마비·헤모필루스 / 폐렴구균 / 로타바이러스\n12~15개월: MMR / 수두 / A형간염 1차\n\n자세한 일정은 보건소·소아과 수첩 기준. 까먹기 쉬우니 앱 알림 설정 추천드려요.',
  },
  {
    _seedKey: 'a-info-development-checkpoint-v1',
    category: 'info',
    title: '월령별 발달 체크포인트 (3·6·9·12개월)',
    content:
      '3개월: 고개 들기, 옹알이, 미소 반응\n6개월: 뒤집기, 앉기 시작, 손 뻗기\n9개월: 기기, 짚고 일어서기, "엄마/아빠" 옹알\n12개월: 첫 걸음, 첫 단어, 손가락으로 가리키기\n\n아이마다 ±2~3개월 차이는 정상이에요. 영유아 검진 때 의사에게 꼭 물어보세요.',
  },
  {
    _seedKey: 'a-info-bottle-sterilize-v1',
    category: 'info',
    title: '젖병·유축기 소독 — 안전한 4가지 방법',
    content:
      '1. 끓는 물 소독: 5~10분. 실리콘은 변형 주의.\n2. 전자레인지 소독기: 5~8분. 빠르고 안전.\n3. 자외선(UV) 소독기: 잔수 없이 건조 가능.\n4. 약물(밀튼) 소독: 외출 시 또는 화상 위험 있을 때.\n\n생후 3개월까지는 매번 소독. 이후 점진적으로 일상 세척 + 주 1~2회 소독으로 줄여도 OK.',
  },
  {
    _seedKey: 'a-info-pregnancy-nt-v1',
    category: 'info',
    title: '임신 11~13주 — 1차 기형아 검사(NT) 체크 포인트',
    content:
      'NT(목투명대) 검사는 11~13주 6일 사이에만 가능해요.\n\n준비:\n· 공복 X (편하게 식사 후도 OK)\n· 충분한 물 섭취 (방광이 차야 잘 보임)\n· 검사 시간 약 20~30분\n\n결과 해석은 의사가 정확히 설명해줄 거예요. 수치보다 의사 상담이 중요합니다.',
  },
  {
    _seedKey: 'a-info-pregnancy-vitamins-v1',
    category: 'info',
    title: '임신부 영양제 가이드 — 엽산·철분·칼슘·DHA',
    content:
      '엽산: 신경관 결손 예방. 임신 12주까지 매일 400~800mcg.\n철분: 빈혈·조산 예방. 16주 이후 권장. 비타민C와 함께 먹으면 흡수율 ↑.\n칼슘: 아기 뼈·치아. 1000~1300mg/일. 부족하면 엄마 뼈에서 빠져나가요.\nDHA(오메가3): 태아 뇌·시각 발달. 후기일수록 수요 ↑.\n\n식사 직후 같은 시간에 매일 드시는 게 가장 효과적. 종합비타민 1정 + 추가 보충이 일반적.',
  },
  {
    _seedKey: 'a-info-postpartum-6weeks-v1',
    category: 'info',
    title: '산후 회복 첫 6주 체크리스트',
    content:
      '1~2주: 자궁 수축 통증·오로 정상. 무리한 활동 금지.\n3~4주: 회음부 통증 완화. 따뜻한 좌욕 권장.\n5~6주: 산후검진. 자궁 회복 + 골반저근 체크.\n\n주의 신호: 39도 이상 발열 / 다량 출혈 / 심한 우울감 — 즉시 병원.\n\n잠 부족, 호르몬 변화, 모유수유 부담 — 모두 정상 반응이에요. 도와줄 사람 꼭 옆에.',
  },
  {
    _seedKey: 'a-info-breast-formula-v1',
    category: 'info',
    title: '모유수유 vs 분유 — 균형 잡힌 정보',
    content:
      '모유: 면역 성분, 소화 부담 ↓, 엄마-아기 유대.\n분유: 영양 안정, 누구나 먹일 수 있음, 양 정확.\n\n어느 쪽이 옳다는 건 없어요. 엄마 컨디션, 아기 반응, 가족 상황에 따라 결정.\n혼합수유도 OK. WHO·소아과학회 모두 "엄마가 행복한 방식" 우선.\n\n선택에 죄책감 가지지 마세요. 가장 좋은 건 엄마가 지치지 않는 방식입니다.',
  },
  {
    _seedKey: 'a-celebration-welcome-v1',
    category: 'celebration',
    title: '안녕하세요, 아맞다 운영팀입니다 🎉',
    content:
      '맘스톡에 오신 것을 환영해요!\n\n같은 시기 엄마들이 모여 정보 나누고, 위로하고, 함께 성장하는 공간이에요.\n\n· 질문하기: 궁금한 거 부담 없이 ❓\n· 정보 나누기: 도움된 팁 공유 📚\n· 일상 수다: 오늘 어땠는지 한 마디 💬\n· 고민 털기: 힘들 때 마음 풀기 😔\n· 축하받기: 우리 아기 첫 이벤트 🎉\n\n좋은 인연 만드세요. 운영팀이 항상 함께합니다.',
  },
];

// ── B 셋: 도우미 페르소나 (질문·수다·공감) ───────────────────────────────
const POSTS_B = [
  {
    _seedKey: 'b-q-hardest-period-v1',
    category: 'question',
    title: '여러분이 가장 힘들었던 육아 시기는 언제예요?',
    content:
      '신생아 통잠 안 자는 시기? 이앓이? 미운 두 살?\n\n저희가 모은 후기로는 의외로 "100일~6개월"이 가장 많았어요. 혼자가 아닌 거 알아주세요.\n댓글로 본인 가장 힘든 시기 + 어떻게 버티셨는지 공유해주세요. 나중에 오는 분들에게 큰 위로가 됩니다 💛',
  },
  {
    _seedKey: 'b-q-best-baby-item-v1',
    category: 'question',
    title: '가장 도움된 육아용품 1가지만 추천한다면?',
    content:
      '딱 하나만! 없으면 못 살 것 같았던 그 아이템.\n\n예시: 아기띠, 모빌, 분유포트, 휴대용 비데, 전동 흔들침대...\n\n태어나기 전 준비하는 분들에게 정말 도움됩니다. 후회한 아이템도 같이 적어주시면 더 좋아요. 댓글 모아서 다음 정보 글로 정리해드릴게요!',
  },
  {
    _seedKey: 'b-chat-today-mood-v1',
    category: 'chat',
    title: '오늘 엄마 컨디션 한 줄로 공유해요 💛',
    content:
      '잠 못 자서 좀비 모드 😴\n점심 못 먹고 버티는 중 🍙\n오늘은 컨디션 좋음! ✨\n남편이 도와줘서 살았어요 💛\n\n어떤 식으로든 좋아요. 한 줄씩 댓글 달아주세요. 다른 엄마들 보고 "나만 그런 게 아니구나" 위로받는 거 좋아요.',
  },
  {
    _seedKey: 'b-chat-night-moms-v1',
    category: 'chat',
    title: '새벽에 깨어있는 엄마들, 안녕하세요 🌙',
    content:
      '새벽 수유 중이신가요? 아니면 통잠 안 자는 아기 안고 흔들고 계신가요?\n\n지금 이 시간에 깨어있는 분들 댓글 한 줄만 남겨주세요. "혼자가 아니구나" 느낌만으로도 위로돼요.\n\n저희도 같이 깨어있을게요 💛',
  },
  {
    _seedKey: 'b-q-most-regret-v1',
    category: 'question',
    title: '출산 후 가장 후회한 거 한 가지 있어요?',
    content:
      '"진통 너무 참았어요" / "산후조리원 더 길게 갈걸" / "젖몸살 빨리 처치할걸"...\n\n후회 없는 사람 없어요. 솔직하게 공유해주시면 곧 출산하실 분들에게 진짜 도움이 됩니다.\n반대로 "잘했다 싶은 결정"도 환영! 댓글로 이야기 나눠요.',
  },
  {
    _seedKey: 'b-chat-first-action-v1',
    category: 'chat',
    title: '오늘 우리 아기가 처음 한 행동, 자랑해요 🌟',
    content:
      '첫 뒤집기, 첫 옹알이, 첫 걸음, 첫 "엄마"...\n혹은 작은 거: 처음으로 콩 잡아 먹은 날, 처음 박수 친 날.\n\n사진 X, 글로 한 줄. 우리 아기 자랑 + 다른 아기 응원 댓글 달기.\n오늘 하루 조금 더 따뜻해질 거예요 💛',
  },
  {
    _seedKey: 'b-q-daycare-vs-home-v1',
    category: 'question',
    title: '어린이집 vs 가정보육, 어떻게 결정하셨어요?',
    content:
      '어린이집: 사회성, 발달 자극, 엄마 시간 확보\n가정보육: 안정 애착, 감기 적게, 식사 통제\n\n둘 다 장단점이 명확해서 선택이 어려워요.\n어떤 기준으로 결정하셨는지, 후회한 점/잘한 점 댓글로 공유해주세요. 저희가 보면 가장 어려운 결정 중 하나예요.',
  },
  {
    _seedKey: 'b-chat-first-outing-v1',
    category: 'chat',
    title: '아기 데리고 첫 외출, 어땠나요?',
    content:
      '첫 외출은 50일? 100일? 어디로 가셨어요?\n\n저희가 들은 후기 중에는 "동네 한 바퀴", "병원 다녀온 게 첫 외출", "큰맘 먹고 카페" 등 정말 다양해요.\n\n첫 외출 추억 + 챙겨갔으면 좋았을 것 댓글로 공유해주세요. 곧 첫 외출 앞둔 엄마들에게 큰 도움 됩니다.',
  },
  {
    _seedKey: 'b-q-family-help-v1',
    category: 'question',
    title: '남편/가족이 가장 잘 도와준 일 한 가지?',
    content:
      '"새벽 분유는 무조건 본인이"\n"청소·세탁은 다 맡아줌"\n"내 컨디션 안 좋으면 휴가 내고 옴"\n\n반대로 "이건 좀 더 도와줬으면..." 도 있죠.\n\n도움된 일 / 부족한 일 둘 다 솔직하게 공유해주세요. 가족 대화에 참고 자료가 됩니다.',
  },
  {
    _seedKey: 'b-celebration-100days-challenge-v1',
    category: 'celebration',
    title: '100일·돌 사진 인증 챌린지 #아맞다챌린지',
    content:
      '우리 아기 100일 / 200일 / 돌 / 두 돌...\n작은 기념일 댓글로 자랑해보세요!\n\n날짜 + 한 줄 메시지면 OK.\n예: "오늘 우리 콩 100일! 잘 자라줘서 고마워 💛"\n\n다른 엄마들의 축하 댓글이 두고두고 추억돼요. 부담 없이 참여해주세요 🎉',
  },
];

const SETS = [POSTS_A, POSTS_B];
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
  // 안정적 순서 — userId 사전순 (재실행 시 같은 계정에 같은 set 매핑 보장)
  list.sort((a, b) => a.id.localeCompare(b.id));
  return list;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function seedForUser(user, postSet, dryRun) {
  console.log(`\n[user] ${user.id} (${user.nickname}) — set ${postSet === POSTS_A ? 'A (운영팀)' : 'B (도우미)'}`);
  let created = 0;
  let skipped = 0;
  for (const seed of postSet) {
    const existing = await POSTS
      .where(SEED_KEY_FIELD, '==', seed._seedKey)
      .where('userId', '==', user.id)
      .limit(1)
      .get();
    if (!existing.empty) {
      console.log(`  - skip [${seed._seedKey}]`);
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

async function cleanupAllSeeds(dryRun) {
  console.log('\n=== CLEANUP MODE — _seedKey 있는 글 모두 삭제 ===');
  const snap = await POSTS.where(SEED_KEY_FIELD, '!=', null).limit(500).get();
  console.log(`found ${snap.size} seed posts`);
  let deleted = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (dryRun) {
      console.log(`  - DRY delete [${data[SEED_KEY_FIELD]}] ${data.title || ''}`);
    } else {
      await d.ref.delete();
      console.log(`  - DELETE [${data[SEED_KEY_FIELD]}] ${data.title || ''}`);
    }
    deleted++;
  }
  console.log(`\n=== TOTAL: ${deleted} ${dryRun ? 'would be deleted' : 'deleted'} ===`);
}

async function main() {
  const args = process.argv.slice(2);
  const cleanup = args.includes('--cleanup');
  const dryRun = args.includes('--dry') || (!args.includes('--apply') && !cleanup);

  if (cleanup) {
    await cleanupAllSeeds(dryRun);
    if (dryRun) console.log('\n실제 삭제: --cleanup --apply');
    return;
  }

  console.log(`mode: ${dryRun ? 'DRY RUN (use --apply to write)' : 'APPLY'}`);
  const officials = await findOfficialUsers();
  if (officials.length === 0) {
    console.log('\nNo official users found.');
    process.exit(1);
  }
  console.log(`\nofficial users: ${officials.length}`);

  let totalCreated = 0;
  let totalSkipped = 0;
  for (let i = 0; i < officials.length; i++) {
    const set = SETS[i % SETS.length];
    const { created, skipped } = await seedForUser(officials[i], set, dryRun);
    totalCreated += created;
    totalSkipped += skipped;
  }
  console.log(`\n=== TOTAL ===\ncreated: ${totalCreated}, skipped: ${totalSkipped}`);
  if (dryRun) console.log('\n실제 작성: node scripts/seed-official-posts.cjs --apply');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
