/**
 * DALL-E 3 에셋 일괄 생성 스크립트
 * 실행: OPENAI_API_KEY=sk-xxx node scripts/generate-assets-dalle.cjs
 *
 * 마스터 스타일 프롬프트를 모든 에셋에 공통 적용하여 스타일 통일
 */
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('OPENAI_API_KEY 환경변수를 설정해주세요.');
  console.error('사용법: OPENAI_API_KEY=sk-xxx node scripts/generate-assets-dalle.cjs [category]');
  console.error('카테고리: passport / mascot / feature / onboarding / trait / empty / quick / category / tab / icon / analyzer / weather / mood / premium / academy');
  process.exit(1);
}

const MODEL = 'gpt-image-1';
const URL = 'https://api.openai.com/v1/images/generations';
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'assets');

/* ── 마스터 스타일 프롬프트 (모든 에셋에 공통 적용) ── */
const MASTER_STYLE = `3D clay-render style, soft matte clay texture, warm pastel color palette (cream, peach, mint, soft pink), rounded smooth shapes, professional studio lighting with very soft diffused shadows, clean cream-white background (#FAFAFA), cute Korean baby app aesthetic, extremely high detail and polish, Pixar-quality rendering, clean centered composition, no text or watermarks, 1024x1024`;

/* ── 카테고리별 에셋 정의 ── */
const ASSETS = {
  passport: [
    { file: 'passport-outer-bg.png', prompt: 'A premium passport cover design for a baby growth diary app. Elegant embossed leather-like texture in soft navy blue with gold foil accents, a cute small teddy bear emblem in the center, decorative border pattern with tiny stars and moons, luxurious and high-end stationery feel' },
    { file: 'passport-inner-bg.png', prompt: 'An inner page background for a baby passport/diary. Soft cream parchment texture with very subtle watermark pattern of tiny footprints, delicate border design with soft gold lines, elegant certificate-style layout background, clean and premium' },
    { file: 'passport-bg-dreamy.png', prompt: 'A dreamy fantasy background for a baby passport page. Soft pastel clouds, gentle rainbow arcs, tiny floating stars and sparkles, moonlit sky with aurora borealis in soft pink and purple, magical fairy tale atmosphere' },
    { file: 'passport-bg-galaxy.png', prompt: 'A cute galaxy/space themed background for a baby passport page. Soft pastel-colored planets, tiny cute stars with faces, gentle nebula clouds in lavender and mint, a smiling crescent moon, whimsical and child-friendly outer space' },
    { file: 'passport-bg-nature.png', prompt: 'A nature themed background for a baby passport page. Soft rolling green hills, tiny wildflowers in pastel colors, gentle butterflies, a warm golden sunrise, fluffy white clouds, peaceful meadow scene, Studio Ghibli-inspired softness' },
    { file: 'passport-emblem.png', prompt: 'A premium emblem/seal design for a baby diary app called "Amatda". Circular badge shape with laurel wreath border, a cute baby footprint in the center, ribbon banner below, gold and cream colors, official certificate seal aesthetic, transparent background concept rendered on white' },
    { file: 'passport-stamp-amatda.png', prompt: 'A decorative rubber stamp design for a baby milestone diary. Circular stamp with scalloped edges, says milestone achievement inside, cute star decorations, ink stamp texture in coral/salmon color, vintage postal stamp aesthetic' },
  ],

  mascot: [
    { file: 'mascot-happy.png', prompt: 'A cute 3D clay baby character mascot, standing pose with both arms raised in celebration, big happy smile with rosy cheeks, short brown hair, wearing a mint green onesie with a small bunny logo, bright joyful expression' },
    { file: 'mascot-waving.png', prompt: 'A cute 3D clay baby character mascot, standing pose waving one hand hello, friendly welcoming smile with rosy cheeks, short brown hair, wearing a mint green onesie with a small bunny logo, warm greeting gesture' },
    { file: 'mascot-thinking.png', prompt: 'A cute 3D clay baby character mascot, sitting pose with one finger on chin thinking deeply, curious expression with slightly tilted head, short brown hair, wearing a mint green onesie with a small bunny logo, contemplative mood' },
    { file: 'mascot-worried.png', prompt: 'A cute 3D clay baby character mascot, sitting pose looking slightly worried/concerned, gentle frown with big round eyes, short brown hair, wearing a mint green onesie with a small bunny logo, sympathetic concerned expression' },
    { file: 'mascot-sleeping.png', prompt: 'A cute 3D clay baby character mascot, lying down sleeping peacefully with a tiny pillow, eyes closed with content smile, small Zzz floating above, short brown hair, wearing a mint green onesie with a small bunny logo' },
    { file: 'mascot-eating.png', prompt: 'A cute 3D clay baby character mascot, sitting in a high chair holding a small spoon, happy eating expression with mouth open, a cute bowl of food in front, short brown hair, wearing a mint green onesie with bib' },
    { file: 'mascot-reading.png', prompt: 'A cute 3D clay baby character mascot, sitting cross-legged holding a small open book, focused reading expression with slight smile, short brown hair, wearing a mint green onesie with a small bunny logo, cozy learning mood' },
    { file: 'mascot-doctor.png', prompt: 'A cute 3D clay baby character mascot, standing pose wearing a tiny white doctor coat over mint green onesie, holding a small stethoscope, professional but adorable expression, short brown hair, helpful caring mood' },
  ],

  feature: [
    { file: 'feature-childcard.png', prompt: 'An illustration for a "Child Profile Card" feature. A cute baby sitting next to a large ID card with photo and stats, growth chart in background, measuring tape and scale nearby, achievement badges floating around' },
    { file: 'feature-clinic.png', prompt: 'An illustration for a "Nearby Clinic Finder" feature. A cute baby sitting on a cushion with a phone showing a map, small clinic buildings around with crosses, location pin markers, warm welcoming medical scene' },
    { file: 'feature-community.png', prompt: 'An illustration for a "Parent Community" feature. Three cute babies sitting in a circle having a playdate, speech bubbles with hearts above, toys scattered around, warm social gathering atmosphere' },
    { file: 'feature-diary-ai.png', prompt: 'An illustration for an "AI Diary" feature. A cute baby sitting at a desk with an open diary, a small robot assistant helping write, sparkles and light effects around the diary, magical AI-assisted journaling' },
    { file: 'feature-growth.png', prompt: 'An illustration for a "Growth Tracking" feature. A cute baby standing next to a height measurement ruler on a wall, growth chart graph floating nearby, small milestone stars and ribbons' },
    { file: 'feature-mental.png', prompt: 'An illustration for a "Temperament Analysis" feature. A cute baby surrounded by floating personality trait icons (heart, star, brain, music note), gentle aura glow around the baby, personality discovery theme' },
    { file: 'feature-milestone.png', prompt: 'An illustration for a "Milestone Tracking" feature. A cute baby taking first steps with footprints trail behind, trophy and ribbon floating above, celebration confetti, achievement unlocked theme' },
    { file: 'feature-predict.png', prompt: 'An illustration for a "Sleep Prediction" feature. A cute baby on a cloud with a clock and moon, small sheep jumping over, sleep pattern graph floating nearby, dreamy nighttime prediction theme' },
    { file: 'feature-timer.png', prompt: 'An illustration for a "Activity Timer" feature. A cute baby next to a large friendly hourglass/timer, small activity icons around (bottle, diaper, nap), time tracking and routine theme' },
    { file: 'feature-weekly.png', prompt: 'An illustration for a "Weekly Report" feature. A cute baby sitting on a stack of report cards, bar charts and pie charts floating around, gold star sticker, weekly summary and analysis theme' },
    { file: 'feature-yearago.png', prompt: 'An illustration for a "Year Ago Today" feature. A cute baby looking at a photo album with a small baby version of themselves, calendar showing one year difference, nostalgic warm memory theme' },
  ],

  onboarding: [
    { file: 'onboarding-welcome.png', prompt: 'A welcome illustration for a baby app onboarding. A cute 3D clay baby waving hello standing on a soft cloud, warm golden light rays behind, tiny stars and hearts floating, first impression welcoming scene, warm and inviting' },
    { file: 'onboarding-profile.png', prompt: 'A profile setup illustration for baby app onboarding. A cute 3D clay baby sitting next to a large form/card being filled out, pencil writing name, calendar showing birth date, gender icons, profile creation theme' },
    { file: 'onboarding-survey.png', prompt: 'A survey/questionnaire illustration for baby app onboarding. A cute 3D clay baby looking at floating question cards with checkboxes, clipboard with checklist, personality quiz discovery theme' },
    { file: 'onboarding-complete.png', prompt: 'A completion/success illustration for baby app onboarding. A cute 3D clay baby celebrating with confetti, large green checkmark behind, trophy and star, setup complete celebration, ready to start the journey' },
    { file: 'onboarding-bg.png', prompt: 'A subtle background pattern for baby app onboarding screens. Very light cream background with barely visible tiny icons pattern (bottles, stars, hearts, moons, teddy bears) repeated, minimal and clean, not distracting' },
  ],

  trait: [
    { file: 'trait-active.png', prompt: 'A full illustration representing "Active/Energetic" child temperament. A cute 3D clay baby jumping energetically with arms spread wide, lightning bolt and star energy effects, dynamic movement lines, vibrant orange/coral color accent, 1024x1024' },
    { file: 'trait-analyst.png', prompt: 'A full illustration representing "Analytical/Thinking" child temperament. A cute 3D clay baby sitting with a magnifying glass examining a puzzle piece, gears and lightbulb floating above, focused curious expression, blue/indigo color accent, 1024x1024' },
    { file: 'trait-explorer.png', prompt: 'A full illustration representing "Explorer/Curious" child temperament. A cute 3D clay baby with a tiny explorer hat looking through binoculars, compass and map nearby, adventure and discovery theme, green/teal color accent, 1024x1024' },
    { file: 'trait-harmony.png', prompt: 'A full illustration representing "Harmonious/Social" child temperament. A cute 3D clay baby gently hugging a stuffed animal, hearts and music notes floating, peaceful calm expression, warm social connection, pink/rose color accent, 1024x1024' },
    { file: 'trait-sensitive.png', prompt: 'A full illustration representing "Sensitive/Perceptive" child temperament. A cute 3D clay baby sitting quietly looking at a butterfly on their finger, gentle flowers blooming around, delicate and observant mood, purple/lavender color accent, 1024x1024' },
    { file: 'trait-active-small.png', prompt: 'A small icon representing "Active" temperament. A simple 3D clay baby face with excited expression, tiny lightning bolt, vibrant and energetic, icon size 256x256, clean edges' },
    { file: 'trait-analyst-small.png', prompt: 'A small icon representing "Analyst" temperament. A simple 3D clay baby face with curious thoughtful expression, tiny magnifying glass, calm and focused, icon size 256x256, clean edges' },
    { file: 'trait-explorer-small.png', prompt: 'A small icon representing "Explorer" temperament. A simple 3D clay baby face with adventurous excited expression, tiny compass, discovery mood, icon size 256x256, clean edges' },
    { file: 'trait-harmony-small.png', prompt: 'A small icon representing "Harmony" temperament. A simple 3D clay baby face with gentle peaceful smile, tiny heart, warm and social, icon size 256x256, clean edges' },
    { file: 'trait-sensitive-small.png', prompt: 'A small icon representing "Sensitive" temperament. A simple 3D clay baby face with gentle observant expression, tiny butterfly, delicate and perceptive, icon size 256x256, clean edges' },
  ],

  empty: [
    { file: 'empty-album.png', prompt: 'An empty state illustration for a photo album. A cute 3D clay baby looking at an empty photo frame with a camera nearby, dotted outline where photos would go, encouraging first photo upload, warm and inviting' },
    { file: 'empty-chat.png', prompt: 'An empty state illustration for a chat/counseling screen. A cute 3D clay baby looking up at empty speech bubbles, friendly chat bot character nearby waving, encouraging first conversation, warm and approachable' },
    { file: 'empty-clinic.png', prompt: 'An empty state illustration for a clinic finder. A cute 3D clay baby looking at an empty map, small compass spinning, location pin with question mark, encouraging location sharing, helpful and guiding' },
    { file: 'empty-diary.png', prompt: 'An empty state illustration for a daily diary. A cute 3D clay baby sitting with an open blank notebook and pencil, clean pages with dotted lines, encouraging first diary entry, warm and creative' },
    { file: 'empty-momsta.png', prompt: 'An empty state illustration for a family feed/social. A cute 3D clay baby looking at an empty photo grid, camera and heart icons floating, encouraging sharing moments, warm community feel' },
    { file: 'empty-timeline.png', prompt: 'An empty state illustration for a timeline. A cute 3D clay baby standing at the start of a dotted path/road stretching into the distance, milestone flags along the path, journey beginning theme' },
  ],

  quick: [
    { file: 'quick-learning.png', prompt: 'A small icon for "Learning/Record" feature. A cute mini 3D clay notebook with pencil, simple and clean, icon style, 256x256' },
    { file: 'quick-report.png', prompt: 'A small icon for "Report/Stats" feature. A cute mini 3D clay bar chart with upward arrow, simple and clean, icon style, 256x256' },
    { file: 'quick-timeline.png', prompt: 'A small icon for "Timeline/Album" feature. A cute mini 3D clay photo album with a heart, simple and clean, icon style, 256x256' },
    { file: 'quick-lullaby.png', prompt: 'A small icon for "Lullaby/Music" feature. A cute mini 3D clay music note with moon, simple and clean, icon style, 256x256' },
    { file: 'quick-sleep.png', prompt: 'A small icon for "Sleep" feature. A cute mini 3D clay crescent moon with Zzz, simple and clean, icon style, 256x256' },
    { file: 'quick-coparenting.png', prompt: 'A small icon for "Co-parenting" feature. Two cute mini 3D clay parent figures holding a heart together, simple and clean, icon style, 256x256' },
    { file: 'quick-parent-level.png', prompt: 'A small icon for "Parent Level" feature. A cute mini 3D clay sprout/seedling growing from soil, simple and clean, icon style, 256x256' },
    { file: 'quick-diary.png', prompt: 'A small icon for "Diary" feature. A cute mini 3D clay open diary with a star, simple and clean, icon style, 256x256' },
    { file: 'quick-trait.png', prompt: 'A small icon for "Temperament/Trait" feature. A cute mini 3D clay crystal ball with sparkles, simple and clean, icon style, 256x256' },
  ],

  category: [
    { file: 'cat-eating.png', prompt: 'A small icon for "Eating/Food" category. A cute mini 3D clay baby bottle and spoon with a small bowl, simple and clean, warm colors, icon style, 256x256' },
    { file: 'cat-growth.png', prompt: 'A small icon for "Growth" category. A cute mini 3D clay height ruler with upward arrow and star, simple and clean, green tones, icon style, 256x256' },
    { file: 'cat-social.png', prompt: 'A small icon for "Social/Education" category. A cute mini 3D clay ABC blocks with graduation cap, simple and clean, blue/purple tones, icon style, 256x256' },
    { file: 'cat-sleep.png', prompt: 'A small icon for "Sleep" category. A cute mini 3D clay pillow with crescent moon and stars, simple and clean, soft purple tones, icon style, 256x256' },
    { file: 'cat-poop.png', prompt: 'A small icon for "Poop/Diaper" category. A cute mini 3D clay diaper with a sparkle, simple and clean, green tones, icon style, 256x256' },
    { file: 'cat-crying.png', prompt: 'A small icon for "Crying" category. A cute mini 3D clay teardrop with a baby face, simple and clean, blue tones, icon style, 256x256' },
    { file: 'cat-behavior.png', prompt: 'A small icon for "Behavior" category. A cute mini 3D clay baby hand reaching for a toy, simple and clean, warm tones, icon style, 256x256' },
    { file: 'cat-etc.png', prompt: 'A small icon for "Other/Miscellaneous" category. A cute mini 3D clay toolbox with various small items, simple and clean, neutral tones, icon style, 256x256' },
  ],

  growth: [
    { file: 'growth-cognitive.png', prompt: 'A small icon for "Cognitive Development". A cute mini 3D clay brain with lightbulb above it, glowing warmly, simple and clean, icon style, 256x256' },
    { file: 'growth-language.png', prompt: 'A small icon for "Language Development". A cute mini 3D clay speech bubble with ABC letters inside, simple and clean, icon style, 256x256' },
    { file: 'growth-physical.png', prompt: 'A small icon for "Physical Development". A cute mini 3D clay flexing arm with a star, strong and growing, simple and clean, icon style, 256x256' },
    { file: 'growth-social.png', prompt: 'A small icon for "Social Development". Two cute mini 3D clay faces smiling at each other with heart between, simple and clean, icon style, 256x256' },
  ],

  weather: [
    { file: 'weather-sunny.png', prompt: 'A small weather icon for "Sunny/Happy mood". A cute 3D clay smiling sun with gentle rays, warm golden glow, simple and clean, icon style, 256x256' },
    { file: 'weather-cloudy.png', prompt: 'A small weather icon for "Cloudy/Neutral mood". A cute 3D clay fluffy cloud with a gentle face, soft gray and white, simple and clean, icon style, 256x256' },
    { file: 'weather-rainy.png', prompt: 'A small weather icon for "Rainy/Sad mood". A cute 3D clay cloud with gentle raindrops, slightly sad but gentle expression, blue tones, simple and clean, icon style, 256x256' },
    { file: 'weather-snowy.png', prompt: 'A small weather icon for "Snowy/Calm mood". A cute 3D clay cloud with gentle snowflakes, peaceful calm expression, white and light blue, simple and clean, icon style, 256x256' },
    { file: 'weather-night.png', prompt: 'A small weather icon for "Night/Sleep time". A cute 3D clay crescent moon with tiny stars, peaceful sleeping expression, dark blue and gold, simple and clean, icon style, 256x256' },
  ],

  mood: [
    { file: 'mood-good.png', prompt: 'A small mood icon for "Good mood". A cute 3D clay happy face circle, big bright smile, rosy cheeks, warm yellow/orange glow, simple and clean, icon style, 256x256' },
    { file: 'mood-normal.png', prompt: 'A small mood icon for "Normal/Okay mood". A cute 3D clay neutral face circle, gentle slight smile, calm expression, soft green tones, simple and clean, icon style, 256x256' },
    { file: 'mood-bad.png', prompt: 'A small mood icon for "Bad/Fussy mood". A cute 3D clay slightly sad face circle, gentle pout, sympathetic expression, soft blue/purple tones, simple and clean, icon style, 256x256' },
  ],

  premium: [
    { file: 'premium-badge.png', prompt: 'A premium subscription badge icon. A elegant 3D clay golden crown with a sparkle diamond on top, premium quality feel, luxury but cute, icon style, 256x256' },
    { file: 'premium-hero.png', prompt: 'A premium subscription hero illustration. A cute 3D clay baby wearing a golden crown sitting on a velvet cushion, treasure chest of features around (sparkles, stars, gems), exclusive VIP feel but adorable, 1024x1024' },
  ],

  academy: [
    { file: 'academy-art.png', prompt: 'A small icon for "Art Academy". A cute mini 3D clay paint palette with brush and colorful dots, creative and fun, icon style, 256x256' },
    { file: 'academy-coding.png', prompt: 'A small icon for "Coding Academy". A cute mini 3D clay laptop with code symbols on screen, smart and techy, icon style, 256x256' },
    { file: 'academy-dance.png', prompt: 'A small icon for "Dance Academy". A cute mini 3D clay ballet shoes with music notes, graceful and fun, icon style, 256x256' },
    { file: 'academy-english.png', prompt: 'A small icon for "English Academy". A cute mini 3D clay globe with ABC letters orbiting, educational and global, icon style, 256x256' },
    { file: 'academy-math.png', prompt: 'A small icon for "Math Academy". A cute mini 3D clay calculator with 123 numbers and plus sign, smart and logical, icon style, 256x256' },
    { file: 'academy-music.png', prompt: 'A small icon for "Music Academy". A cute mini 3D clay piano keys with music notes floating, melodic and fun, icon style, 256x256' },
    { file: 'academy-science.png', prompt: 'A small icon for "Science Academy". A cute mini 3D clay beaker/flask with colorful bubbling liquid, discovery and wonder, icon style, 256x256' },
    { file: 'academy-sports.png', prompt: 'A small icon for "Sports Academy". A cute mini 3D clay soccer ball with sneaker shoe, active and energetic, icon style, 256x256' },
  ],

  icon: [
    { file: 'icon-bell.png', prompt: 'A minimal 3D clay notification bell icon, soft golden color, simple clean shape, subtle ring animation implied, icon style, 256x256' },
    { file: 'icon-camera.png', prompt: 'A minimal 3D clay camera icon, soft white/gray color, simple clean shape, small lens detail, icon style, 256x256' },
    { file: 'icon-comment.png', prompt: 'A minimal 3D clay speech bubble icon, soft white color with thin outline, simple clean rounded shape, icon style, 256x256' },
    { file: 'icon-heart.png', prompt: 'A minimal 3D clay heart icon, soft coral/pink color, simple clean shape, gentle glow, icon style, 256x256' },
    { file: 'icon-lock.png', prompt: 'A minimal 3D clay padlock icon, soft gray/silver color, simple clean shape, secure feel, icon style, 256x256' },
    { file: 'icon-mic.png', prompt: 'A minimal 3D clay microphone icon, soft dark gray color, simple clean shape with small stand, icon style, 256x256' },
    { file: 'icon-send.png', prompt: 'A minimal 3D clay paper airplane icon, soft blue/white color, simple clean shape, dynamic angle, icon style, 256x256' },
    { file: 'icon-settings.png', prompt: 'A minimal 3D clay gear/cog icon, soft gray color, simple clean shape with rounded teeth, icon style, 256x256' },
    { file: 'icon-share.png', prompt: 'A minimal 3D clay share/forward arrow icon, soft blue color, simple clean shape, connected dots design, icon style, 256x256' },
    { file: 'icon-redflag.png', prompt: 'A minimal 3D clay warning triangle icon with exclamation mark, soft red/coral color, simple clean shape, alert but not scary, icon style, 256x256' },
    { file: 'icon-hospital.png', prompt: 'A minimal 3D clay hospital/medical cross icon, soft red color on white background, simple clean shape, medical care feel, icon style, 256x256' },
  ],

  tab: [
    { file: 'tab-home.png', prompt: 'A minimal clean line icon of a house/home, thin consistent stroke weight, simple geometric shape, neutral gray color, tab bar navigation style, 128x128' },
    { file: 'tab-home-active.png', prompt: 'A minimal filled icon of a house/home, solid fill with brand coral/orange color (#FF8C5A), simple geometric shape, tab bar navigation active state, 128x128' },
    { file: 'tab-diary.png', prompt: 'A minimal clean line icon of an open book/diary, thin consistent stroke weight, simple geometric shape, neutral gray color, tab bar navigation style, 128x128' },
    { file: 'tab-diary-active.png', prompt: 'A minimal filled icon of an open book/diary, solid fill with brand coral/orange color (#FF8C5A), simple geometric shape, tab bar navigation active state, 128x128' },
    { file: 'tab-chat.png', prompt: 'A minimal clean line icon of a chat bubble with heart inside, thin consistent stroke weight, simple geometric shape, neutral gray color, tab bar navigation style, 128x128' },
    { file: 'tab-chat-active.png', prompt: 'A minimal filled icon of a chat bubble with heart inside, solid fill with brand coral/orange color (#FF8C5A), simple geometric shape, tab bar navigation active state, 128x128' },
    { file: 'tab-more.png', prompt: 'A minimal clean line icon of a person/user profile, thin consistent stroke weight, simple geometric shape, neutral gray color, tab bar navigation style, 128x128' },
    { file: 'tab-more-active.png', prompt: 'A minimal filled icon of a person/user profile, solid fill with brand coral/orange color (#FF8C5A), simple geometric shape, tab bar navigation active state, 128x128' },
  ],

  analyzer: [
    { file: 'analyzer-cry-bg.png', prompt: 'A background illustration for a baby cry analyzer screen. Soft gradient from light blue to lavender, subtle sound wave patterns, gentle microphone icon watermark, calm analyzing atmosphere, 1024x1024' },
    { file: 'analyzer-poop-bg.png', prompt: 'A background illustration for a baby poop/health analyzer screen. Soft gradient from mint to light green, subtle health check pattern, gentle clipboard icon watermark, medical but friendly atmosphere, 1024x1024' },
    { file: 'analyzer-cry-result.png', prompt: 'An illustration for cry analysis results. A cute 3D clay baby with sound waves around, analysis chart floating nearby, emotion indicators (happy, hungry, tired), diagnostic result theme, 512x512' },
    { file: 'analyzer-poop-result.png', prompt: 'An illustration for poop/health analysis results. A cute 3D clay baby sitting happily, health checklist with green checkmarks floating nearby, friendly medical result theme, 512x512' },
    { file: 'analyzing.png', prompt: 'An illustration for an analysis in progress loading state. A cute 3D clay magnifying glass scanning with sparkle effects, circular progress indicator, processing/thinking animation feel, 512x512' },
    { file: 'analyzer-recording.png', prompt: 'An illustration for an audio recording state. A cute 3D clay microphone with pulsing sound waves, red recording dot indicator, active listening feel, 512x512' },
    { file: 'analyzer-photo.png', prompt: 'An illustration for a photo capture/analysis state. A cute 3D clay camera viewfinder frame, photo being taken with flash effect, capture moment feel, 512x512' },
  ],

  misc: [
    { file: 'coach-avatar.png', prompt: 'A friendly AI coaching avatar. A cute 3D clay female counselor character with warm smile, wearing soft pink blouse, gentle motherly appearance, professional but approachable, Korean ajumma warmth, circular avatar crop, 512x512' },
    { file: 'avatar-boy.png', prompt: 'A default avatar for a baby boy. A cute 3D clay baby face, short hair, big round eyes, rosy cheeks, gentle smile, soft blue accent, circular portrait style, gender-neutral but slightly boyish, 512x512' },
    { file: 'avatar-girl.png', prompt: 'A default avatar for a baby girl. A cute 3D clay baby face, slightly longer hair with tiny bow, big round eyes, rosy cheeks, gentle smile, soft pink accent, circular portrait style, 512x512' },
    { file: 'badge-ai.png', prompt: 'A small badge icon indicating AI-generated content. A cute mini 3D clay sparkle/wand with AI text, modern and clean, tech-forward feel, 128x128' },
    { file: 'badge-db.png', prompt: 'A small badge icon indicating database/evidence-based content. A cute mini 3D clay book with checkmark, trustworthy and reliable feel, 128x128' },
    { file: 'report-header.png', prompt: 'A header illustration for weekly/monthly reports. A cute 3D clay clipboard with charts and graphs, gold star on top, professional report summary feel, wide aspect ratio, 1024x512' },
    { file: 'store-banner.png', prompt: 'An app store promotional banner. A cute 3D clay baby using a phone/tablet with the app, floating feature icons around, warm inviting "download now" feel, professional marketing quality, 1024x500' },
    { file: 'play-activity.png', prompt: 'A small icon for "Play/Activity" feature. A cute mini 3D clay toy blocks with a ball, playful and fun, bright colors, icon style, 256x256' },
    { file: 'play-complete.png', prompt: 'A small icon for "Activity Complete". A cute mini 3D clay trophy with confetti, celebration and achievement, icon style, 256x256' },
    { file: 'support-faq.png', prompt: 'A small icon for "FAQ/Help" section. A cute mini 3D clay question mark with lightbulb, helpful and guiding, icon style, 256x256' },
    { file: 'support-inquiry.png', prompt: 'A small icon for "Contact/Inquiry" section. A cute mini 3D clay envelope with heart seal, friendly customer support, icon style, 256x256' },
  ],
};

/* ── DALL-E 3 호출 ── */
async function generateImage(asset, idx, total) {
  const fullPrompt = `${MASTER_STYLE}. ${asset.prompt}`;
  console.log(`  [${idx + 1}/${total}] Generating ${asset.file}...`);

  const body = {
    model: MODEL,
    prompt: fullPrompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
  };

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  FAILED ${asset.file}: HTTP ${res.status}`, err.slice(0, 200));
      return false;
    }

    const json = await res.json();
    // gpt-image-1: b64_json in data[0].b64_json, or URL in data[0].url
    const item = json.data?.[0];
    if (!item) {
      console.error(`  No image data for ${asset.file}`);
      console.log('  Response:', JSON.stringify(json).slice(0, 300));
      return false;
    }

    let buf;
    if (item.b64_json) {
      buf = Buffer.from(item.b64_json, 'base64');
    } else if (item.url) {
      // URL 방식이면 다운로드
      const imgRes = await fetch(item.url);
      const arrBuf = await imgRes.arrayBuffer();
      buf = Buffer.from(arrBuf);
    } else {
      console.error(`  Unknown response format for ${asset.file}`);
      return false;
    }

    const outPath = path.join(OUT_DIR, asset.file);
    fs.writeFileSync(outPath, buf);
    console.log(`  Saved ${asset.file} (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    console.error(`  ERROR ${asset.file}:`, err.message);
    return false;
  }
}

/* ── 메인 실행 ── */
async function main() {
  const category = process.argv[2];

  if (category && !ASSETS[category]) {
    console.error(`Unknown category: ${category}`);
    console.error('Available:', Object.keys(ASSETS).join(', '));
    process.exit(1);
  }

  const categories = category ? [category] : Object.keys(ASSETS);
  let totalCount = 0;
  let successCount = 0;
  let failCount = 0;

  console.log('=' .repeat(60));
  console.log('DALL-E 3 Asset Generator');
  console.log('Master style: 3D clay-render, Pixar quality');
  console.log('Categories:', categories.join(', '));
  console.log('=' .repeat(60));

  for (const cat of categories) {
    const items = ASSETS[cat];
    console.log(`\n--- ${cat.toUpperCase()} (${items.length} assets) ---`);

    for (let i = 0; i < items.length; i++) {
      totalCount++;
      const ok = await generateImage(items[i], i, items.length);
      if (ok) successCount++;
      else failCount++;

      // Rate limit: 5 requests/min for DALL-E 3
      if (i < items.length - 1) {
        console.log('  (waiting 13s for rate limit...)');
        await new Promise(r => setTimeout(r, 13000));
      }
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`DONE! ${successCount} success, ${failCount} failed, ${totalCount} total`);
  console.log('=' .repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
