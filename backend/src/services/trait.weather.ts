/** 기질 날씨 — 오늘의 기질 에너지 상태를 날씨 메타포로 표현 */

interface TraitWeather {
  weather: string;
  emoji: string;
  message: string;
  tip: string;
  color: string;
}

const WEATHER_MAP: Record<string, TraitWeather[]> = {
  '탐구형': [
    { weather: '맑음', emoji: '☀️', message: '호기심 에너지가 활짝 피는 날!', tip: '새로운 것을 탐험하기 좋은 날이에요', color: '#81C784' },
    { weather: '구름조금', emoji: '⛅', message: '차분하게 관찰하기 좋은 날', tip: '도서관이나 과학관 나들이 어때요?', color: '#90CAF9' },
    { weather: '비', emoji: '🌧️', message: '실내에서 깊이 탐구하는 날', tip: '집에서 실험놀이를 해보세요', color: '#80CBC4' },
  ],
  '활동형': [
    { weather: '맑음', emoji: '🌈', message: '에너지가 넘치는 활기찬 날!', tip: '바깥에서 마음껏 뛰어놀게 해주세요', color: '#FF8A80' },
    { weather: '구름조금', emoji: '🌤️', message: '적당히 움직이기 좋은 날', tip: '친구와 함께하는 운동이 좋아요', color: '#FFD54F' },
    { weather: '비', emoji: '🌦️', message: '실내 활동으로 에너지를 쓰는 날', tip: '댄스나 실내 놀이터가 좋아요', color: '#CE93D8' },
  ],
  '조화형': [
    { weather: '맑음', emoji: '🌸', message: '조화로운 에너지가 가득한 날!', tip: '친구들과 함께하는 활동이 좋아요', color: '#FFD54F' },
    { weather: '구름조금', emoji: '🍃', message: '편안하게 어울리기 좋은 날', tip: '또래 놀이 약속을 잡아보세요', color: '#A5D6A7' },
    { weather: '비', emoji: '☁️', message: '가족과 함께하는 따뜻한 날', tip: '함께 요리하거나 보드게임해요', color: '#90CAF9' },
  ],
  '분석형': [
    { weather: '맑음', emoji: '🔍', message: '집중력이 빛나는 날!', tip: '퍼즐이나 코딩 활동이 딱이에요', color: '#90CAF9' },
    { weather: '구름조금', emoji: '📐', message: '차분하게 생각하기 좋은 날', tip: '조용한 환경에서 학습해보세요', color: '#B0BEC5' },
    { weather: '비', emoji: '🧩', message: '깊이 파고들기 좋은 날', tip: '관심 분야 책이나 다큐를 봐요', color: '#80DEEA' },
  ],
  '감성형': [
    { weather: '맑음', emoji: '🎨', message: '감수성이 풍부한 아름다운 날!', tip: '그림 그리기나 음악 활동이 좋아요', color: '#CE93D8' },
    { weather: '구름조금', emoji: '🎵', message: '감정을 표현하기 좋은 날', tip: '일기 쓰기나 작곡놀이 어때요?', color: '#F48FB1' },
    { weather: '비', emoji: '📖', message: '상상력이 피어나는 날', tip: '동화책을 읽거나 이야기 만들기 해요', color: '#80CBC4' },
  ],
};

export function getTraitWeather(dominantType: string): TraitWeather {
  const weathers = WEATHER_MAP[dominantType] ?? WEATHER_MAP['조화형'];
  // 날짜 기반 결정적 선택 (매일 같은 결과)
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const idx = dayOfYear % weathers.length;
  return weathers[idx];
}
