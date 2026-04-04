import * as admin from 'firebase-admin';
import bcrypt from 'bcryptjs';
import { calculateSaju } from '../src/services/saju.calculator';
import { QUESTIONS } from './seed-data/questions';
import { FOOD_GUIDES } from './seed-data/food-guides';
import { FAQ_DATA } from './seed-data/faq';
import { ACADEMIES } from './seed-data/academies';
import { ADS } from './seed-data/ads';

// 서비스 계정 키가 있으면 사용, 없으면 에뮬레이터
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
} else {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  admin.initializeApp({ projectId: 'amatda-parenting' });
}

const db = admin.firestore();

async function seedCollection(name: string, items: Record<string, unknown>[]) {
  const col = db.collection(name);
  let count = 0;
  for (const item of items) {
    await col.doc().set(item);
    count++;
  }
  console.log(`  ${name}: ${count}개`);
  return count;
}

async function main() {
  console.log('Seeding Firestore...\n');

  // 1. 유저
  const passwordHash = await bcrypt.hash('test1234', 10);
  const userRef = db.collection('users').doc();
  await userRef.set({
    email: 'test@amatda.com', passwordHash, authProvider: 'LOCAL',
    socialId: null, subscriptionTier: 'FREE', createdAt: new Date().toISOString(),
  });
  console.log('  User: test@amatda.com');

  // 2. 자녀
  const seunghaInnate = calculateSaju(new Date('2017-09-25'), '03:35');
  const seunghaRef = db.collection('children').doc();
  await seunghaRef.set({
    userId: userRef.id, name: '승하', gender: 'F',
    birthDate: '2017-09-25', birthTime: '03:35',
    innateData: JSON.stringify(seunghaInnate), baseline: null,
    observedTraits: JSON.stringify({ entries: [
      { date: new Date().toISOString(), traits: { emotions: ['집중적'], socialStyle: '독립적', interests: ['과학'], stressResponse: '내면처리형', summary: '탐구적이고 집중력 있는 모습.' } },
    ]}),
  });
  console.log('  Child: 승하', seunghaInnate.dominantType);

  const yundoInnate = calculateSaju(new Date('2024-08-23'), '00:00');
  const yundoRef = db.collection('children').doc();
  await yundoRef.set({
    userId: userRef.id, name: '윤도', gender: 'M',
    birthDate: '2024-08-23', birthTime: '00:00',
    innateData: JSON.stringify(yundoInnate), baseline: null, observedTraits: null,
  });
  console.log('  Child: 윤도', yundoInnate.dominantType);

  // 3. 관찰 일기
  const obsContent = '오늘 승하가 새로 산 과학 실험 키트를 2시간 동안 집중해서 했어요.';
  await db.collection('observations').doc().set({
    childId: seunghaRef.id, type: 'TEXT', rawContent: obsContent,
    extractedTraits: JSON.stringify({ emotions: ['집중적'], socialStyle: '독립적', interests: ['과학'], stressResponse: '내면처리형', summary: '탐구적' }),
    createdAt: new Date().toISOString(),
  });
  console.log('  Observations: 1개');

  // 4. 대량 데이터
  await seedCollection('questions', QUESTIONS.map((q) => ({ ...q, options: JSON.stringify(q.options) })));
  await seedCollection('foodGuides', FOOD_GUIDES.map((f) => ({ ...f, foods: JSON.stringify(f.foods) })));
  await seedCollection('faq', FAQ_DATA);
  await seedCollection('academies', ACADEMIES.map((a) => ({ ...a, suitableTraits: JSON.stringify(a.suitableTraits) })));
  await seedCollection('ads', ADS.map((a) => ({ ...a, isActive: true, clickCount: 0, viewCount: 0, createdAt: new Date().toISOString() })));

  console.log('\nSeed 완료!');
  process.exit(0);
}

main().catch((e) => { console.error('Seed error:', e); process.exit(1); });
