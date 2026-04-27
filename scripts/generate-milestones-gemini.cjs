/**
 * Gemini 2.5 Flash로 마일스톤 아이콘 257개 일괄 생성
 * 실행: GEMINI_API_KEY=xxx node scripts/generate-milestones-gemini.cjs
 *
 * 생성 후 Firebase Storage에 업로드하여 앱에서 동적 로딩 (Approach C)
 */
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY 환경변수를 설정해주세요.');
  process.exit(1);
}

const MODEL = 'gemini-2.5-flash-image';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'assets', 'milestones');

/* 출력 폴더 생성 */
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/* ── 마스터 스타일 (DALL-E 메인 에셋과 톤 맞춤) ── */
const MASTER_STYLE = `3D clay-render style, soft matte clay texture, warm pastel colors (cream, peach, mint, soft pink), rounded smooth shapes, studio lighting with soft shadows, clean cream-white background, cute baby app icon style, very simple and minimal composition, centered, no text, 256x256 icon size`;

/* ── 마일스톤 데이터 (album.tsx에서 추출) ── */
const MILESTONES = [
  // 0개월
  { age: '0m', label: '첫 울음', emoji: '👶', prompt: 'A tiny baby with open mouth crying for the first time, birth moment' },
  { age: '0m', label: '빛에 반응', emoji: '💡', prompt: 'A tiny baby blinking at a soft glowing light, visual response' },
  { age: '0m', label: '큰 소리에 깜짝', emoji: '👂', prompt: 'A tiny baby with surprised expression, startled by sound' },
  { age: '0m', label: '손 꽉 쥐기', emoji: '✊', prompt: 'A tiny baby hand gripping tightly around an adult finger, grasp reflex' },
  { age: '0m', label: '엄마 목소리 인식', emoji: '🤱', prompt: 'A tiny baby turning head toward mother voice, bonding moment' },
  { age: '0m', label: '수유 시작', emoji: '🍼', prompt: 'A tiny baby bottle with milk, first feeding' },
  { age: '0m', label: '얼굴 가까이 응시', emoji: '👀', prompt: 'A tiny baby staring intently at a close face, eye contact' },
  { age: '0m', label: '제대 탈락', emoji: '🏥', prompt: 'A tiny belly button with a small bandage, umbilical cord' },

  // 1개월
  { age: '1m', label: '엎드려 고개 들기', emoji: '💪', prompt: 'A baby on tummy lifting head up, tummy time strength' },
  { age: '1m', label: '초점 맞추기', emoji: '👁', prompt: 'A baby focusing eyes on a nearby object, visual development' },
  { age: '1m', label: '물체 따라보기', emoji: '👀', prompt: 'A baby tracking a moving toy with eyes, visual tracking' },
  { age: '1m', label: '소리 반응', emoji: '👂', prompt: 'A baby turning toward a sound source, auditory response' },
  { age: '1m', label: '수유 리듬', emoji: '🍼', prompt: 'A baby bottle with clock, feeding schedule forming' },
  { age: '1m', label: '울음 의사표현', emoji: '😢', prompt: 'A baby crying with small speech bubble, communication by crying' },
  { age: '1m', label: '손발 움직임', emoji: '🦶', prompt: 'Baby hands and feet moving actively, motor development' },
  { age: '1m', label: '안아주면 안정', emoji: '🤗', prompt: 'A calm baby being held gently, comfort from embrace' },

  // 2개월
  { age: '2m', label: '사회적 미소', emoji: '😊', prompt: 'A baby with bright social smile at a face, social milestone' },
  { age: '2m', label: '옹알이 시작', emoji: '🗣', prompt: 'A baby making cooing sounds, first vocalization' },
  { age: '2m', label: '180도 따라보기', emoji: '👀', prompt: 'A baby tracking object in wide arc, visual tracking' },
  { age: '2m', label: '손을 입에', emoji: '🤚', prompt: 'A baby putting hand to mouth, self-soothing discovery' },
  { age: '2m', label: '엎드려 가슴 들기', emoji: '💪', prompt: 'A baby on tummy pushing chest up with arms' },
  { age: '2m', label: '소리에 조용해지기', emoji: '🤫', prompt: 'A baby calming down to soothing sound, auditory response' },
  { age: '2m', label: '얼굴 보고 웃기', emoji: '😄', prompt: 'A baby laughing at a friendly face, social smile' },
  { age: '2m', label: '밤 수면 길어짐', emoji: '😴', prompt: 'A baby sleeping peacefully at night, longer sleep' },

  // 3개월
  { age: '3m', label: '목 가누기', emoji: '🦒', prompt: 'A baby holding head up steadily, neck control milestone' },
  { age: '3m', label: '소리내어 웃기', emoji: '😂', prompt: 'A baby laughing out loud, joyful expression' },
  { age: '3m', label: '손에 쥐어주면 잡기', emoji: '✊', prompt: 'A baby gripping a rattle placed in hand' },
  { age: '3m', label: '팔로 지탱', emoji: '🤸', prompt: 'A baby pushing up on arms during tummy time' },
  { age: '3m', label: '옹알이 다양해짐', emoji: '🗣', prompt: 'A baby making various sounds, diverse babbling' },
  { age: '3m', label: '손 쳐다보기', emoji: '🖐', prompt: 'A baby staring at own hands with fascination' },
  { age: '3m', label: '거울 속 얼굴', emoji: '🪞', prompt: 'A baby looking at mirror with curiosity' },
  { age: '3m', label: '수유량 안정', emoji: '🍼', prompt: 'A baby bottle with checkmark, stable feeding' },

  // 4개월
  { age: '4m', label: '뒤집기 시도', emoji: '🔄', prompt: 'A baby trying to roll over, rotation attempt' },
  { age: '4m', label: '장난감 손 뻗어 잡기', emoji: '🧸', prompt: 'A baby reaching for a toy, hand-eye coordination' },
  { age: '4m', label: '모음 발성', emoji: '🗣', prompt: 'A baby making vowel sounds ah-eh, vocal practice' },
  { age: '4m', label: '거울 보고 웃기', emoji: '🪞', prompt: 'A baby smiling at mirror reflection, self-recognition' },
  { age: '4m', label: '양손으로 잡기', emoji: '🤲', prompt: 'A baby holding object with both hands, bilateral grasp' },
  { age: '4m', label: '받쳐주면 앉기', emoji: '🪑', prompt: 'A baby sitting with support, supported sitting' },
  { age: '4m', label: '표정 모방', emoji: '🎭', prompt: 'A baby imitating facial expression, social mimicry' },
  { age: '4m', label: '울음 구분', emoji: '😢', prompt: 'Different cry expressions, distinct crying types' },

  // 5개월
  { age: '5m', label: '뒤집기 성공', emoji: '🔄', prompt: 'A baby successfully rolling over, achievement' },
  { age: '5m', label: '발 잡기', emoji: '🦶', prompt: 'A baby grabbing own feet, body awareness' },
  { age: '5m', label: '입으로 탐색', emoji: '👄', prompt: 'A baby mouthing a toy, oral exploration' },
  { age: '5m', label: '소리 모방', emoji: '🗣', prompt: 'A baby imitating sounds, vocal imitation' },
  { age: '5m', label: '낯가림 시작', emoji: '😰', prompt: 'A baby looking shy at stranger, stranger anxiety' },
  { age: '5m', label: '이유식 시작', emoji: '🥄', prompt: 'A baby with first solid food spoon, weaning start' },
  { age: '5m', label: '장난감 옮기기', emoji: '🧸', prompt: 'A baby passing toy from one hand to other' },
  { age: '5m', label: '까꿍 반응', emoji: '🙈', prompt: 'A baby excited by peek-a-boo game, object permanence' },

  // 6개월
  { age: '6m', label: '혼자 앉기', emoji: '🪑', prompt: 'A baby sitting independently without support' },
  { age: '6m', label: '다다다 옹알이', emoji: '🗣', prompt: 'A baby babbling consonant sounds da-da' },
  { age: '6m', label: '이유식 잘 먹기', emoji: '🥣', prompt: 'A baby eating solid food happily from bowl' },
  { age: '6m', label: '손 뻗어 잡기', emoji: '✋', prompt: 'A baby reaching and grasping objects precisely' },
  { age: '6m', label: '소리 방향 찾기', emoji: '👂', prompt: 'A baby turning head to find sound source' },
  { age: '6m', label: '물건 두드리기', emoji: '🥁', prompt: 'A baby banging objects together, cause-effect' },
  { age: '6m', label: '첫 이 나기', emoji: '🦷', prompt: 'A baby showing first tooth, teething milestone' },
  { age: '6m', label: '거울놀이 좋아함', emoji: '🪞', prompt: 'A baby playing with mirror happily, self-awareness' },

  // 7개월
  { age: '7m', label: '혼자 앉기 안정', emoji: '🧒', prompt: 'A baby sitting steadily on own without support' },
  { age: '7m', label: '배밀이 시작', emoji: '🐛', prompt: 'A baby army-crawling forward on belly' },
  { age: '7m', label: '이름 부르면 반응', emoji: '📢', prompt: 'A baby turning head when name is called' },
  { age: '7m', label: '집게 잡기 시도', emoji: '🤏', prompt: 'A baby trying to pick up small object with fingers, pincer grasp' },
  { age: '7m', label: '이유식 중기', emoji: '🥣', prompt: 'A baby eating mashed food from a bowl with spoon' },
  { age: '7m', label: '까꿍 놀이 즐기기', emoji: '🙈', prompt: 'A baby excited playing peek-a-boo game' },
  { age: '7m', label: '엄마에게 팔 벌리기', emoji: '🤗', prompt: 'A baby reaching arms out to mother, wanting to be held' },
  { age: '7m', label: '물건 떨어뜨리기 놀이', emoji: '⬇️', prompt: 'A baby dropping objects from highchair, cause-effect play' },

  // 8개월
  { age: '8m', label: '기어가기 시작', emoji: '🐛', prompt: 'A baby crawling on hands and knees' },
  { age: '8m', label: '잡고 서기', emoji: '🧍', prompt: 'A baby pulling up to stand holding furniture' },
  { age: '8m', label: '바이바이 흉내', emoji: '👋', prompt: 'A baby waving bye-bye with hand' },
  { age: '8m', label: '두 물건 부딪치기', emoji: '🥁', prompt: 'A baby banging two blocks together' },
  { age: '8m', label: '소리 따라하기', emoji: '🦜', prompt: 'A baby imitating sounds, babbling back' },
  { age: '8m', label: '숨긴 물건 찾기', emoji: '🔍', prompt: 'A baby finding hidden toy under blanket' },
  { age: '8m', label: '분리불안 시작', emoji: '😢', prompt: 'A baby crying when parent leaves, separation anxiety' },
  { age: '8m', label: '핑거푸드 집어먹기', emoji: '🍪', prompt: 'A baby picking up finger food and eating' },

  // 9개월
  { age: '9m', label: '가구 잡고 이동', emoji: '🚶', prompt: 'A baby cruising along furniture while standing' },
  { age: '9m', label: '집게 잡기 성공', emoji: '🤏', prompt: 'A baby successfully picking up small item with pincer grasp' },
  { age: '9m', label: '안 돼 이해하기', emoji: '🚫', prompt: 'A baby pausing when told no, understanding prohibition' },
  { age: '9m', label: '손가락으로 가리키기', emoji: '👆', prompt: 'A baby pointing at something with finger' },
  { age: '9m', label: '컵 잡고 마시기 시도', emoji: '🥤', prompt: 'A baby trying to drink from cup with both hands' },
  { age: '9m', label: '이유식 후기', emoji: '🥗', prompt: 'A baby eating finely chopped solid food' },
  { age: '9m', label: '박수치기', emoji: '👏', prompt: 'A baby clapping hands together happily' },
  { age: '9m', label: '간단한 몸짓 모방', emoji: '🙌', prompt: 'A baby imitating simple gestures like waving' },

  // 10개월
  { age: '10m', label: '잡고 서서 움직이기', emoji: '🚶', prompt: 'A baby standing and taking steps while holding furniture' },
  { age: '10m', label: '엄마/아빠 뜻있게 말하기', emoji: '🗣', prompt: 'A baby saying mama or dada meaningfully' },
  { age: '10m', label: '손 흔들어 인사', emoji: '👋', prompt: 'A baby waving hello with a smile' },
  { age: '10m', label: '뚜껑 열기 시도', emoji: '🫙', prompt: 'A baby trying to open a container lid' },
  { age: '10m', label: '간단한 지시 이해', emoji: '✅', prompt: 'A baby following simple instruction, understanding words' },
  { age: '10m', label: '숟가락 잡기 시도', emoji: '🥄', prompt: 'A baby holding spoon and trying to self-feed' },
  { age: '10m', label: '까꿍 놀이 주도', emoji: '🎭', prompt: 'A baby initiating peek-a-boo game themselves' },
  { age: '10m', label: '음악에 몸 흔들기', emoji: '🎵', prompt: 'A baby bouncing and swaying to music' },

  // 11개월
  { age: '11m', label: '혼자 서기 시도', emoji: '🧍', prompt: 'A baby standing alone without support briefly' },
  { age: '11m', label: '첫 단어 시도', emoji: '💬', prompt: 'A baby trying to say first real word' },
  { age: '11m', label: '블록 2~3개 쌓기', emoji: '🧱', prompt: 'A baby stacking two or three blocks' },
  { age: '11m', label: '물건 넣고 빼기', emoji: '📦', prompt: 'A baby putting objects in and out of container' },
  { age: '11m', label: '전화 놀이', emoji: '📱', prompt: 'A baby pretending to talk on phone' },
  { age: '11m', label: '책장 넘기기', emoji: '📖', prompt: 'A baby turning pages of a board book' },
  { age: '11m', label: '간식 스스로 먹기', emoji: '🍪', prompt: 'A baby eating snack independently' },
  { age: '11m', label: '또래에게 관심', emoji: '👶', prompt: 'A baby looking at another baby with curiosity' },

  // 12개월
  { age: '12m', label: '첫 걸음', emoji: '🚶', prompt: 'A baby taking first independent steps, milestone moment' },
  { age: '12m', label: '의미있는 단어 2~3개', emoji: '💬', prompt: 'A baby saying meaningful words with speech bubbles' },
  { age: '12m', label: '컵으로 마시기', emoji: '🥤', prompt: 'A baby drinking from cup independently' },
  { age: '12m', label: '숨은 물건 찾기', emoji: '🔍', prompt: 'A baby finding hidden object, object permanence' },
  { age: '12m', label: '공 굴리기', emoji: '⚽', prompt: 'A baby rolling a ball back and forth' },
  { age: '12m', label: '크레용 쥐기', emoji: '🖍', prompt: 'A baby holding crayon and making marks' },
  { age: '12m', label: '완료식 시작', emoji: '🍚', prompt: 'A baby eating regular table food, complete weaning' },
  { age: '12m', label: '엄마아빠에게 애정표현', emoji: '💕', prompt: 'A baby hugging parent with love, affection' },

  // 13개월
  { age: '13m', label: '걷기 점점 안정', emoji: '🚶', prompt: 'A toddler walking more steadily, gaining balance' },
  { age: '13m', label: '원하는 것 가리키기', emoji: '👆', prompt: 'A toddler pointing at desired object' },
  { age: '13m', label: '숟가락 혼자 시도', emoji: '🥄', prompt: 'A toddler trying to use spoon alone, messy eating' },
  { age: '13m', label: '블록 3개 쌓기', emoji: '🧱', prompt: 'A toddler stacking three blocks tower' },
  { age: '13m', label: '동물 소리 흉내', emoji: '🐶', prompt: 'A toddler making animal sounds, woof woof' },
  { age: '13m', label: '인형에 밥 주기', emoji: '🧸', prompt: 'A toddler pretending to feed stuffed animal' },
  { age: '13m', label: '신발 벗기 시도', emoji: '👟', prompt: 'A toddler trying to take off shoes' },
  { age: '13m', label: '밥 거부/편식 시작', emoji: '🍽', prompt: 'A toddler refusing food, picky eating' },

  // 14개월
  { age: '14m', label: '뒤로 걷기', emoji: '🔙', prompt: 'A toddler walking backwards carefully' },
  { age: '14m', label: '의미있는 단어 5개+', emoji: '💬', prompt: 'A toddler speaking multiple words with speech bubbles' },
  { age: '14m', label: '컵 혼자 사용', emoji: '🥛', prompt: 'A toddler drinking from cup alone' },
  { age: '14m', label: '그리기(끼적)', emoji: '🎨', prompt: 'A toddler scribbling with crayon on paper' },
  { age: '14m', label: '신체 부위 가리키기', emoji: '👆', prompt: 'A toddler pointing to body parts like nose, eyes' },
  { age: '14m', label: '계단 기어오르기', emoji: '🪜', prompt: 'A toddler crawling up stairs' },
  { age: '14m', label: '소유욕 표현', emoji: '🫂', prompt: 'A toddler hugging toy saying mine' },
  { age: '14m', label: '리듬에 맞춰 흔들기', emoji: '🎵', prompt: 'A toddler dancing and swaying to rhythm' },

  // 15개월
  { age: '15m', label: '안정적으로 걷기', emoji: '🚶', prompt: 'A toddler walking confidently and steadily' },
  { age: '15m', label: '공 차기 시도', emoji: '⚽', prompt: 'A toddler trying to kick a ball' },
  { age: '15m', label: '10개 이상 단어 이해', emoji: '🧠', prompt: 'A toddler understanding many words, brain with lightbulb' },
  { age: '15m', label: '책 넘기기', emoji: '📖', prompt: 'A toddler turning pages of picture book' },
  { age: '15m', label: '낙서하기', emoji: '🖍', prompt: 'A toddler doodling on paper with crayons' },
  { age: '15m', label: '동물 이름 말하기', emoji: '🐱', prompt: 'A toddler pointing at animal and naming it' },
  { age: '15m', label: '컵에 물 따르기 흉내', emoji: '🫗', prompt: 'A toddler pretending to pour water from teapot' },
  { age: '15m', label: '또래 옆에서 놀기', emoji: '👫', prompt: 'Two toddlers playing side by side, parallel play' },

  // 16개월
  { age: '16m', label: '빠르게 걷기', emoji: '🏃', prompt: 'A toddler walking fast, almost running' },
  { age: '16m', label: '두 단어 조합 시도', emoji: '💬', prompt: 'A toddler trying two-word phrases' },
  { age: '16m', label: '블록 4개 쌓기', emoji: '🧱', prompt: 'A toddler stacking four blocks into tower' },
  { age: '16m', label: '양말 벗기', emoji: '🧦', prompt: 'A toddler pulling off socks independently' },
  { age: '16m', label: '간단한 심부름', emoji: '✅', prompt: 'A toddler carrying small item to parent, helping' },
  { age: '16m', label: '신체 부위 3~4개', emoji: '👆', prompt: 'A toddler pointing to multiple body parts' },
  { age: '16m', label: '숟가락으로 혼자 먹기', emoji: '🥄', prompt: 'A toddler eating with spoon independently' },
  { age: '16m', label: '그림책 좋아하기', emoji: '📚', prompt: 'A toddler happily looking at picture books' },

  // 17개월
  { age: '17m', label: '계단 한 손 잡고 오르기', emoji: '🪜', prompt: 'A toddler climbing stairs holding railing with one hand' },
  { age: '17m', label: '50개 이상 단어 이해', emoji: '🧠', prompt: 'A toddler understanding many words, smart expression' },
  { age: '17m', label: '뚜껑 열고 닫기', emoji: '🫙', prompt: 'A toddler opening and closing container lids' },
  { age: '17m', label: '동물 소리 5가지+', emoji: '🐶', prompt: 'A toddler making various animal sounds, multiple animals' },
  { age: '17m', label: '인형 안아주기', emoji: '🧸', prompt: 'A toddler hugging stuffed animal lovingly' },
  { age: '17m', label: '세로선 그리기', emoji: '🖍', prompt: 'A toddler drawing vertical lines on paper' },
  { age: '17m', label: '포크 사용 시도', emoji: '🍴', prompt: 'A toddler trying to use fork to eat' },
  { age: '17m', label: '숨바꼭질 좋아하기', emoji: '🙈', prompt: 'A toddler playing hide and seek, peeking' },

  // 18개월
  { age: '18m', label: '달리기 시작', emoji: '🏃', prompt: 'A toddler starting to run, energetic movement' },
  { age: '18m', label: '두 단어 문장', emoji: '💬', prompt: 'A toddler saying two-word sentences' },
  { age: '18m', label: '블록 5~6개 쌓기', emoji: '🧱', prompt: 'A toddler building tall tower with five six blocks' },
  { age: '18m', label: '옷 벗기 시도', emoji: '👕', prompt: 'A toddler trying to take off shirt' },
  { age: '18m', label: '자기 이름 반응', emoji: '🏷', prompt: 'A toddler responding to own name being called' },
  { age: '18m', label: '분류하기(크기/색)', emoji: '🔵', prompt: 'A toddler sorting objects by color and size' },
  { age: '18m', label: '그림에 이름 붙이기', emoji: '🎨', prompt: 'A toddler naming objects in drawings' },
  { age: '18m', label: '또래와 나란히 놀이', emoji: '👫', prompt: 'Two toddlers playing side by side with toys' },

  // 19개월
  { age: '19m', label: '점프 시도', emoji: '🤸', prompt: 'A toddler trying to jump with both feet' },
  { age: '19m', label: '단어 20개+ 사용', emoji: '💬', prompt: 'A toddler speaking many words expressively' },
  { age: '19m', label: '색깔 1~2개 인식', emoji: '🌈', prompt: 'A toddler recognizing and pointing to colors' },
  { age: '19m', label: '지퍼 올리기 시도', emoji: '🤐', prompt: 'A toddler trying to pull up zipper on jacket' },
  { age: '19m', label: '노래 따라 흥얼', emoji: '🎤', prompt: 'A toddler humming along to a song' },
  { age: '19m', label: '숫자 따라 말하기', emoji: '🔢', prompt: 'A toddler repeating numbers one two three' },
  { age: '19m', label: '혼자 먹기 안정', emoji: '🍽', prompt: 'A toddler eating independently at table' },
  { age: '19m', label: '감정 표현 시작', emoji: '😤', prompt: 'A toddler expressing emotions, frustrated or happy face' },

  // 20개월
  { age: '20m', label: '빠르게 달리기', emoji: '🏃', prompt: 'A toddler running fast with confidence' },
  { age: '20m', label: '두 단어 문장 자주', emoji: '💬', prompt: 'A toddler frequently using two-word phrases' },
  { age: '20m', label: '블록 6개 쌓기', emoji: '🧱', prompt: 'A toddler stacking six blocks into tall tower' },
  { age: '20m', label: '공 던지기', emoji: '🥎', prompt: 'A toddler throwing ball overhand' },
  { age: '20m', label: '간단한 퍼즐', emoji: '🧩', prompt: 'A toddler fitting simple puzzle pieces, 2-3 pieces' },
  { age: '20m', label: '양치 시도', emoji: '🪥', prompt: 'A toddler trying to brush own teeth' },
  { age: '20m', label: '상상 놀이 시작', emoji: '🎭', prompt: 'A toddler doing pretend play, imagination' },
  { age: '20m', label: '친구에게 관심', emoji: '🤝', prompt: 'A toddler showing interest in other children' },

  // 21개월
  { age: '21m', label: '계단 오르내리기', emoji: '🪜', prompt: 'A toddler going up and down stairs' },
  { age: '21m', label: '50+ 단어 사용', emoji: '💬', prompt: 'A toddler using many words, expressive talking' },
  { age: '21m', label: '이름 말하기', emoji: '🏷', prompt: 'A toddler saying own name' },
  { age: '21m', label: '신발 신기 시도', emoji: '👟', prompt: 'A toddler trying to put on shoes' },
  { age: '21m', label: '동그라미 그리기 시도', emoji: '⭕', prompt: 'A toddler trying to draw circle on paper' },
  { age: '21m', label: '크다/작다 이해', emoji: '📏', prompt: 'A toddler understanding big and small concept with objects' },
  { age: '21m', label: '밥 먹기 싫다 표현', emoji: '🙅', prompt: 'A toddler refusing food, shaking head no' },
  { age: '21m', label: '차례 기다리기 시도', emoji: '⏳', prompt: 'A toddler waiting for turn patiently' },

  // 22개월
  { age: '22m', label: '두 발 모아 점프', emoji: '🤸', prompt: 'A toddler jumping with both feet together' },
  { age: '22m', label: '세 단어 문장 시도', emoji: '💬', prompt: 'A toddler trying three-word sentences' },
  { age: '22m', label: '옷 벗기 혼자', emoji: '👕', prompt: 'A toddler undressing by themselves' },
  { age: '22m', label: '색깔 2~3개 구분', emoji: '🌈', prompt: 'A toddler distinguishing two or three colors' },
  { age: '22m', label: '노래 따라부르기', emoji: '🎤', prompt: 'A toddler singing along to a nursery song' },
  { age: '22m', label: '블록으로 기차 만들기', emoji: '🚂', prompt: 'A toddler building train with blocks, creative play' },
  { age: '22m', label: '포크 사용 안정', emoji: '🍴', prompt: 'A toddler using fork confidently' },
  { age: '22m', label: '소유욕 강해짐', emoji: '🫂', prompt: 'A toddler clutching toy possessively, mine' },

  // 23개월
  { age: '23m', label: '한 발로 서기 시도', emoji: '🦩', prompt: 'A toddler balancing on one foot briefly' },
  { age: '23m', label: '왜? 질문 시작', emoji: '❓', prompt: 'A toddler asking why with curious expression' },
  { age: '23m', label: '4~5조각 퍼즐', emoji: '🧩', prompt: 'A toddler completing a 4-5 piece puzzle' },
  { age: '23m', label: '지퍼 올리기 성공', emoji: '🤐', prompt: 'A toddler successfully zipping up jacket' },
  { age: '23m', label: '역할 놀이(소꿉)', emoji: '🧑‍🍳', prompt: 'A toddler playing pretend cooking, role play' },
  { age: '23m', label: '간단한 지시 2단계', emoji: '✅', prompt: 'A toddler following two-step instructions' },
  { age: '23m', label: '컵 혼자 따르기', emoji: '🫗', prompt: 'A toddler pouring from small pitcher into cup' },
  { age: '23m', label: '친구와 장난감 나누기 시도', emoji: '🤝', prompt: 'A toddler sharing toy with another child' },

  // 24개월
  { age: '24m', label: '세발자전거 관심', emoji: '🚲', prompt: 'A toddler showing interest in tricycle' },
  { age: '24m', label: '두~세 단어 문장 자유', emoji: '💬', prompt: 'A toddler speaking freely in short sentences' },
  { age: '24m', label: '숫자 1~5 따라 세기', emoji: '🔢', prompt: 'A toddler counting to five with fingers' },
  { age: '24m', label: '옷 입기 시도', emoji: '👔', prompt: 'A toddler trying to put on clothes' },
  { age: '24m', label: '동그라미 그리기', emoji: '⭕', prompt: 'A toddler drawing circle on paper' },
  { age: '24m', label: '화장실 관심', emoji: '🚽', prompt: 'A toddler showing interest in toilet, potty training' },
  { age: '24m', label: '혼자 식사 완성', emoji: '🍽', prompt: 'A toddler eating meal independently at table' },
  { age: '24m', label: '감정 이름 말하기', emoji: '😊', prompt: 'A toddler naming emotions happy sad angry' },

  // 25~27개월
  { age: '25-27m', label: '높은 곳 오르기', emoji: '🧗', prompt: 'A toddler climbing up play structure' },
  { age: '25-27m', label: '100+ 단어 사용', emoji: '💬', prompt: 'A toddler talking expressively with many words' },
  { age: '25-27m', label: '화장실 가기 연습', emoji: '🚽', prompt: 'A toddler practicing using potty chair' },
  { age: '25-27m', label: '가위 잡기 시도', emoji: '✂️', prompt: 'A toddler trying to hold safety scissors' },
  { age: '25-27m', label: '숫자 1~3 세기', emoji: '🔢', prompt: 'A toddler counting one two three with blocks' },
  { age: '25-27m', label: '색칠하기 시도', emoji: '🖍', prompt: 'A toddler trying to color inside lines' },
  { age: '25-27m', label: '친구와 놀기', emoji: '👫', prompt: 'Two toddlers playing together cooperatively' },
  { age: '25-27m', label: '밥 잘 안 먹는 시기', emoji: '🙅', prompt: 'A toddler being picky about food' },

  // 28~30개월
  { age: '28-30m', label: '한 발로 잠깐 서기', emoji: '🦩', prompt: 'A toddler standing on one foot for a moment' },
  { age: '28-30m', label: '왜? 질문 폭발', emoji: '❓', prompt: 'A toddler asking why repeatedly with curiosity' },
  { age: '28-30m', label: '옷 입기 시도', emoji: '👔', prompt: 'A toddler putting on shirt by themselves' },
  { age: '28-30m', label: '이야기 이해하기', emoji: '📚', prompt: 'A toddler listening to story and understanding' },
  { age: '28-30m', label: '이름 쓰기 흉내', emoji: '✏️', prompt: 'A toddler pretending to write name on paper' },
  { age: '28-30m', label: '역할 놀이 다양화', emoji: '🎭', prompt: 'A toddler doing various role plays, doctor teacher' },
  { age: '28-30m', label: '규칙 이해 시작', emoji: '📋', prompt: 'A toddler understanding simple rules' },
  { age: '28-30m', label: '나누기/양보하기', emoji: '🤝', prompt: 'A toddler sharing and taking turns with friend' },

  // 31~33개월
  { age: '31-33m', label: '계단 번갈아 오르기', emoji: '🪜', prompt: 'A child climbing stairs alternating feet' },
  { age: '31-33m', label: '긴 문장 말하기', emoji: '💬', prompt: 'A child speaking in long sentences' },
  { age: '31-33m', label: '단추 끼우기 시도', emoji: '🔘', prompt: 'A child trying to button up shirt' },
  { age: '31-33m', label: '숫자 1~5 세기', emoji: '🔢', prompt: 'A child counting to five confidently' },
  { age: '31-33m', label: '노래 전체 부르기', emoji: '🎵', prompt: 'A child singing complete nursery rhyme' },
  { age: '31-33m', label: '화장실 혼자 가기 시도', emoji: '🚽', prompt: 'A child trying to use toilet independently' },
  { age: '31-33m', label: '음식 골고루 시도', emoji: '🥗', prompt: 'A child trying various foods, balanced eating' },
  { age: '31-33m', label: '감정 조절 연습', emoji: '😌', prompt: 'A child calming down and regulating emotions' },

  // 34~36개월
  { age: '34-36m', label: '세발자전거 타기', emoji: '🚴', prompt: 'A child riding tricycle confidently' },
  { age: '34-36m', label: '대화 가능', emoji: '💬', prompt: 'A child having conversation with adult' },
  { age: '34-36m', label: '가위로 자르기', emoji: '✂️', prompt: 'A child cutting paper with safety scissors' },
  { age: '34-36m', label: '색깔 5가지+ 구분', emoji: '🌈', prompt: 'A child identifying five or more colors' },
  { age: '34-36m', label: '그림으로 표현', emoji: '🖼', prompt: 'A child drawing recognizable pictures' },
  { age: '34-36m', label: '규칙 게임 참여', emoji: '🎲', prompt: 'A child playing board game following rules' },
  { age: '34-36m', label: '혼자 옷 입기', emoji: '👕', prompt: 'A child dressing independently' },
  { age: '34-36m', label: '친구 사귀기', emoji: '🤝', prompt: 'A child making friends, social interaction' },

  // 4세 (37~48개월)
  { age: '4y', label: '한 발로 5초 서기', emoji: '🦩', prompt: 'A child balancing on one foot for five seconds' },
  { age: '4y', label: '이름 쓰기', emoji: '✏️', prompt: 'A child writing own name on paper' },
  { age: '4y', label: '이야기 만들기', emoji: '📖', prompt: 'A child creating and telling a story' },
  { age: '4y', label: '가위바위보', emoji: '✊', prompt: 'A child playing rock paper scissors game' },
  { age: '4y', label: '시간 개념(아침/저녁)', emoji: '⏰', prompt: 'A child understanding morning and evening, clock concept' },
  { age: '4y', label: '차례 지키기', emoji: '🔄', prompt: 'A child waiting for turn patiently in line' },
  { age: '4y', label: '수 세기(10이상)', emoji: '🔟', prompt: 'A child counting numbers beyond ten' },
  { age: '4y', label: '줄넘기 시도', emoji: '🤾', prompt: 'A child trying to jump rope' },

  // 5세 (49~60개월)
  { age: '5y', label: '자전거 보조바퀴', emoji: '🚴', prompt: 'A child riding bicycle with training wheels' },
  { age: '5y', label: '한글 관심/읽기', emoji: '🇰🇷', prompt: 'A child reading Korean letters, learning hangul' },
  { age: '5y', label: '동화 이해/전달', emoji: '📖', prompt: 'A child understanding and retelling fairy tale' },
  { age: '5y', label: '규칙 게임 즐기기', emoji: '🎲', prompt: 'A child enjoying board games with rules' },
  { age: '5y', label: '혼자 옷 입기 완성', emoji: '👕', prompt: 'A child fully dressing independently including buttons' },
  { age: '5y', label: '친구 관계 형성', emoji: '🤝', prompt: 'A child forming friendships, playing together' },
  { age: '5y', label: '그림 상세하게 그리기', emoji: '🎨', prompt: 'A child drawing detailed picture with colors' },
  { age: '5y', label: '숫자 20까지 세기', emoji: '🔢', prompt: 'A child counting to twenty with fingers' },

  // 6세 이상 (61+개월)
  { age: '6y+', label: '자전거 두발', emoji: '🚴', prompt: 'A child riding bicycle without training wheels' },
  { age: '6y+', label: '읽기/쓰기 시작', emoji: '📝', prompt: 'A child reading and writing simple sentences' },
  { age: '6y+', label: '긴 문장 말하기', emoji: '💬', prompt: 'A child speaking in long complex sentences' },
  { age: '6y+', label: '덧셈/뺄셈 시작', emoji: '🔢', prompt: 'A child doing simple addition and subtraction' },
  { age: '6y+', label: '줄넘기 연속', emoji: '🤾', prompt: 'A child jumping rope continuously' },
  { age: '6y+', label: '규칙 지키기', emoji: '📋', prompt: 'A child following rules and social norms' },
  { age: '6y+', label: '요리 도와주기', emoji: '🧑‍🍳', prompt: 'A child helping with cooking in kitchen' },
  { age: '6y+', label: '혼자 준비하기', emoji: '🎒', prompt: 'A child packing school bag independently' },
];

/* ── Gemini 호출 ── */
async function generateMilestone(milestone, idx, total) {
  const fullPrompt = `${MASTER_STYLE}. Create a small icon representing: ${milestone.prompt}. The icon should be simple, cute, and immediately recognizable at small sizes.`;

  console.log(`  [${idx + 1}/${total}] ${milestone.age} - ${milestone.label}...`);

  const body = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature: 0.4,
    },
  };

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  FAILED: HTTP ${res.status}`, err.slice(0, 200));
      return false;
    }

    const json = await res.json();
    const candidates = json.candidates || [];

    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const buf = Buffer.from(part.inlineData.data, 'base64');
          const safeName = `${milestone.age}-${milestone.label.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.png`;
          const outPath = path.join(OUT_DIR, safeName);
          fs.writeFileSync(outPath, buf);
          console.log(`  Saved ${safeName} (${(buf.length / 1024).toFixed(0)} KB)`);
          return true;
        }
      }
    }

    console.error(`  No image data in response for ${milestone.label}`);
    return false;
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    return false;
  }
}

/* ── 메인 ── */
async function main() {
  const startFrom = parseInt(process.argv[2] || '0', 10);

  console.log('=' .repeat(60));
  console.log('Gemini Milestone Icon Generator');
  console.log(`Total: ${MILESTONES.length} icons (starting from #${startFrom})`);
  console.log('=' .repeat(60));

  let success = 0;
  let fail = 0;

  for (let i = startFrom; i < MILESTONES.length; i++) {
    const ok = await generateMilestone(MILESTONES[i], i, MILESTONES.length);
    if (ok) success++;
    else fail++;

    // Gemini rate limit: ~10 req/min for free tier
    if (i < MILESTONES.length - 1) {
      await new Promise(r => setTimeout(r, 7000));
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`DONE! ${success} success, ${fail} failed`);
  console.log(`Output: ${OUT_DIR}`);
  console.log('=' .repeat(60));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
