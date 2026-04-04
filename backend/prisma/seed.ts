import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateSaju } from '../src/services/saju.calculator';
import { QUESTIONS } from './seed-data/questions';
import { FOOD_GUIDES } from './seed-data/food-guides';
import { FAQ_DATA } from './seed-data/faq';
import { ACADEMIES } from './seed-data/academies';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database (full data)...');

  // 기존 데이터 클리어
  await prisma.aICSChatLog.deleteMany();
  await prisma.fAQ.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.child.deleteMany();
  await prisma.user.deleteMany();
  await prisma.questionBank.deleteMany();
  await prisma.foodGuideDict.deleteMany();
  await prisma.academy.deleteMany();
  console.log('🗑️  Cleared existing data');

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
  console.log('✅ User:', user.email);

  // 2. 자녀: 승하 (초등)
  const seunghaInnate = calculateSaju(new Date('2017-09-25'), '03:35');
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
  console.log('✅ Child:', seungha.name, seunghaInnate.dominantType);

  // 3. 자녀: 윤도 (영아)
  const yundoInnate = calculateSaju(new Date('2024-08-23'), '00:00');
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
  console.log('✅ Child:', yundo.name, yundoInnate.dominantType);

  // 4. QuestionBank (60개)
  let qCount = 0;
  for (const q of QUESTIONS) {
    await prisma.questionBank.create({
      data: {
        targetAgeMin: q.targetAgeMin,
        targetAgeMax: q.targetAgeMax,
        sajuType: q.sajuType,
        questionText: q.questionText,
        options: JSON.stringify(q.options),
      },
    });
    qCount++;
  }
  console.log(`✅ QuestionBank: ${qCount}개`);

  // 5. FoodGuideDict (20개)
  let fCount = 0;
  for (const fg of FOOD_GUIDES) {
    await prisma.foodGuideDict.create({
      data: {
        targetAgeMin: fg.targetAgeMin,
        targetAgeMax: fg.targetAgeMax,
        suitableType: fg.suitableType,
        foods: JSON.stringify(fg.foods),
      },
    });
    fCount++;
  }
  console.log(`✅ FoodGuideDict: ${fCount}개`);

  // 6. Academy (20개)
  let aCount = 0;
  for (const a of ACADEMIES) {
    await prisma.academy.create({
      data: {
        name: a.name,
        category: a.category,
        minAge: a.minAge,
        maxAge: a.maxAge,
        lat: a.lat,
        lng: a.lng,
        suitableTraits: JSON.stringify(a.suitableTraits),
      },
    });
    aCount++;
  }
  console.log(`✅ Academy: ${aCount}개`);

  // 7. FAQ (100개)
  let faqCount = 0;
  for (const faq of FAQ_DATA) {
    await prisma.fAQ.create({
      data: {
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
      },
    });
    faqCount++;
  }
  console.log(`✅ FAQ: ${faqCount}개`);

  // 8. 샘플 관찰 일기 (승하)
  const sampleObs = [
    '오늘 승하가 새로 산 과학 실험 키트를 2시간 동안 집중해서 했어요. 설명서를 꼼꼼히 읽고 순서대로 진행하는 모습이 인상적이었어요.',
    '친구들과 공원에서 놀았는데, 혼자 벌레를 관찰하며 시간을 보냈어요. 친구가 불러도 잘 안 돌아왔어요.',
    '학교에서 발표를 했는데 긴장은 했지만 준비를 많이 해서 잘 해냈대요. 집에 와서 뿌듯해했어요.',
  ];
  for (const content of sampleObs) {
    await prisma.observation.create({
      data: {
        childId: seungha.id,
        type: 'TEXT',
        rawContent: content,
        extractedTraits: JSON.stringify({
          emotions: ['집중적', '뿌듯함'],
          socialStyle: '독립적',
          interests: ['과학', '탐색활동'],
          stressResponse: '내면처리형',
          summary: '탐구적이고 집중력 있는 모습. 독립적인 활동 선호.',
        }),
      },
    });
  }
  console.log(`✅ Observations: ${sampleObs.length}개 (승하)`);

  // 9. 승하의 observedTraits 업데이트
  await prisma.child.update({
    where: { id: seungha.id },
    data: {
      observedTraits: JSON.stringify({
        entries: sampleObs.map((_, i) => ({
          date: new Date(Date.now() - (sampleObs.length - i) * 86400000).toISOString(),
          traits: {
            emotions: ['집중적'],
            socialStyle: '독립적',
            interests: ['과학', '탐색활동'],
            stressResponse: '내면처리형',
            summary: '탐구적이고 집중력 있는 모습.',
          },
        })),
      }),
    },
  });

  console.log('');
  console.log('🎉 Seed 완료!');
  console.log(`   Users: 1 | Children: 2 | Questions: ${qCount}`);
  console.log(`   FoodGuides: ${fCount} | Academies: ${aCount} | FAQ: ${faqCount}`);
  console.log(`   Observations: ${sampleObs.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
