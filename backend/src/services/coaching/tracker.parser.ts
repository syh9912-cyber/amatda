// ─── 자연어 육아 메시지 → 트래킹 데이터 파서 ───

export interface ParsedTracking {
  feeding?: { type?: string; count?: number; amountMl?: number; refused?: boolean };
  sleep?: { hours?: number; naps?: number; nightWakeups?: number };
  diaper?: { poop?: number; pee?: number; total?: number };
  condition?: string;
  temperature?: number;
}

// ─── 수량 추출 헬퍼 ───

function extractNumber(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (!match) return undefined;
  const val = parseFloat(match[1]);
  return Number.isFinite(val) ? val : undefined;
}

// ─── 수유/식사 파싱 ───

const FEEDING_PATTERNS = {
  formulaMl: /분유\s*(\d+)\s*(?:ml|밀리)/,
  formulaGeneral: /분유/,
  breastMl: /모유\s*(\d+)\s*(?:ml|밀리)/,
  breastGeneral: /모유|젖\s*(?:먹|줬|줌|수유)/,
  breastFeeding: /수유\s*(?:했|함|완료|끝)/,
  babyFood: /이유식/,
  meal: /밥|식사|간식|반찬|죽/,
  mlAmount: /(\d+)\s*(?:ml|밀리)/,
  refused: /안\s*먹|거부|입\s*다물|안\s*받|뱉|먹기\s*싫/,
  feedCount: /(\d+)\s*(?:번|회|차)\s*(?:먹|수유|줬)/,
};

function parseFeeding(text: string): ParsedTracking['feeding'] | undefined {
  let detected = false;
  const result: NonNullable<ParsedTracking['feeding']> = {};

  // 거부 체크
  if (FEEDING_PATTERNS.refused.test(text)) {
    result.refused = true;
    detected = true;
  }

  // 분유
  if (FEEDING_PATTERNS.formulaGeneral.test(text)) {
    result.type = 'formula';
    const ml = extractNumber(text, FEEDING_PATTERNS.formulaMl);
    if (ml !== undefined) result.amountMl = ml;
    detected = true;
  }

  // 모유
  if (!result.type && (FEEDING_PATTERNS.breastGeneral.test(text) || FEEDING_PATTERNS.breastFeeding.test(text))) {
    result.type = 'breast';
    const ml = extractNumber(text, FEEDING_PATTERNS.breastMl);
    if (ml !== undefined) result.amountMl = ml;
    detected = true;
  }

  // 이유식
  if (!result.type && FEEDING_PATTERNS.babyFood.test(text)) {
    result.type = 'baby_food';
    detected = true;
  }

  // 일반 식사
  if (!result.type && FEEDING_PATTERNS.meal.test(text)) {
    result.type = 'meal';
    detected = true;
  }

  // ml만 있고 타입 미지정인 경우 (예: "150ml 먹였어")
  if (!result.type && !detected) {
    const ml = extractNumber(text, FEEDING_PATTERNS.mlAmount);
    if (ml !== undefined) {
      result.amountMl = ml;
      result.type = 'formula';
      detected = true;
    }
  }

  // 횟수
  const count = extractNumber(text, FEEDING_PATTERNS.feedCount);
  if (count !== undefined) {
    result.count = count;
    detected = true;
  }

  return detected ? result : undefined;
}

// ─── 수면 파싱 ───

const SLEEP_PATTERNS = {
  napHours: /낮잠\s*(\d+(?:\.\d+)?)\s*시간/,
  napMinutes: /낮잠\s*(\d+)\s*분/,
  nightHours: /밤잠\s*(\d+(?:\.\d+)?)\s*시간/,
  nightMinutes: /밤잠\s*(\d+)\s*분/,
  genericHours: /(\d+(?:\.\d+)?)\s*시간\s*(?:잤|잠|자|수면|취침)/,
  genericSleepHours: /(?:잤|잠|자|수면|취침)\S{0,4}\s*(\d+(?:\.\d+)?)\s*시간/,
  nightWakeups: /밤에?\s*(\d+)\s*번\s*(?:깼|깸|일어|깨)/,
  nightWakeGeneric: /자다\s*깼|깨서\s*울|밤에?\s*깼/,
  napCount: /낮잠\s*(\d+)\s*번/,
  noSleep: /잠을?\s*안\s*자|안\s*자|잠\s*못/,
  sleepKeyword: /낮잠|밤잠|수면|잠|잤|깼|취침/,
};

function parseSleep(text: string): ParsedTracking['sleep'] | undefined {
  let detected = false;
  const result: NonNullable<ParsedTracking['sleep']> = {};

  // 잠을 안 자는 경우
  if (SLEEP_PATTERNS.noSleep.test(text)) {
    result.hours = 0;
    return result;
  }

  // 낮잠 시간
  const napHours = extractNumber(text, SLEEP_PATTERNS.napHours);
  if (napHours !== undefined) {
    result.hours = napHours;
    if (result.naps === undefined) result.naps = 1;
    detected = true;
  }

  // 낮잠 분
  if (!detected) {
    const napMinutes = extractNumber(text, SLEEP_PATTERNS.napMinutes);
    if (napMinutes !== undefined) {
      result.hours = Math.round((napMinutes / 60) * 10) / 10;
      if (result.naps === undefined) result.naps = 1;
      detected = true;
    }
  }

  // 밤잠 시간
  const nightHours = extractNumber(text, SLEEP_PATTERNS.nightHours);
  if (nightHours !== undefined) {
    result.hours = (result.hours || 0) + nightHours;
    detected = true;
  }

  // 밤잠 분
  if (nightHours === undefined) {
    const nightMinutes = extractNumber(text, SLEEP_PATTERNS.nightMinutes);
    if (nightMinutes !== undefined) {
      result.hours = (result.hours || 0) + Math.round((nightMinutes / 60) * 10) / 10;
      detected = true;
    }
  }

  // 일반 수면 시간 ("3시간 잤어", "잤어 3시간")
  if (!detected) {
    const genericH = extractNumber(text, SLEEP_PATTERNS.genericHours)
      ?? extractNumber(text, SLEEP_PATTERNS.genericSleepHours);
    if (genericH !== undefined) {
      result.hours = genericH;
      detected = true;
    }
  }

  // 낮잠 횟수
  const napCount = extractNumber(text, SLEEP_PATTERNS.napCount);
  if (napCount !== undefined) {
    result.naps = napCount;
    detected = true;
  }

  // 밤 기상 횟수
  const wakeups = extractNumber(text, SLEEP_PATTERNS.nightWakeups);
  if (wakeups !== undefined) {
    result.nightWakeups = wakeups;
    detected = true;
  } else if (SLEEP_PATTERNS.nightWakeGeneric.test(text)) {
    result.nightWakeups = 1;
    detected = true;
  }

  // 수면 키워드만 있고 구체적 수치 없는 경우는 무시
  if (!detected && SLEEP_PATTERNS.sleepKeyword.test(text)) {
    // 키워드는 있지만 수치가 없으므로 파싱 불가
    return undefined;
  }

  return detected ? result : undefined;
}

// ─── 배변 파싱 ───

const DIAPER_PATTERNS = {
  diaperCount: /기저귀\s*(\d+)\s*(?:번|회|개)/,
  poopCount: /(?:대변|똥|응가)\s*(\d+)\s*(?:번|회)/,
  peeCount: /(?:소변|쉬|오줌|쉬야)\s*(\d+)\s*(?:번|회)/,
  poopGeneric: /대변|똥|응가|변\s*봤/,
  peeGeneric: /소변만|쉬만|소변\s*봤|쉬\s*했/,
  diaperGeneric: /기저귀\s*(?:갈았|갈음|교체|바꿨|바꿈|찼)/,
  diaperKeyword: /기저귀|대변|소변|똥|응가|쉬야|오줌/,
};

function parseDiaper(text: string): ParsedTracking['diaper'] | undefined {
  let detected = false;
  const result: NonNullable<ParsedTracking['diaper']> = {};

  // 기저귀 횟수
  const diaperTotal = extractNumber(text, DIAPER_PATTERNS.diaperCount);
  if (diaperTotal !== undefined) {
    result.total = diaperTotal;
    detected = true;
  }

  // 대변 횟수
  const poopCount = extractNumber(text, DIAPER_PATTERNS.poopCount);
  if (poopCount !== undefined) {
    result.poop = poopCount;
    detected = true;
  } else if (DIAPER_PATTERNS.poopGeneric.test(text)) {
    result.poop = 1;
    detected = true;
  }

  // 소변 횟수
  const peeCount = extractNumber(text, DIAPER_PATTERNS.peeCount);
  if (peeCount !== undefined) {
    result.pee = peeCount;
    detected = true;
  } else if (DIAPER_PATTERNS.peeGeneric.test(text)) {
    result.pee = 1;
    detected = true;
  }

  // 기저귀 갈았어 (총 횟수 불명, 1회로 기록)
  if (!detected && DIAPER_PATTERNS.diaperGeneric.test(text)) {
    result.total = 1;
    detected = true;
  }

  // total 자동 계산
  if (detected && result.total === undefined && (result.poop !== undefined || result.pee !== undefined)) {
    result.total = (result.poop || 0) + (result.pee || 0);
  }

  return detected ? result : undefined;
}

// ─── 컨디션/체온 파싱 ───

const CONDITION_PATTERNS = {
  temperatureDot: /(\d{2}(?:\.\d)?)\s*도/,
  temperatureWord: /열이?\s*(\d{2}(?:\.\d)?)/,
  fever: /열\s*(?:나|있|높|심)/,
  sick: /아파|아픈|아프|아팠|몸살|감기|콧물|기침|구토|토했|설사|변비|발진/,
  badCondition: /컨디션\s*(?:안\s*좋|나빠|별로|저하)|기운\s*(?:없|떨어)/,
  goodCondition: /컨디션\s*(?:좋|괜찮)|기운\s*(?:있|좋|넘)/,
};

function parseCondition(text: string): { condition?: string; temperature?: number } {
  const result: { condition?: string; temperature?: number } = {};

  // 체온 추출
  const tempDot = extractNumber(text, CONDITION_PATTERNS.temperatureDot);
  const tempWord = extractNumber(text, CONDITION_PATTERNS.temperatureWord);
  const temp = tempDot ?? tempWord;
  if (temp !== undefined && temp >= 35 && temp <= 42) {
    result.temperature = temp;
    if (temp >= 37.5) {
      result.condition = '발열';
    }
  }

  // 열 관련
  if (!result.condition && CONDITION_PATTERNS.fever.test(text)) {
    result.condition = '발열';
  }

  // 아픔/질병
  if (!result.condition && CONDITION_PATTERNS.sick.test(text)) {
    result.condition = '아픔';
  }

  // 컨디션 표현
  if (!result.condition && CONDITION_PATTERNS.badCondition.test(text)) {
    result.condition = '컨디션 저하';
  }

  if (!result.condition && CONDITION_PATTERNS.goodCondition.test(text)) {
    result.condition = '양호';
  }

  return result;
}

// ─── 메인 파서 ───

export function parseTrackingFromMessage(message: string): ParsedTracking | null {
  const text = message.trim();
  if (text.length === 0) return null;

  const feeding = parseFeeding(text);
  const sleep = parseSleep(text);
  const diaper = parseDiaper(text);
  const { condition, temperature } = parseCondition(text);

  // 아무 데이터도 추출 못한 경우
  if (!feeding && !sleep && !diaper && !condition && temperature === undefined) {
    return null;
  }

  const result: ParsedTracking = {};
  if (feeding) result.feeding = feeding;
  if (sleep) result.sleep = sleep;
  if (diaper) result.diaper = diaper;
  if (condition) result.condition = condition;
  if (temperature !== undefined) result.temperature = temperature;

  return result;
}
