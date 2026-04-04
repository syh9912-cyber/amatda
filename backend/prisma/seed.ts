import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// shared types path workaround for seed
import { calculateSaju } from '../src/services/saju.calculator';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. 테스트 유저
  const passwordHash = await bcrypt.hash('test1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'test@amatda.com' },
    update: {},
    create: {
      email: 'test@amatda.com',
      passwordHash,
      authProvider: 'LOCAL',
      subscriptionTier: 'FREE',
    },
  });
  console.log('✅ User created:', user.email);

  // 2. 자녀: 승하 (초등, 탐구형)
  const seunghaInnate = calculateSaju(
    new Date('2017-09-25'),
    '03:35'
  );
  const seungha = await prisma.child.create({
    data: {
      userId: user.id,
      name: '승하',
      gender: 'F',
      birthDate: new Date('2017-09-25'),
      birthTime: '03:35',
      innateData: JSON.stringify(seunghaInnate),
    },
  });
  console.log('✅ Child created:', seungha.name, seunghaInnate.dominantType);

  // 3. 자녀: 윤도 (영아, 활동형)
  const yundoInnate = calculateSaju(
    new Date('2024-08-23'),
    '00:00'
  );
  const yundo = await prisma.child.create({
    data: {
      userId: user.id,
      name: '윤도',
      gender: 'M',
      birthDate: new Date('2024-08-23'),
      birthTime: '00:00',
      innateData: JSON.stringify(yundoInnate),
    },
  });
  console.log('✅ Child created:', yundo.name, yundoInnate.dominantType);

  // 4. QuestionBank (6개)
  const questions = [
    {
      targetAgeMin: 0,
      targetAgeMax: 24,
      sajuType: '활동형',
      questionText: '아이의 수면 패턴은 어떤가요?',
      options: JSON.stringify([
        '정해진 시간에 잘 자요',
        '불규칙하지만 잘 자요',
        '자주 깨고 보채요',
        '낮잠을 거의 안 자요',
      ]),
    },
    {
      targetAgeMin: 0,
      targetAgeMax: 24,
      sajuType: '감성형',
      questionText: '새로운 소리나 촉감에 어떻게 반응하나요?',
      options: JSON.stringify([
        '호기심을 보이며 탐색해요',
        '놀라며 울어요',
        '무관심해요',
        '반복적으로 만지거나 들어요',
      ]),
    },
    {
      targetAgeMin: 25,
      targetAgeMax: 72,
      sajuType: '조화형',
      questionText: '또래 친구와 놀 때 어떤 모습인가요?',
      options: JSON.stringify([
        '리더 역할을 해요',
        '잘 어울리며 양보해요',
        '혼자 놀기를 선호해요',
        '관찰하다가 합류해요',
      ]),
    },
    {
      targetAgeMin: 25,
      targetAgeMax: 72,
      sajuType: '활동형',
      questionText: '감정 표현 방식은 어떤가요?',
      options: JSON.stringify([
        '크게 웃고 크게 울어요',
        '조용히 표현해요',
        '말로 잘 설명해요',
        '몸으로 표현해요 (뛰기, 안기)',
      ]),
    },
    {
      targetAgeMin: 73,
      targetAgeMax: 200,
      sajuType: '탐구형',
      questionText: '새로운 것을 배울 때 어떤 방식을 선호하나요?',
      options: JSON.stringify([
        '직접 해보면서 배워요',
        '설명을 듣고 이해해요',
        '책이나 영상으로 먼저 봐요',
        '친구와 함께 배워요',
      ]),
    },
    {
      targetAgeMin: 73,
      targetAgeMax: 200,
      sajuType: '분석형',
      questionText: '스트레스를 받으면 어떤 반응을 보이나요?',
      options: JSON.stringify([
        '혼자 조용히 있고 싶어해요',
        '짜증을 내거나 화를 내요',
        '부모에게 이야기해요',
        '다른 활동으로 전환해요',
      ]),
    },
  ];

  for (const q of questions) {
    await prisma.questionBank.create({ data: q });
  }
  console.log('✅ QuestionBank seeded:', questions.length);

  // 5. FoodGuideDict (4개)
  const foodGuides = [
    {
      targetAgeMin: 0,
      targetAgeMax: 24,
      suitableType: '활동형',
      foods: JSON.stringify([
        { name: '고구마 퓨레', benefit: '에너지 보충과 소화가 쉬운 이유식', caution: '처음엔 소량부터' },
        { name: '소고기 퓨레', benefit: '철분 보충으로 활발한 성장 지원', caution: '알레르기 확인' },
        { name: '바나나', benefit: '칼륨 풍부, 에너지 보충', caution: '변비 시 조절' },
      ]),
    },
    {
      targetAgeMin: 0,
      targetAgeMax: 24,
      suitableType: '감성형',
      foods: JSON.stringify([
        { name: '아보카도', benefit: '두뇌 발달에 좋은 건강한 지방', caution: '알레르기 확인' },
        { name: '단호박 퓨레', benefit: '비타민A 풍부, 시각 발달', caution: '과다 섭취 시 피부 변색' },
        { name: '두부', benefit: '단백질 보충, 부드러운 식감', caution: '대두 알레르기 확인' },
      ]),
    },
    {
      targetAgeMin: 73,
      targetAgeMax: 200,
      suitableType: '탐구형',
      foods: JSON.stringify([
        { name: '연어', benefit: '오메가3로 집중력과 두뇌 발달 지원' },
        { name: '블루베리', benefit: '항산화 성분으로 기억력 향상' },
        { name: '호두', benefit: '두뇌 영양 간식, 불포화지방산 풍부', caution: '견과류 알레르기 주의' },
      ]),
    },
    {
      targetAgeMin: 73,
      targetAgeMax: 200,
      suitableType: '분석형',
      foods: JSON.stringify([
        { name: '계란', benefit: '콜린 성분으로 집중력 강화' },
        { name: '시금치', benefit: '철분으로 두뇌 산소 공급 도움' },
        { name: '고등어', benefit: 'DHA 풍부, 논리적 사고력 지원', caution: '뼈 주의' },
      ]),
    },
  ];

  for (const fg of foodGuides) {
    await prisma.foodGuideDict.create({ data: fg });
  }
  console.log('✅ FoodGuideDict seeded:', foodGuides.length);

  // 6. Academy (4개, 남악 반경)
  const academies = [
    {
      name: '남악 잉글리시 아카데미',
      category: '영어',
      minAge: 73,
      maxAge: 200,
      lat: 34.815,
      lng: 126.463,
      suitableTraits: JSON.stringify(['탐구형', '분석형']),
    },
    {
      name: '무안 코딩교실',
      category: '코딩',
      minAge: 73,
      maxAge: 200,
      lat: 34.812,
      lng: 126.46,
      suitableTraits: JSON.stringify(['탐구형', '분석형']),
    },
    {
      name: '남악 베이비카페',
      category: '놀이',
      minAge: 0,
      maxAge: 36,
      lat: 34.818,
      lng: 126.465,
      suitableTraits: JSON.stringify(['활동형', '감성형', '조화형']),
    },
    {
      name: '오감놀이터',
      category: '감각놀이',
      minAge: 0,
      maxAge: 48,
      lat: 34.81,
      lng: 126.458,
      suitableTraits: JSON.stringify(['감성형', '탐구형']),
    },
  ];

  for (const a of academies) {
    await prisma.academy.create({ data: a });
  }
  console.log('✅ Academy seeded:', academies.length);

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
