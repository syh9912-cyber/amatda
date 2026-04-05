/** 실제 날씨 데이터 조회 — wttr.in API (무료, API 키 불필요) */

export interface RealWeather {
  temperature: number;
  description: string;
  humidity: number;
  feelsLike: number;
  icon: string;
  weatherCode: string;
}

interface WttrCurrentCondition {
  temp_C: string;
  FeelsLikeC: string;
  humidity: string;
  weatherCode: string;
  weatherDesc: { value: string }[];
}

interface WttrResponse {
  current_condition: WttrCurrentCondition[];
}

const WEATHER_KO_MAP: Record<string, { desc: string; icon: string }> = {
  '113': { desc: '맑음', icon: '☀️' },
  '116': { desc: '구름조금', icon: '⛅' },
  '119': { desc: '흐림', icon: '☁️' },
  '122': { desc: '흐림', icon: '☁️' },
  '143': { desc: '안개', icon: '🌫️' },
  '176': { desc: '비', icon: '🌧️' },
  '179': { desc: '눈', icon: '❄️' },
  '182': { desc: '진눈깨비', icon: '🌨️' },
  '185': { desc: '진눈깨비', icon: '🌨️' },
  '200': { desc: '천둥번개', icon: '⛈️' },
  '227': { desc: '눈보라', icon: '❄️' },
  '230': { desc: '눈보라', icon: '❄️' },
  '248': { desc: '안개', icon: '🌫️' },
  '260': { desc: '안개', icon: '🌫️' },
  '263': { desc: '이슬비', icon: '🌦️' },
  '266': { desc: '이슬비', icon: '🌦️' },
  '281': { desc: '진눈깨비', icon: '🌨️' },
  '284': { desc: '진눈깨비', icon: '🌨️' },
  '293': { desc: '가벼운 비', icon: '🌦️' },
  '296': { desc: '비', icon: '🌧️' },
  '299': { desc: '비', icon: '🌧️' },
  '302': { desc: '비', icon: '🌧️' },
  '305': { desc: '폭우', icon: '🌧️' },
  '308': { desc: '폭우', icon: '🌧️' },
  '311': { desc: '진눈깨비', icon: '🌨️' },
  '314': { desc: '진눈깨비', icon: '🌨️' },
  '317': { desc: '진눈깨비', icon: '🌨️' },
  '320': { desc: '눈', icon: '❄️' },
  '323': { desc: '가벼운 눈', icon: '🌨️' },
  '326': { desc: '가벼운 눈', icon: '🌨️' },
  '329': { desc: '눈', icon: '❄️' },
  '332': { desc: '눈', icon: '❄️' },
  '335': { desc: '폭설', icon: '❄️' },
  '338': { desc: '폭설', icon: '❄️' },
  '350': { desc: '우박', icon: '🌨️' },
  '353': { desc: '가벼운 비', icon: '🌦️' },
  '356': { desc: '비', icon: '🌧️' },
  '359': { desc: '폭우', icon: '🌧️' },
  '362': { desc: '진눈깨비', icon: '🌨️' },
  '365': { desc: '진눈깨비', icon: '🌨️' },
  '368': { desc: '가벼운 눈', icon: '🌨️' },
  '371': { desc: '눈', icon: '❄️' },
  '374': { desc: '우박', icon: '🌨️' },
  '377': { desc: '우박', icon: '🌨️' },
  '386': { desc: '천둥번개', icon: '⛈️' },
  '389': { desc: '천둥폭우', icon: '⛈️' },
  '392': { desc: '천둥눈', icon: '⛈️' },
  '395': { desc: '폭설', icon: '❄️' },
};

/** wttr.in 날씨 코드를 한국어 + 아이콘으로 변환 */
function mapWeatherCode(code: string): { desc: string; icon: string } {
  return WEATHER_KO_MAP[code] ?? { desc: '맑음', icon: '☀️' };
}

/** 날씨 코드를 간단한 카테고리로 분류 (활동 추천용) */
export function getWeatherCategory(code: string): string {
  const num = parseInt(code, 10);
  if (num <= 116) return 'sunny';
  if (num <= 122) return 'cloudy';
  if (num <= 260) return 'foggy';
  if ([179, 182, 185, 227, 230, 320, 323, 326, 329, 332, 335, 338, 368, 371, 395].includes(num)) return 'snowy';
  if (num >= 200 && num <= 201) return 'thunder';
  if (num >= 386) return 'thunder';
  return 'rainy';
}

export async function fetchRealWeather(
  lat: number,
  lng: number
): Promise<RealWeather | null> {
  try {
    const url = `https://wttr.in/${lat},${lng}?format=j1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'amatda-app/1.0' },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as WttrResponse;
    const current = data.current_condition?.[0];
    if (!current) return null;

    const mapped = mapWeatherCode(current.weatherCode);

    return {
      temperature: parseInt(current.temp_C, 10),
      description: mapped.desc,
      humidity: parseInt(current.humidity, 10),
      feelsLike: parseInt(current.FeelsLikeC, 10),
      icon: mapped.icon,
      weatherCode: current.weatherCode,
    };
  } catch {
    return null;
  }
}
