#!/usr/bin/env node
/**
 * 아맞다 에셋 자동 생성 스크립트
 * fal.ai FLUX 모델로 모든 앱 에셋 이미지를 자동 생성
 *
 * 사용법:
 *   1. npm install @fal-ai/client (scripts 폴더에서)
 *   2. FAL_KEY=fal-xxxxx node scripts/generate-assets.mjs
 *   3. --category=mascot  (특정 카테고리만)
 *   4. --dry-run           (프롬프트만 출력)
 *   5. --model=dev         (고품질 모드)
 *   6. --overwrite         (기존 파일 덮어쓰기)
 */

import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "frontend", "assets");

/* ═══════════════════════════════════════════════════════
   CLI 옵션
   ═══════════════════════════════════════════════════════ */
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const OVERWRITE = args.includes("--overwrite");
const categoryArg = args.find((a) => a.startsWith("--category="));
const FILTER_CAT = categoryArg ? categoryArg.split("=")[1] : null;
const modelArg = args.find((a) => a.startsWith("--model="));
const MODEL_CHOICE = modelArg ? modelArg.split("=")[1] : "schnell";

const MODELS = {
  schnell: "fal-ai/flux/schnell",
  dev: "fal-ai/flux/dev",
  pro: "fal-ai/flux-pro/v1.1",
};
const MODEL = MODELS[MODEL_CHOICE] || MODELS.schnell;
const BATCH_SIZE = 4;
const DELAY_MS = 500;

/* ═══════════════════════════════════════════════════════
   공통 스타일 프리픽스
   ═══════════════════════════════════════════════════════ */
const BASE_STYLE =
  "3D rendered Pixar-style illustration for a premium Korean parenting app. " +
  "Soft pastel colors with warm cream (#FFF5EC), coral (#FF8C5A), mint (#4ECDC4) palette. " +
  "Rounded smooth 3D shapes, subsurface scattering, soft ambient occlusion, gentle depth of field. " +
  "Cute clay-like 3D render, studio lighting, child-safe wholesome imagery. " +
  "Clean minimal composition, high quality 3D render, no text or letters or words.";

const ICON_STYLE =
  "3D rendered icon design, single centered object, smooth rounded shapes, " +
  "soft clay-like material, subtle glossy finish, soft shadow, depth effect. " +
  "Isometric 3D style, studio lighting. No text.";

const CHAR_STYLE =
  "Adorable 3D rendered Pixar-style chibi character, big sparkly eyes, round smooth face, " +
  "soft clay-like skin texture, subsurface scattering, warm pastel colors, full body visible. " +
  "Cute 3D cartoon render, soft studio lighting, gentle shadows. No text.";

/* ═══════════════════════════════════════════════════════
   에셋 정의 (총 120개)
   ═══════════════════════════════════════════════════════ */

/** @type {Array<{filename: string, category: string, size: string, prompt: string, desc: string}>} */
const ASSETS = [

  // ───────────────────────────────────────────────
  // 1. 앱 아이콘 & 스토어 (5)
  // ───────────────────────────────────────────────
  {
    filename: "icon.png",
    category: "app-icon",
    size: "square_hd",
    desc: "앱 아이콘 1024x1024",
    prompt: `${BASE_STYLE} App icon design. A cute baby character hugging a small glowing star, surrounded by soft pastel clouds. Cream background with subtle golden border. Rounded square safe area.`,
  },
  {
    filename: "adaptive-icon.png",
    category: "app-icon",
    size: "square_hd",
    desc: "Android 적응형 아이콘",
    prompt: `${BASE_STYLE} Android adaptive icon foreground layer. Centered cute baby mascot face with rosy cheeks and star-shaped eyes. Transparent background. Only center 72% has content.`,
  },
  {
    filename: "splash-icon.png",
    category: "app-icon",
    size: "square",
    desc: "스플래시 아이콘",
    prompt: `${BASE_STYLE} Splash screen logo. Simple minimalist baby silhouette with a glowing heart, surrounded by tiny stars. Clean white background.`,
  },
  {
    filename: "favicon.png",
    category: "app-icon",
    size: "square",
    desc: "웹 파비콘",
    prompt: `${BASE_STYLE} Tiny favicon. Simple baby face icon with big eyes and rosy cheeks. Works at 16x16 pixels. Minimal detail, bold shapes.`,
  },
  {
    filename: "store-banner.png",
    category: "app-icon",
    size: "landscape_16_9",
    desc: "플레이스토어 배너",
    prompt: `${BASE_STYLE} App store promotional banner. Happy parent and baby character together, floating among pastel clouds and stars. Dreamy magical atmosphere with golden sparkles. Wide composition.`,
  },

  // ───────────────────────────────────────────────
  // 2. 메인 마스코트 캐릭터 (9)
  // ───────────────────────────────────────────────
  {
    filename: "child-diary.png",
    category: "mascot",
    size: "square_hd",
    desc: "메인 히어로 마스코트 (로그인/스플래시)",
    prompt: `${CHAR_STYLE} A cute toddler mascot character holding a small diary/journal, wearing a soft peach outfit with a tiny star pin. Surrounded by floating pastel hearts and stars. Warm cream background.`,
  },
  {
    filename: "mascot-waving.png",
    category: "mascot",
    size: "square",
    desc: "인사하는 마스코트 (첫 대화)",
    prompt: `${CHAR_STYLE} Cute toddler mascot waving hello enthusiastically with one hand raised, bright happy smile, small sparkles around. Cream background.`,
  },
  {
    filename: "mascot-thinking.png",
    category: "mascot",
    size: "square",
    desc: "생각하는 마스코트 (AI 분석중)",
    prompt: `${CHAR_STYLE} Cute toddler mascot in thinking pose, hand on chin, eyes looking up, small lightbulb and question marks floating above head. Soft purple tint background.`,
  },
  {
    filename: "mascot-happy.png",
    category: "mascot",
    size: "square",
    desc: "기쁜 마스코트 (좋은 결과)",
    prompt: `${CHAR_STYLE} Cute toddler mascot jumping with joy, arms raised, confetti and stars around, big sparkly eyes, rosy cheeks. Golden sparkle background.`,
  },
  {
    filename: "mascot-worried.png",
    category: "mascot",
    size: "square",
    desc: "걱정 마스코트 (주의/레드플래그)",
    prompt: `${CHAR_STYLE} Cute toddler mascot looking worried, hands clasped, small sweat drop, concerned expression but still adorable. Soft blue-grey tint background.`,
  },
  {
    filename: "mascot-reading.png",
    category: "mascot",
    size: "square",
    desc: "책읽는 마스코트 (리포트/일기)",
    prompt: `${CHAR_STYLE} Cute toddler mascot sitting and reading a colorful picture book, focused gentle expression, small stars floating from the book pages. Warm cream background.`,
  },
  {
    filename: "mascot-sleeping.png",
    category: "mascot",
    size: "square",
    desc: "자는 마스코트 (수면 관련)",
    prompt: `${CHAR_STYLE} Cute toddler mascot sleeping peacefully on a small cloud pillow, tiny moon and stars above, soft zzz bubbles. Night blue-purple pastel background.`,
  },
  {
    filename: "mascot-eating.png",
    category: "mascot",
    size: "square",
    desc: "밥먹는 마스코트 (식사 관련)",
    prompt: `${CHAR_STYLE} Cute toddler mascot sitting in a high chair eating happily with a small spoon, colorful vegetables on the plate, food sparkles. Warm peach background.`,
  },
  {
    filename: "mascot-doctor.png",
    category: "mascot",
    size: "square",
    desc: "의사 마스코트 (진료 안내)",
    prompt: `${CHAR_STYLE} Cute toddler mascot wearing a tiny doctor coat and stethoscope, holding a small first-aid kit, caring expression. Soft mint green background.`,
  },

  // ───────────────────────────────────────────────
  // 3. 기질 캐릭터 대형 (5)
  // ───────────────────────────────────────────────
  {
    filename: "trait-active.png",
    category: "trait",
    size: "square_hd",
    desc: "활동형 기질 (대형)",
    prompt: `${CHAR_STYLE} Energetic toddler character running and jumping with joy, surrounded by flame and sun motifs, dynamic pose. Orange-red warm color palette (#FF8C5A, #FF6B35). Sparks of energy around.`,
  },
  {
    filename: "trait-explorer.png",
    category: "trait",
    size: "square_hd",
    desc: "탐구형 기질 (대형)",
    prompt: `${CHAR_STYLE} Curious toddler character holding a magnifying glass, examining a butterfly, surrounded by leaves and nature. Green-teal color palette (#4ECDC4, #2BA89E). Botanical elements.`,
  },
  {
    filename: "trait-harmony.png",
    category: "trait",
    size: "square_hd",
    desc: "조화형 기질 (대형)",
    prompt: `${CHAR_STYLE} Gentle toddler character holding hands with a friend, peaceful smile, surrounded by soft flowers and earth elements. Yellow-beige warm palette (#FFD76E, #F5E6CC). Harmony and balance motifs.`,
  },
  {
    filename: "trait-analyst.png",
    category: "trait",
    size: "square_hd",
    desc: "분석형 기질 (대형)",
    prompt: `${CHAR_STYLE} Focused toddler character stacking colorful blocks precisely, wearing tiny glasses, surrounded by geometric shapes and gears. Silver-white cool palette (#C0C0C0, #E8E8E8). Structured layout.`,
  },
  {
    filename: "trait-sensitive.png",
    category: "trait",
    size: "square_hd",
    desc: "감성형 기질 (대형)",
    prompt: `${CHAR_STYLE} Artistic toddler character painting on a small easel, dreamy expression, surrounded by watercolor splashes and musical notes. Blue-purple palette (#7C83EC, #B8A5E8). Creative atmosphere.`,
  },

  // ───────────────────────────────────────────────
  // 3b. 기질 캐릭터 소형 아이콘 (5)
  // ───────────────────────────────────────────────
  {
    filename: "trait-active-small.png",
    category: "trait",
    size: "square",
    desc: "활동형 아이콘 (소형)",
    prompt: `${ICON_STYLE} Simple flame/sun symbol icon, orange-coral gradient (#FF8C5A), rounded, energetic feel. White background.`,
  },
  {
    filename: "trait-explorer-small.png",
    category: "trait",
    size: "square",
    desc: "탐구형 아이콘 (소형)",
    prompt: `${ICON_STYLE} Simple magnifying glass with leaf symbol, teal-green gradient (#4ECDC4), rounded. White background.`,
  },
  {
    filename: "trait-harmony-small.png",
    category: "trait",
    size: "square",
    desc: "조화형 아이콘 (소형)",
    prompt: `${ICON_STYLE} Simple two hands holding together symbol, warm yellow gradient (#FFD76E), rounded. White background.`,
  },
  {
    filename: "trait-analyst-small.png",
    category: "trait",
    size: "square",
    desc: "분석형 아이콘 (소형)",
    prompt: `${ICON_STYLE} Simple geometric cube/block symbol, silver-white gradient (#C0C0C0), clean lines. White background.`,
  },
  {
    filename: "trait-sensitive-small.png",
    category: "trait",
    size: "square",
    desc: "감성형 아이콘 (소형)",
    prompt: `${ICON_STYLE} Simple paint palette with water drop symbol, blue-purple gradient (#7C83EC), rounded. White background.`,
  },

  // ───────────────────────────────────────────────
  // 4. 온보딩 일러스트 (7)
  // ───────────────────────────────────────────────
  {
    filename: "onboarding-bg.png",
    category: "onboarding",
    size: "landscape_4_3",
    desc: "온보딩 배경",
    prompt: `${BASE_STYLE} Dreamy pastel background pattern. Soft clouds, tiny stars, and gentle rainbow arcs floating in a warm cream sky. Abstract, no characters. Seamless gentle pattern.`,
  },
  {
    filename: "onboarding-welcome.png",
    category: "onboarding",
    size: "square_hd",
    desc: "온보딩 환영 (1단계)",
    prompt: `${CHAR_STYLE} A loving parent holding a baby tenderly, both smiling, surrounded by warm golden light and floating hearts. Cozy intimate atmosphere. Warm peach-cream background.`,
  },
  {
    filename: "onboarding-profile.png",
    category: "onboarding",
    size: "square_hd",
    desc: "온보딩 아이등록 (2단계)",
    prompt: `${CHAR_STYLE} Cute toddler standing next to a large profile card being created, sparkles and stars decorating the card. Magic wand touching the card. Soft mint background.`,
  },
  {
    filename: "onboarding-survey.png",
    category: "onboarding",
    size: "square_hd",
    desc: "온보딩 설문 (3단계)",
    prompt: `${CHAR_STYLE} Parent character holding a clipboard with checkmarks, toddler peeking curiously from behind. Checklist with colorful checkmarks floating. Soft lavender background.`,
  },
  {
    filename: "analyzing.png",
    category: "onboarding",
    size: "square",
    desc: "기질 분석중 로딩",
    prompt: `${BASE_STYLE} Magical analysis scene. A crystal ball or snow globe with stars swirling inside, golden sparkles orbiting around it. Cosmic pastel purple-blue background. Mystical but cute.`,
  },
  {
    filename: "report-header.png",
    category: "onboarding",
    size: "landscape_4_3",
    desc: "분석 리포트 헤더",
    prompt: `${BASE_STYLE} Wide banner composition. Soft gradient from coral to cream with scattered tiny stars and constellation lines. Abstract geometric shapes suggesting growth and discovery. Elegant minimal.`,
  },
  {
    filename: "onboarding-complete.png",
    category: "onboarding",
    size: "square_hd",
    desc: "온보딩 완료 축하",
    prompt: `${CHAR_STYLE} Toddler mascot celebrating with confetti and fireworks raining down, trophy or certificate in hand, golden crown floating above. Joyful festive atmosphere. Cream-gold background.`,
  },

  // ───────────────────────────────────────────────
  // 5. 탭바 아이콘 (8) - 4탭 x active/inactive
  // ───────────────────────────────────────────────
  {
    filename: "tab-home.png",
    category: "tab",
    size: "square",
    desc: "홈 탭 (비활성)",
    prompt: `${ICON_STYLE} Minimal house icon with small chimney, outline style, medium grey color (#666666), thin clean lines. Pure white background.`,
  },
  {
    filename: "tab-home-active.png",
    category: "tab",
    size: "square",
    desc: "홈 탭 (활성)",
    prompt: `${ICON_STYLE} Minimal house icon with small chimney, filled solid style, coral color (#FF8C5A), clean shape. Pure white background.`,
  },
  {
    filename: "tab-diary.png",
    category: "tab",
    size: "square",
    desc: "관찰일기 탭 (비활성)",
    prompt: `${ICON_STYLE} Minimal open book/diary icon, outline style, medium grey color (#666666), thin clean lines. Pure white background.`,
  },
  {
    filename: "tab-diary-active.png",
    category: "tab",
    size: "square",
    desc: "관찰일기 탭 (활성)",
    prompt: `${ICON_STYLE} Minimal open book/diary icon, filled solid style, coral color (#FF8C5A), clean shape. Pure white background.`,
  },
  {
    filename: "tab-chat.png",
    category: "tab",
    size: "square",
    desc: "AI상담 탭 (비활성)",
    prompt: `${ICON_STYLE} Minimal chat bubble icon with small AI sparkle, outline style, medium grey color (#666666), thin clean lines. Pure white background.`,
  },
  {
    filename: "tab-chat-active.png",
    category: "tab",
    size: "square",
    desc: "AI상담 탭 (활성)",
    prompt: `${ICON_STYLE} Minimal chat bubble icon with small AI sparkle, filled solid style, coral color (#FF8C5A), clean shape. Pure white background.`,
  },
  {
    filename: "tab-more.png",
    category: "tab",
    size: "square",
    desc: "더보기 탭 (비활성)",
    prompt: `${ICON_STYLE} Minimal three horizontal lines menu icon (hamburger), outline style, medium grey color (#666666), thin clean lines. Pure white background.`,
  },
  {
    filename: "tab-more-active.png",
    category: "tab",
    size: "square",
    desc: "더보기 탭 (활성)",
    prompt: `${ICON_STYLE} Minimal three horizontal lines menu icon (hamburger), filled solid style, coral color (#FF8C5A), clean shape. Pure white background.`,
  },

  // ───────────────────────────────────────────────
  // 6. 카테고리 아이콘 (8)
  // ───────────────────────────────────────────────
  {
    filename: "cat-crying.png",
    category: "category",
    size: "square",
    desc: "울음 카테고리",
    prompt: `${ICON_STYLE} Cute baby face with tear drops, soft pastel, empathetic gentle expression. Round circular icon. Peach background.`,
  },
  {
    filename: "cat-sleep.png",
    category: "category",
    size: "square",
    desc: "수면 카테고리",
    prompt: `${ICON_STYLE} Cute sleeping baby face with crescent moon and stars, peaceful expression, zzz symbols. Round circular icon. Soft purple background.`,
  },
  {
    filename: "cat-eating.png",
    category: "category",
    size: "square",
    desc: "식사 카테고리",
    prompt: `${ICON_STYLE} Cute baby spoon and bowl with steam, colorful food items. Round circular icon. Warm orange background.`,
  },
  {
    filename: "cat-poop.png",
    category: "category",
    size: "square",
    desc: "대변 카테고리",
    prompt: `${ICON_STYLE} Cute friendly diaper icon with small sparkle, clean and hygienic feeling. Round circular icon. Soft green background.`,
  },
  {
    filename: "cat-social.png",
    category: "category",
    size: "square",
    desc: "사회성 카테고리",
    prompt: `${ICON_STYLE} Two cute children holding hands, friendship symbol. Round circular icon. Warm yellow background.`,
  },
  {
    filename: "cat-growth.png",
    category: "category",
    size: "square",
    desc: "성장 카테고리",
    prompt: `${ICON_STYLE} Height measurement ruler with small star at top, growth arrow pointing up. Round circular icon. Coral background.`,
  },
  {
    filename: "cat-behavior.png",
    category: "category",
    size: "square",
    desc: "행동 카테고리",
    prompt: `${ICON_STYLE} Cute toddler with thought bubble, curious expression. Round circular icon. Light blue background.`,
  },
  {
    filename: "cat-etc.png",
    category: "category",
    size: "square",
    desc: "기타 카테고리",
    prompt: `${ICON_STYLE} Speech bubble with question mark and sparkle. Round circular icon. Soft grey background.`,
  },

  // ───────────────────────────────────────────────
  // 7. 빈 상태 일러스트 (6)
  // ───────────────────────────────────────────────
  {
    filename: "empty-diary.png",
    category: "empty",
    size: "square",
    desc: "관찰일기 빈 상태",
    prompt: `${CHAR_STYLE} Open blank notebook with a pencil resting on it, tiny mascot character peeking from behind encouragingly. Soft warm light. Cream background.`,
  },
  {
    filename: "empty-album.png",
    category: "empty",
    size: "square",
    desc: "성장앨범 빈 상태",
    prompt: `${CHAR_STYLE} Empty vintage photo frames floating gently, small camera icon, tiny mascot character pointing at frames invitingly. Polaroid style. Cream background.`,
  },
  {
    filename: "empty-chat.png",
    category: "empty",
    size: "square",
    desc: "AI상담 빈 상태",
    prompt: `${CHAR_STYLE} Friendly mascot character with a speech bubble saying nothing yet, welcoming wave gesture, small AI sparkles around. Inviting warm atmosphere. Cream background.`,
  },
  {
    filename: "empty-momsta.png",
    category: "empty",
    size: "square",
    desc: "맘스타그램 빈 상태",
    prompt: `${CHAR_STYLE} Empty social feed layout with camera icon and heart, mascot character holding a phone encouragingly. Fun creative atmosphere. Cream background.`,
  },
  {
    filename: "empty-clinic.png",
    category: "empty",
    size: "square",
    desc: "소아과 후기 빈 상태",
    prompt: `${CHAR_STYLE} Cute small hospital building with cross sign, empty star ratings below, mascot character with stethoscope nearby. Soft mint background.`,
  },
  {
    filename: "empty-timeline.png",
    category: "empty",
    size: "square",
    desc: "타임라인 빈 상태",
    prompt: `${CHAR_STYLE} A path/road stretching into the distance with milestone flags, mascot character at the starting point looking ahead. Journey beginning atmosphere. Cream-blue background.`,
  },

  // ───────────────────────────────────────────────
  // 8. 홈 퀵액션 아이콘 (4)
  // ───────────────────────────────────────────────
  {
    filename: "quick-trait.png",
    category: "quick",
    size: "square",
    desc: "기질요약 퀵버튼",
    prompt: `${ICON_STYLE} Puzzle piece with star sparkle, colorful pastel (coral, mint, yellow). Rounded friendly shape. White background.`,
  },
  {
    filename: "quick-report.png",
    category: "quick",
    size: "square",
    desc: "리포트 퀵버튼",
    prompt: `${ICON_STYLE} Bar chart with upward trend and small star on top. Coral and mint colors. Rounded friendly shape. White background.`,
  },
  {
    filename: "quick-diary.png",
    category: "quick",
    size: "square",
    desc: "일기 퀵버튼",
    prompt: `${ICON_STYLE} Pencil writing on a small notepad with heart. Warm peach and coral colors. Rounded friendly shape. White background.`,
  },
  {
    filename: "quick-learning.png",
    category: "quick",
    size: "square",
    desc: "육아기록 퀵버튼",
    prompt: `${ICON_STYLE} Baby bottle and clock combined icon, tracking/logging symbol. Soft mint and coral colors. Rounded friendly shape. White background.`,
  },

  // ───────────────────────────────────────────────
  // 9. 날씨 아이콘 (5)
  // ───────────────────────────────────────────────
  {
    filename: "weather-sunny.png",
    category: "weather",
    size: "square",
    desc: "맑음",
    prompt: `${BASE_STYLE} Cute kawaii sun character with happy face and rosy cheeks, warm golden rays radiating outward. Soft watercolor style. Light sky background.`,
  },
  {
    filename: "weather-cloudy.png",
    category: "weather",
    size: "square",
    desc: "흐림",
    prompt: `${BASE_STYLE} Cute kawaii cloud character with neutral gentle expression, soft fluffy shape. Pastel grey-white watercolor. Light sky background.`,
  },
  {
    filename: "weather-rainy.png",
    category: "weather",
    size: "square",
    desc: "비",
    prompt: `${BASE_STYLE} Cute kawaii cloud character with rain drops falling, slightly sad but still adorable expression. Blue-grey soft watercolor. Light sky background.`,
  },
  {
    filename: "weather-snowy.png",
    category: "weather",
    size: "square",
    desc: "눈",
    prompt: `${BASE_STYLE} Cute kawaii cloud character with snowflakes falling, gentle smile, cozy winter feeling. White-blue soft watercolor. Light sky background.`,
  },
  {
    filename: "weather-night.png",
    category: "weather",
    size: "square",
    desc: "밤",
    prompt: `${BASE_STYLE} Cute kawaii crescent moon character with tiny stars around, peaceful sleepy expression. Deep blue-purple pastel watercolor. Dark sky background.`,
  },

  // ───────────────────────────────────────────────
  // 10. 학원/활동 타입 아이콘 (8)
  // ───────────────────────────────────────────────
  {
    filename: "academy-art.png",
    category: "academy",
    size: "square",
    desc: "미술",
    prompt: `${ICON_STYLE} Colorful art palette with small paintbrush, pastel paint dots. Warm creative colors. White background.`,
  },
  {
    filename: "academy-music.png",
    category: "academy",
    size: "square",
    desc: "음악",
    prompt: `${ICON_STYLE} Musical notes floating from small piano keys, melodic feel. Purple-pink pastel colors. White background.`,
  },
  {
    filename: "academy-coding.png",
    category: "academy",
    size: "square",
    desc: "코딩",
    prompt: `${ICON_STYLE} Small laptop with code brackets symbol, tech-cute style. Blue-green pastel colors. White background.`,
  },
  {
    filename: "academy-sports.png",
    category: "academy",
    size: "square",
    desc: "체육",
    prompt: `${ICON_STYLE} Soccer ball with motion lines, energetic feel. Orange-coral pastel colors. White background.`,
  },
  {
    filename: "academy-dance.png",
    category: "academy",
    size: "square",
    desc: "댄스",
    prompt: `${ICON_STYLE} Ballet shoes with small musical note, graceful feel. Pink-peach pastel colors. White background.`,
  },
  {
    filename: "academy-science.png",
    category: "academy",
    size: "square",
    desc: "과학",
    prompt: `${ICON_STYLE} Microscope with small star sparkle, discovery feel. Teal-green pastel colors. White background.`,
  },
  {
    filename: "academy-math.png",
    category: "academy",
    size: "square",
    desc: "수학",
    prompt: `${ICON_STYLE} Numbers 1-2-3 with plus sign, educational feel. Blue-mint pastel colors. White background.`,
  },
  {
    filename: "academy-english.png",
    category: "academy",
    size: "square",
    desc: "영어",
    prompt: `${ICON_STYLE} Small globe with ABC letters floating, international feel. Green-blue pastel colors. White background.`,
  },

  // ───────────────────────────────────────────────
  // 11. 코칭/상담 UI 아이콘 (8)
  // ───────────────────────────────────────────────
  {
    filename: "coach-avatar.png",
    category: "coaching",
    size: "square",
    desc: "AI 코치 아바타",
    prompt: `${CHAR_STYLE} Friendly AI coach character face in a circle, wearing small glasses, warm smile, tiny sparkle near eye. Professional yet cute. Cream background circle.`,
  },
  {
    filename: "icon-camera.png",
    category: "coaching",
    size: "square",
    desc: "카메라 버튼",
    prompt: `${ICON_STYLE} Simple camera icon, rounded friendly design, coral color (#FF8C5A). Clean minimal. White background.`,
  },
  {
    filename: "icon-mic.png",
    category: "coaching",
    size: "square",
    desc: "마이크 버튼",
    prompt: `${ICON_STYLE} Simple microphone icon, rounded friendly design, coral color (#FF8C5A). Clean minimal. White background.`,
  },
  {
    filename: "icon-send.png",
    category: "coaching",
    size: "square",
    desc: "전송 버튼",
    prompt: `${ICON_STYLE} Simple paper airplane send icon, rounded friendly design, coral color (#FF8C5A). Clean minimal. White background.`,
  },
  {
    filename: "badge-ai.png",
    category: "coaching",
    size: "square",
    desc: "AI 출처 배지",
    prompt: `${ICON_STYLE} Small sparkle/star symbol representing AI, golden gradient. Tiny badge shape. White background.`,
  },
  {
    filename: "badge-db.png",
    category: "coaching",
    size: "square",
    desc: "DB 출처 배지",
    prompt: `${ICON_STYLE} Small database cylinder symbol, silver-blue gradient. Tiny badge shape. White background.`,
  },
  {
    filename: "icon-redflag.png",
    category: "coaching",
    size: "square",
    desc: "레드플래그 경고",
    prompt: `${ICON_STYLE} Warning triangle with exclamation mark, red-coral color (#FF4444), rounded corners for child-safe feel. White background.`,
  },
  {
    filename: "icon-hospital.png",
    category: "coaching",
    size: "square",
    desc: "진료 안내",
    prompt: `${ICON_STYLE} Small hospital building with medical cross, friendly design, blue-white colors. Rounded shape. White background.`,
  },

  // ───────────────────────────────────────────────
  // 12. 프로필/설정 아이콘 (8)
  // ───────────────────────────────────────────────
  {
    filename: "avatar-boy.png",
    category: "profile",
    size: "square",
    desc: "남아 기본 아바타",
    prompt: `${CHAR_STYLE} Cute boy toddler face portrait in circle, short hair, big bright eyes, rosy cheeks, gentle smile. Blue accent color. Cream circle background.`,
  },
  {
    filename: "avatar-girl.png",
    category: "profile",
    size: "square",
    desc: "여아 기본 아바타",
    prompt: `${CHAR_STYLE} Cute girl toddler face portrait in circle, pigtails/bow, big bright eyes, rosy cheeks, gentle smile. Pink accent color. Cream circle background.`,
  },
  {
    filename: "icon-settings.png",
    category: "profile",
    size: "square",
    desc: "설정",
    prompt: `${ICON_STYLE} Simple gear/cog icon, rounded friendly design, warm grey color. Clean minimal. White background.`,
  },
  {
    filename: "icon-bell.png",
    category: "profile",
    size: "square",
    desc: "알림",
    prompt: `${ICON_STYLE} Simple bell icon with small dot notification, rounded friendly design, golden-coral color. White background.`,
  },
  {
    filename: "icon-lock.png",
    category: "profile",
    size: "square",
    desc: "비공개",
    prompt: `${ICON_STYLE} Simple padlock icon, rounded friendly design, grey-blue color. Clean minimal. White background.`,
  },
  {
    filename: "icon-heart.png",
    category: "profile",
    size: "square",
    desc: "좋아요",
    prompt: `${ICON_STYLE} Simple heart icon, rounded friendly design, coral-red gradient (#FF6B6B). Clean minimal. White background.`,
  },
  {
    filename: "icon-comment.png",
    category: "profile",
    size: "square",
    desc: "댓글",
    prompt: `${ICON_STYLE} Simple speech bubble icon, rounded friendly design, mint-teal color (#4ECDC4). Clean minimal. White background.`,
  },
  {
    filename: "icon-share.png",
    category: "profile",
    size: "square",
    desc: "공유",
    prompt: `${ICON_STYLE} Simple share/forward arrow icon, rounded friendly design, blue-coral color. Clean minimal. White background.`,
  },

  // ───────────────────────────────────────────────
  // 13. 특별 기능 일러스트 (12)
  // ───────────────────────────────────────────────
  {
    filename: "feature-yearago.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "1년 전 오늘",
    prompt: `${BASE_STYLE} Nostalgic retro polaroid photo frame with heart bookmark, small calendar showing "1 year", golden warm light, film grain effect. Vintage warm cream background.`,
  },
  {
    filename: "feature-childcard.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "아이 디지털 카드",
    prompt: `${BASE_STYLE} Beautiful premium passport-style card design, golden foil border, navy and cream colors, small star seal emblem. Elegant card floating at angle with soft shadow.`,
  },
  {
    filename: "feature-weekly.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "주간 리포트",
    prompt: `${BASE_STYLE} Weekly report layout with colorful bar charts, small trophy icon, growth arrow, sparkles and stars. Data visualization meets cute illustration. Cream background.`,
  },
  {
    filename: "feature-milestone.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "성장 마일스톤",
    prompt: `${BASE_STYLE} Ascending staircase of achievement with small flags at each step, stars at the top, a small character climbing. Journey of growth. Golden-cream background.`,
  },
  {
    filename: "feature-diary-ai.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "AI 육아일기",
    prompt: `${BASE_STYLE} Magic pen writing automatically on a diary page, AI sparkles flowing from the pen tip, small stars and hearts forming words. Purple-cream magical atmosphere.`,
  },
  {
    filename: "feature-mental.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "부모 멘탈 케어",
    prompt: `${BASE_STYLE} Peaceful meditation scene, gentle heart floating with butterfly and flowers, calming aura. Self-care and wellness atmosphere. Lavender-cream background.`,
  },
  {
    filename: "feature-predict.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "미래 예측",
    prompt: `${BASE_STYLE} Crystal ball showing a child silhouette growing up, magical sparkles and constellation lines. Future vision atmosphere. Deep blue-purple to cream gradient.`,
  },
  {
    filename: "feature-clinic.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "소아과 후기",
    prompt: `${BASE_STYLE} Friendly pediatric clinic exterior, colorful awning, small star rating badges, parent and child walking toward entrance. Warm inviting atmosphere. Soft mint background.`,
  },
  {
    filename: "baby-tracker-bg.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "베이비트래커 헤더",
    prompt: `${BASE_STYLE} Dreamy clouds with cute baby sleeping on a cloud, small icons of bottle, diaper, and moon floating around. Gentle tracking atmosphere. Soft blue-cream gradient.`,
  },
  {
    filename: "feature-timer.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "놀이 타이머",
    prompt: `${BASE_STYLE} Cute hourglass/timer with sparkles, parent and child playing together inside the timer shape. Quality time concept. Warm golden-cream background.`,
  },
  {
    filename: "feature-community.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "커뮤니티",
    prompt: `${BASE_STYLE} Group of cute parent characters chatting in a circle, speech bubbles with hearts, cozy community gathering. Warm social atmosphere. Peach-cream background.`,
  },
  {
    filename: "feature-growth.png",
    category: "feature",
    size: "landscape_4_3",
    desc: "성장 분석",
    prompt: `${BASE_STYLE} Growth chart with height measurement ruler, cute baby character standing tall, upward arrow with stars. Scientific yet adorable. Mint-cream background.`,
  },

  // ───────────────────────────────────────────────
  // 14. 구독/프리미엄 (2) - 브랜드 로고 제외
  // ───────────────────────────────────────────────
  {
    filename: "premium-badge.png",
    category: "premium",
    size: "square",
    desc: "프리미엄 뱃지",
    prompt: `${ICON_STYLE} Luxurious golden crown with star on top, sparkling, premium quality feel. Gold gradient (#D4AF37 to #FFD700). Transparent/white background.`,
  },
  {
    filename: "premium-hero.png",
    category: "premium",
    size: "landscape_4_3",
    desc: "구독 화면 히어로",
    prompt: `${CHAR_STYLE} Mascot character wearing golden crown, surrounded by premium sparkles and stars, VIP carpet feeling. Luxurious but cute. Deep navy-gold background.`,
  },

  // ───────────────────────────────────────────────
  // 15. 감정/기분 (3)
  // ───────────────────────────────────────────────
  {
    filename: "mood-good.png",
    category: "mood",
    size: "square",
    desc: "좋아요 기분",
    prompt: `${ICON_STYLE} Happy smiling sun face, bright and cheerful, warm golden-yellow color. Kawaii style with rosy cheeks. White background.`,
  },
  {
    filename: "mood-normal.png",
    category: "mood",
    size: "square",
    desc: "보통 기분",
    prompt: `${ICON_STYLE} Calm peaceful cloud face, neutral gentle expression, soft grey-white color. Kawaii style. White background.`,
  },
  {
    filename: "mood-bad.png",
    category: "mood",
    size: "square",
    desc: "안좋아요 기분",
    prompt: `${ICON_STYLE} Rainy cloud face with small tear drop, sad but still adorable expression, blue-grey color. Kawaii style. White background.`,
  },

  // ───────────────────────────────────────────────
  // 16. 분석기 에셋 (6)
  // ───────────────────────────────────────────────
  {
    filename: "analyzer-cry-bg.png",
    category: "analyzer",
    size: "landscape_4_3",
    desc: "울음 분석기 배경",
    prompt: `${BASE_STYLE} Sound wave visualization in soft pastel colors, gentle curves representing baby sounds. Calm analytical atmosphere. Soft blue-peach gradient background.`,
  },
  {
    filename: "analyzer-poop-bg.png",
    category: "analyzer",
    size: "landscape_4_3",
    desc: "대변 분석기 배경",
    prompt: `${BASE_STYLE} Clean medical/health analysis theme, magnifying glass with sparkle, health check motif. Clinical yet friendly. Soft green-cream gradient background.`,
  },
  {
    filename: "analyzer-cry-result.png",
    category: "analyzer",
    size: "square",
    desc: "울음 분석 결과",
    prompt: `${CHAR_STYLE} Baby mascot with different emotion indicators around (hungry, sleepy, uncomfortable), diagnostic chart style but cute. Pastel rainbow indicators. Cream background.`,
  },
  {
    filename: "analyzer-poop-result.png",
    category: "analyzer",
    size: "square",
    desc: "대변 분석 결과",
    prompt: `${CHAR_STYLE} Cute mascot doctor character with clipboard and magnifying glass, health check complete, green checkmark. Clean clinical but adorable. Mint-cream background.`,
  },
  {
    filename: "analyzer-recording.png",
    category: "analyzer",
    size: "square",
    desc: "녹음 중 일러스트",
    prompt: `${BASE_STYLE} Cute microphone with pulsing sound waves, recording indicator dot, gentle audio visualization. Tech-cute style. Purple-blue pastel background.`,
  },
  {
    filename: "analyzer-photo.png",
    category: "analyzer",
    size: "square",
    desc: "사진 촬영 일러스트",
    prompt: `${BASE_STYLE} Cute camera with flash sparkle, photo frame coming out, analysis magnifying glass overlay. Tech-cute style. Green-cream pastel background.`,
  },

  // ───────────────────────────────────────────────
  // 17. 성장/발달 에셋 (4)
  // ───────────────────────────────────────────────
  {
    filename: "growth-physical.png",
    category: "growth",
    size: "square",
    desc: "신체 발달",
    prompt: `${ICON_STYLE} Running baby figure with motion lines, physical activity symbol. Orange-coral color. Rounded energetic design. White background.`,
  },
  {
    filename: "growth-cognitive.png",
    category: "growth",
    size: "square",
    desc: "인지 발달",
    prompt: `${ICON_STYLE} Brain with lightbulb and sparkle, cognitive development symbol. Purple color. Rounded friendly design. White background.`,
  },
  {
    filename: "growth-language.png",
    category: "growth",
    size: "square",
    desc: "언어 발달",
    prompt: `${ICON_STYLE} Speech bubble with sound waves, language development symbol. Blue-teal color. Rounded friendly design. White background.`,
  },
  {
    filename: "growth-social.png",
    category: "growth",
    size: "square",
    desc: "사회성 발달",
    prompt: `${ICON_STYLE} Two small figures with heart between them, social development symbol. Pink-coral color. Rounded friendly design. White background.`,
  },

  // ───────────────────────────────────────────────
  // 18. 고객지원 에셋 (3)
  // ───────────────────────────────────────────────
  {
    filename: "support-bg.png",
    category: "support",
    size: "landscape_4_3",
    desc: "고객지원 헤더",
    prompt: `${BASE_STYLE} Friendly help desk scene, small mascot character with headset, question marks turning into sparkly answers. Supportive warm atmosphere. Blue-cream background.`,
  },
  {
    filename: "support-faq.png",
    category: "support",
    size: "square",
    desc: "FAQ 아이콘",
    prompt: `${ICON_STYLE} Question mark inside a speech bubble with small sparkle, friendly helpful feel. Coral-mint colors. White background.`,
  },
  {
    filename: "support-inquiry.png",
    category: "support",
    size: "square",
    desc: "문의하기 아이콘",
    prompt: `${ICON_STYLE} Envelope with small pen, writing inquiry concept. Blue-coral colors. Rounded friendly design. White background.`,
  },

  // ───────────────────────────────────────────────
  // 19. 놀이/학습 에셋 (3)
  // ───────────────────────────────────────────────
  {
    filename: "play-learning-bg.png",
    category: "play",
    size: "landscape_4_3",
    desc: "놀이학습 헤더",
    prompt: `${BASE_STYLE} Colorful playroom scene with building blocks, musical instruments, art supplies, and books scattered playfully. Creative learning atmosphere. Warm cream-rainbow background.`,
  },
  {
    filename: "play-activity.png",
    category: "play",
    size: "square",
    desc: "활동 카드 아이콘",
    prompt: `${CHAR_STYLE} Toddler character playing with colorful building blocks, focused and happy, creative construction. Playful primary colors. Cream background.`,
  },
  {
    filename: "play-complete.png",
    category: "play",
    size: "square",
    desc: "활동 완료",
    prompt: `${CHAR_STYLE} Mascot character with gold star sticker on chest, proud accomplished expression, small fireworks. Achievement atmosphere. Golden-cream background.`,
  },

  // ───────────────────────────────────────────────
  // 20. 여권 공유 배경 (바이럴 마케팅용) (3)
  // ───────────────────────────────────────────────
  {
    filename: "passport-bg-dreamy.png",
    category: "passport",
    size: "portrait_4_3",
    desc: "여권 공유 배경 (몽환)",
    prompt: `Luxurious premium background for a child passport card. Soft dreamy bokeh lights in warm gold and cream tones. Subtle scattered stars and gentle clouds. Elegant warm atmosphere, like a precious memory. No characters or text. Portrait orientation.`,
  },
  {
    filename: "passport-bg-galaxy.png",
    category: "passport",
    size: "portrait_4_3",
    desc: "여권 공유 배경 (은하수)",
    prompt: `Magical galaxy-themed background for a child passport card. Soft pastel purple-blue nebula with golden star dust. Dreamy cosmic atmosphere but warm and child-friendly. Subtle constellation lines. No characters or text. Portrait orientation.`,
  },
  {
    filename: "passport-bg-nature.png",
    category: "passport",
    size: "portrait_4_3",
    desc: "여권 공유 배경 (자연)",
    prompt: `Gentle nature-themed background for a child passport card. Soft watercolor cherry blossoms falling, warm golden sunlight rays, dreamy spring atmosphere. Warm pink-cream-gold palette. No characters or text. Portrait orientation.`,
  },

  // ───────────────────────────────────────────────
  // 21. 추가 퀵액션 아이콘 (5)
  // ───────────────────────────────────────────────
  {
    filename: "quick-sleep.png",
    category: "quick",
    size: "square",
    desc: "수면예측 퀵버튼",
    prompt: `${ICON_STYLE} Cute crescent moon with tiny stars and soft cloud, sleep prediction concept. Soft purple-blue pastel colors. Rounded friendly shape. White background.`,
  },
  {
    filename: "quick-lullaby.png",
    category: "quick",
    size: "square",
    desc: "자장가 퀵버튼",
    prompt: `${ICON_STYLE} Musical note floating from a small cloud pillow, lullaby/white noise concept. Soft lavender and cream pastel colors. Rounded friendly shape. White background.`,
  },
  {
    filename: "quick-parent-level.png",
    category: "quick",
    size: "square",
    desc: "부모레벨 퀵버튼",
    prompt: `${ICON_STYLE} Small trophy cup with growing seedling inside, parent achievement/level concept. Warm golden and green pastel colors. Rounded friendly shape. White background.`,
  },
  {
    filename: "quick-timeline.png",
    category: "quick",
    size: "square",
    desc: "타임라인 퀵버튼",
    prompt: `${ICON_STYLE} Vertical timeline path with small milestone dots and flag at top, growth journey concept. Coral and mint pastel colors. Rounded friendly shape. White background.`,
  },
  {
    filename: "quick-coparenting.png",
    category: "quick",
    size: "square",
    desc: "공동육아 퀵버튼",
    prompt: `${ICON_STYLE} Two parent figures with small heart and baby between them, co-parenting family concept. Warm peach and coral pastel colors. Rounded friendly shape. White background.`,
  },

  // ───────────────────────────────────────────────
  // 22. 마일스톤 아이콘 (8)
  // ───────────────────────────────────────────────
  {
    filename: "milestone-body.png",
    category: "milestone",
    size: "square",
    desc: "신체발달 마일스톤",
    prompt: `${ICON_STYLE} Cute baby figure stretching arms up, physical growth symbol. Warm orange-coral color. Soft 3D rounded design. White background.`,
  },
  {
    filename: "milestone-brain.png",
    category: "milestone",
    size: "square",
    desc: "인지발달 마일스톤",
    prompt: `${ICON_STYLE} Cute small brain with lightbulb and sparkle above, cognitive development symbol. Soft purple-pink color. 3D rounded design. White background.`,
  },
  {
    filename: "milestone-eye.png",
    category: "milestone",
    size: "square",
    desc: "시각발달 마일스톤",
    prompt: `${ICON_STYLE} Cute friendly eye with sparkle, visual perception symbol. Soft teal-blue color. 3D rounded design. White background.`,
  },
  {
    filename: "milestone-food.png",
    category: "milestone",
    size: "square",
    desc: "이유식 마일스톤",
    prompt: `${ICON_STYLE} Cute baby spoon with small bowl and steam heart, first food milestone symbol. Warm orange-yellow color. 3D rounded design. White background.`,
  },
  {
    filename: "milestone-hand.png",
    category: "milestone",
    size: "square",
    desc: "소근육 마일스톤",
    prompt: `${ICON_STYLE} Cute small hand grasping a star, fine motor skill symbol. Soft peach-coral color. 3D rounded design. White background.`,
  },
  {
    filename: "milestone-heart.png",
    category: "milestone",
    size: "square",
    desc: "정서발달 마일스톤",
    prompt: `${ICON_STYLE} Cute heart with small smile face, emotional development symbol. Soft pink-coral color. 3D rounded design. White background.`,
  },
  {
    filename: "milestone-star.png",
    category: "milestone",
    size: "square",
    desc: "특별 마일스톤",
    prompt: `${ICON_STYLE} Shining golden star with small sparkles around, special achievement milestone. Warm golden-yellow color. 3D rounded design. White background.`,
  },
  {
    filename: "milestone-talk.png",
    category: "milestone",
    size: "square",
    desc: "언어발달 마일스톤",
    prompt: `${ICON_STYLE} Cute speech bubble with small sound waves, language development symbol. Soft blue-mint color. 3D rounded design. White background.`,
  },
];

/* ═══════════════════════════════════════════════════════
   유틸리티
   ═══════════════════════════════════════════════════════ */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
}

/* ═══════════════════════════════════════════════════════
   메인 생성 함수
   ═══════════════════════════════════════════════════════ */

async function generateOne(asset, index, total) {
  const filePath = path.join(ASSETS_DIR, asset.filename);

  // 이미 존재하면 스킵 (--overwrite 없을 때)
  if (!OVERWRITE && fs.existsSync(filePath)) {
    console.log(`⏭️  [${index + 1}/${total}] ${asset.filename} (이미 존재, 스킵)`);
    return;
  }

  if (DRY_RUN) {
    console.log(`🔍 [${index + 1}/${total}] ${asset.filename}`);
    console.log(`   카테고리: ${asset.category}`);
    console.log(`   사이즈: ${asset.size}`);
    console.log(`   프롬프트: ${asset.prompt.slice(0, 120)}...`);
    console.log();
    return;
  }

  try {
    const result = await fal.subscribe(MODEL, {
      input: {
        prompt: asset.prompt,
        image_size: asset.size,
        num_images: 1,
        output_format: "png",
        num_inference_steps: MODEL_CHOICE === "schnell" ? 4 : 28,
      },
    });

    const imageUrl = result.data.images[0].url;
    await downloadFile(imageUrl, filePath);
    console.log(`✅ [${index + 1}/${total}] ${asset.filename} (${asset.desc})`);
  } catch (err) {
    console.error(`❌ [${index + 1}/${total}] ${asset.filename}: ${err.message}`);
  }
}

async function main() {
  // FAL_KEY 확인
  if (!DRY_RUN && !process.env.FAL_KEY) {
    console.error("❌ FAL_KEY 환경변수가 설정되지 않았습니다.");
    console.error("   FAL_KEY=fal-xxxxx node scripts/generate-assets.mjs");
    console.error("   fal.ai 대시보드에서 API 키를 발급받으세요: https://fal.ai/dashboard/keys");
    process.exit(1);
  }

  if (!DRY_RUN) {
    fal.config({ credentials: process.env.FAL_KEY });
  }

  // 에셋 디렉토리 확인
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  // 카테고리 필터
  const filtered = FILTER_CAT
    ? ASSETS.filter((a) => a.category === FILTER_CAT)
    : ASSETS;

  if (filtered.length === 0) {
    console.error(`❌ 카테고리 '${FILTER_CAT}' 에셋 없음.`);
    console.log("사용 가능한 카테고리:");
    const cats = [...new Set(ASSETS.map((a) => a.category))];
    cats.forEach((c) => {
      const count = ASSETS.filter((a) => a.category === c).length;
      console.log(`  --category=${c}  (${count}개)`);
    });
    process.exit(1);
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   아맞다 에셋 자동 생성 (fal.ai FLUX)   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log();
  console.log(`  모델: ${MODEL}`);
  console.log(`  총 에셋: ${filtered.length}개`);
  console.log(`  저장 경로: ${ASSETS_DIR}`);
  console.log(`  덮어쓰기: ${OVERWRITE ? "예" : "아니오 (기존 파일 스킵)"}`);
  if (FILTER_CAT) console.log(`  카테고리 필터: ${FILTER_CAT}`);
  console.log();

  if (DRY_RUN) {
    console.log("── DRY RUN 모드 (이미지 생성 안 함) ──\n");
  }

  // 카테고리별 요약
  const catSummary = {};
  filtered.forEach((a) => {
    catSummary[a.category] = (catSummary[a.category] || 0) + 1;
  });
  console.log("카테고리별 에셋 수:");
  Object.entries(catSummary).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}개`);
  });
  console.log();

  // 배치 실행
  const total = filtered.length;
  let done = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((asset, j) => generateOne(asset, i + j, total))
    );
    done += batch.length;

    if (!DRY_RUN && i + BATCH_SIZE < total) {
      const pct = Math.round((done / total) * 100);
      console.log(`\n── 진행률: ${done}/${total} (${pct}%) ──\n`);
      await sleep(DELAY_MS);
    }
  }

  console.log();
  console.log("═══════════════════════════════════════════");
  console.log(`  완료! ${total}개 에셋 처리됨`);
  if (!DRY_RUN) {
    console.log(`  저장 위치: ${ASSETS_DIR}`);
  }
  console.log("═══════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
