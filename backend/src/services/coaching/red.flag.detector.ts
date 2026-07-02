import { RedFlagResult } from './types';

/**
 * 위험 키워드 4단계 (CLAUDE.md 정의)와 본 모듈 내부 명칭 매핑
 * — 코드 내부에서는 'emergency' / 'urgent' / 'monitor' 사용 (38곳 참조).
 *
 *   CLAUDE.md spec      ↔  코드 내부 명칭         처리
 *   ──────────────────────────────────────────────────────────────────
 *   EMERGENCY           ↔  'emergency'           AI 응답 X, 즉시 119 안내
 *   HOSPITAL            ↔  'urgent'              병원/24h 내 진료 권고
 *   EXPERT              ↔  'monitor' (1~2일 관찰 후 진료 권유 = 전문가 상담 권고와 의미적 매핑)
 *   GENERAL             ↔  (FlagRule 매칭 X)     일반 AI 응답
 *
 * 향후 명명 통일 시 ask.handler.ts 등 모든 참조 위치를 한 번에 변경할 것
 * (현재는 운영 안정성 우선 — 이름 변경 risk 회피).
 */
interface FlagRule {
  pattern: RegExp;
  label: string;
  urgency: 'emergency' | 'urgent' | 'monitor';
}

// ─── 아이 관련 레드 플래그 ───
// 패턴은 normalizeMessage 가 적용된 텍스트(NFKC + 소문자 + 영문/이모지/공백 정규화)에서 매칭됨.
// 각 패턴은 한국어/영어 원본에 일본어·번체중국어 키워드를 |로만 추가(추가형) — 기존 매칭은 절대 변경하지 않음.
const CHILD_FLAG_RULES: FlagRule[] = [
  // ─── Emergency (즉시 병원) ───
  // 한국어 + 영문(fever, 39 degrees, 39c) + 일본어 + 번체중국어 모두 커버
  { pattern: /(?:열|체온|fever|temp|temperature|熱|体温|発熱|體溫|發燒).*(?:3[89]|4[01])(?:\.\d)?\s*(?:도|°|c|celsius|degrees?|度)?/i, label: '38도 이상 발열', urgency: 'emergency' },
  { pattern: /(?:3[89]|4[01])(?:\.\d)?\s*(?:도|°|c|celsius|degrees?|度)/i, label: '고열', urgency: 'emergency' },
  { pattern: /(?:🤒|🥵|🌡)/, label: '체온 관련 이모지', urgency: 'emergency' },
  { pattern: /경\s*련|발\s*작|경\s*기|seizure|convulsion|けいれん|痙攣|発作|ひきつけ|抽搐|抽筋|癲癇/i, label: '경련/발작', urgency: 'emergency' },
  { pattern: /의식.*(?:잃|없|저하)|깨워도.*안.*깨|意識.*(?:失|なく|低下|もうろう)|起こしても.*起きない|意識.*(?:喪失|不清|模糊)|叫.*不醒/, label: '의식 저하', urgency: 'emergency' },
  { pattern: /호흡.*(?:곤란|이상|멈|거칠|힘들)|숨.*(?:못|안).*(?:쉬|쉼)|呼吸.*(?:困難|異常|止ま|荒い|苦し)|息が.*(?:できな|止ま)|呼吸.*(?:困難|異常|停止|急促|費力)|喘不過氣|不能呼吸/, label: '호흡 곤란', urgency: 'emergency' },
  { pattern: /혈변|피.*(?:섞|나|묻).*(?:변|똥)|피가.*(?:나|묻)|血便|血が.*(?:混じ|出).*(?:便|うんち)|大便.*(?:帶血|有血|混血)/, label: '혈변 의심', urgency: 'emergency' },
  { pattern: /(?:검은|검정|타르).*(?:변|똥)|(?:黒い|黒っぽい|タール状).*便|(?:黑色|瀝青|柏油).*(?:便|大便)/, label: '타르변(흑색변)', urgency: 'emergency' },
  { pattern: /(?:흰|하얀|회색|창백).*(?:변|똥)|(?:白い|灰色).*便|(?:白色|灰色).*(?:便|大便)/, label: '백색/회색변', urgency: 'emergency' },
  { pattern: /탈수|소변.*(?:안|없|감소|줄)|입.*(?:마르|건조)|눈물.*(?:없|안)|脱水|尿.*(?:出な|少な|減)|口.*(?:乾|渇)|涙.*(?:出な|な)|脫水|尿量.*(?:減少|沒有|變少)|嘴.*乾|沒有眼淚/, label: '탈수 의심', urgency: 'emergency' },
  { pattern: /(?:비명|날카로운|끊이지\s*않).*울|(?:悲鳴|甲高|泣き止まな).*泣|(?:尖叫|持續不停|不停).*哭/, label: '비명성 지속 울음', urgency: 'emergency' },

  // ─── Urgent (24시간 내 진료) ───
  { pattern: /구토.*(?:반복|계속|멈추지)|토.*(?:반복|계속)|嘔吐.*(?:繰り返|続|止まらな)|嘔吐.*(?:反覆|持續|不停)/, label: '반복 구토', urgency: 'urgent' },
  { pattern: /(?:밥|음식|수유|분유).*(?:안|거부).*(?:24|하루|종일)|(?:ご飯|食事|授乳|ミルク).*(?:食べな|拒否).*(?:24時間|一日中|丸一日)|(?:飯|食物|餵奶|配方奶).*(?:不吃|拒絕).*(?:24小時|一整天)/, label: '24시간 이상 식사 거부', urgency: 'urgent' },
  { pattern: /(?:2|두)\s*시간.*(?:이상|넘게).*(?:울|보채)|2\s*時間.*以上.*(?:泣|ぐず)|2\s*小時.*(?:以上|超過).*哭鬧/, label: '2시간 이상 지속 울음', urgency: 'urgent' },
  { pattern: /축.*처지|늘어지|기운.*없|ぐったり|元気.*な|無力|軟弱無力|沒精神|精神不振/, label: '심한 처짐/무기력', urgency: 'urgent' },
  { pattern: /발진.*(?:전신|온몸|퍼)|発疹.*(?:全身|広が)|(?:疹子|皮疹|出疹).*(?:全身|擴散|蔓延)/, label: '전신 발진', urgency: 'urgent' },

  // ─── Monitor (경과 관찰) ───
  { pattern: /37\.[5-9]\s*(?:도|度)/, label: '미열 (37.5~37.9도)', urgency: 'monitor' },
  { pattern: /(?:콧물|기침).*(?:며칠|계속|일주일)|(?:鼻水|咳).*(?:数日|続|一週間)|(?:流鼻涕|咳嗽).*(?:好幾天|持續|一週|一星期)/, label: '지속 감기 증상', urgency: 'monitor' },
  { pattern: /설사.*(?:며칠|계속|반복)|下痢.*(?:数日|続|繰り返)|腹瀉.*(?:好幾天|持續|反覆)/, label: '지속 설사', urgency: 'monitor' },
];

// ─── 임산부 전용 레드 플래그 ───
// 각 패턴은 한국어 원본에 일본어·번체중국어 키워드를 |로만 추가(추가형) — 기존 매칭은 절대 변경하지 않음.
const PREGNANT_FLAG_RULES: FlagRule[] = [
  // ─── Emergency (즉시 병원) ───
  { pattern: /양수.*(?:터|파|흐름|줄줄|파수)|파수|破水|羊水.*(?:破れ|漏れ|流れ)|羊水.*(?:破|流)/, label: '양수 파수 의심', urgency: 'emergency' },
  { pattern: /(?:조기|빠른).*진통|37주.*전.*진통|早産.*(?:兆候|陣痛)|陣痛.*早|37週.*前.*陣痛|早產.*陣痛|陣痛.*早產/, label: '조기진통 의심', urgency: 'emergency' },
  { pattern: /(?:대량|다량|심한).*(?:출혈|피)|피.*(?:많이|쏟|흐름)|大量.*出血|血が.*(?:たくさん|大量に)|血.*(?:很多|流不停|流個不停)/, label: '대량 출혈', urgency: 'emergency' },
  { pattern: /전자간증|자간|임신중독|子癇前症|妊娠高血圧|妊娠毒血症/, label: '전자간증 의심', urgency: 'emergency' },
  { pattern: /(?:심한|갑작스런).*두통.*(?:시야|눈|시력|부종)|시야.*(?:흐려|흐림|번쩍)|頭痛.*(?:視野|目|視力|むくみ)|視野.*(?:ぼやけ|かすむ|チカチカ)|頭痛.*(?:視力|眼睛|視野|水腫)|視力.*(?:模糊|閃爍)/, label: '전자간증 증상(두통+시야변화)', urgency: 'emergency' },
  { pattern: /태동.*(?:없|안.*느|급감|감소|줄)|아기.*(?:안.*움직|안.*놀)|胎動.*(?:な|感じな|減)|赤ちゃん.*動かな|胎動.*(?:消失|減少|沒有)|寶寶.*不動/, label: '태동 감소/소실', urgency: 'emergency' },
  { pattern: /경련|발작|의식.*(?:잃|없)|けいれん|痙攣|発作|意識.*(?:失|な)|抽搐|癲癇|意識.*(?:喪失|不清)/, label: '경련/의식소실', urgency: 'emergency' },
  { pattern: /탯줄.*(?:나|빠져|보|느껴)|臍帯.*(?:出|脱出)|臍帶.*(?:脫出|掉出|滑出)/, label: '탯줄 탈출 의심', urgency: 'emergency' },

  // ─── Urgent (24시간 내 진료) ───
  { pattern: /(?:출혈|피).*(?:나|묻|보|있)|질.*(?:출혈|피)|出血|性器.*(?:出血|血)|陰道.*(?:出血|流血)/, label: '질 출혈', urgency: 'urgent' },
  { pattern: /(?:규칙|반복).*(?:뭉침|수축|배.*아파)|배.*뭉침.*(?:반복|규칙)|規則的.*(?:張り|収縮)|お腹.*痛.*規則|規律.*(?:緊繃|宮縮)|子宮收縮.*規律/, label: '규칙적 자궁 수축', urgency: 'urgent' },
  { pattern: /(?:심한|극심|참을수없).*(?:복통|배.*아파|하복부)|(?:ひどい|激しい).*(?:腹痛|お腹.*痛|下腹部)|(?:嚴重|劇烈).*(?:腹痛|下腹部)/, label: '심한 복통', urgency: 'urgent' },
  { pattern: /(?:갑자기|급격).*(?:부종|붓|부어)|얼굴.*(?:붓|부)|(?:急な|急激な).*むくみ|顔.*(?:むく|腫れ)|(?:急遽|突然).*水腫|臉.*腫/, label: '급격한 부종', urgency: 'urgent' },
  { pattern: /소변.*(?:안|없|감소|줄)|24시간.*소변|尿.*(?:出な|少な|減)|尿量.*(?:減少|很少|驟減)/, label: '소변량 급감', urgency: 'urgent' },
  { pattern: /(?:5|다섯).*회.*(?:이상|넘).*(?:토|구토)|구토.*(?:계속|멈추지)|5\s*回.*以上.*嘔吐|嘔吐.*(?:続|止まらな)|5\s*次.*以上.*嘔吐|嘔吐.*(?:持續|不停)/, label: '심한 구토(임신오조 의심)', urgency: 'urgent' },
  { pattern: /140.*90|(?:높|올).*혈압|血圧.*(?:高|上が)|血壓.*(?:升高|過高|偏高)/, label: '혈압 상승', urgency: 'urgent' },

  // ─── Monitor (경과 관찰) ───
  { pattern: /(?:가끔|가벼운).*(?:뭉침|수축)|(?:たまに|軽い).*(?:張り|収縮)|(?:偶爾|輕微).*(?:緊繃|宮縮)/, label: '간헐적 배 뭉침', urgency: 'monitor' },
  { pattern: /(?:갈색|묽은).*(?:분비물|냉)|(?:茶色い|水っぽい).*おりもの|(?:褐色|水狀).*分泌物/, label: '비정상 분비물', urgency: 'monitor' },
  { pattern: /(?:소량|약간).*(?:피|출혈|이슬)|少量.*(?:出血|おしるし)|少量.*(?:出血|落紅)/, label: '소량 출혈/이슬', urgency: 'monitor' },
  { pattern: /(?:심한|극심).*(?:입덧|구역|토)|(?:ひどい|激しい).*つわり|嚴重.*孕吐/, label: '심한 입덧', urgency: 'monitor' },
];

const FLAG_RULES = CHILD_FLAG_RULES;
void FLAG_RULES;  // 외부 명시 export 없음 — 내부 참조용

// ─── 로케일별 라벨/메시지 번역 (추가형) ───
// 위험 감지 자체(정규식 매칭 대상 텍스트)는 한국어 입력 기준 그대로 유지 —
// 라벨/메시지는 감지 이후 "사용자에게 보여줄 텍스트"만 번역한다.
// EMERGENCY 단계는 AI를 거치지 않고 이 메시지가 그대로 노출되므로 번역이 특히 중요.
const LABEL_JA: Record<string, string> = {
  '38도 이상 발열': '38度以上の発熱',
  '고열': '高熱',
  '체온 관련 이모지': '体温に関する絵文字',
  '경련/발작': 'けいれん/発作',
  '의식 저하': '意識低下',
  '호흡 곤란': '呼吸困難',
  '혈변 의심': '血便の疑い',
  '타르변(흑색변)': 'タール便(黒色便)',
  '백색/회색변': '白色/灰色便',
  '탈수 의심': '脱水の疑い',
  '비명성 지속 울음': '悲鳴のような泣き声が続く',
  '반복 구토': '繰り返す嘔吐',
  '24시간 이상 식사 거부': '24時間以上の食事拒否',
  '2시간 이상 지속 울음': '2時間以上続く泣き',
  '심한 처짐/무기력': 'ひどいぐったり感/無気力',
  '전신 발진': '全身の発疹',
  '미열 (37.5~37.9도)': '微熱(37.5〜37.9度)',
  '지속 감기 증상': '続く風邪症状',
  '지속 설사': '続く下痢',
  '양수 파수 의심': '破水の疑い',
  '조기진통 의심': '早産兆候(陣痛)の疑い',
  '대량 출혈': '大量出血',
  '전자간증 의심': '子癇前症の疑い',
  '전자간증 증상(두통+시야변화)': '子癇前症の症状(頭痛+視野変化)',
  '태동 감소/소실': '胎動減少/消失',
  '경련/의식소실': 'けいれん/意識消失',
  '탯줄 탈출 의심': '臍帯脱出の疑い',
  '질 출혈': '性器出血',
  '규칙적 자궁 수축': '規則的な子宮収縮',
  '심한 복통': 'ひどい腹痛',
  '급격한 부종': '急激なむくみ',
  '소변량 급감': '尿量の急激な減少',
  '심한 구토(임신오조 의심)': 'ひどい嘔吐(妊娠悪阻の疑い)',
  '혈압 상승': '血圧上昇',
  '간헐적 배 뭉침': '間欠的なお腹の張り',
  '비정상 분비물': '異常なおりもの',
  '소량 출혈/이슬': '少量の出血/おしるし',
  '심한 입덧': 'ひどいつわり',
};

const LABEL_ZH: Record<string, string> = {
  '38도 이상 발열': '38度以上發燒',
  '고열': '高燒',
  '체온 관련 이모지': '體溫相關表情符號',
  '경련/발작': '抽搐/發作',
  '의식 저하': '意識不清',
  '호흡 곤란': '呼吸困難',
  '혈변 의심': '疑似血便',
  '타르변(흑색변)': '瀝青便(黑便)',
  '백색/회색변': '白色/灰色便',
  '탈수 의심': '疑似脫水',
  '비명성 지속 울음': '持續尖叫般哭鬧',
  '반복 구토': '反覆嘔吐',
  '24시간 이상 식사 거부': '超過24小時拒絕進食',
  '2시간 이상 지속 울음': '持續哭鬧超過2小時',
  '심한 처짐/무기력': '嚴重無力/精神不振',
  '전신 발진': '全身出疹',
  '미열 (37.5~37.9도)': '輕微發燒(37.5~37.9度)',
  '지속 감기 증상': '持續感冒症狀',
  '지속 설사': '持續腹瀉',
  '양수 파수 의심': '疑似破水',
  '조기진통 의심': '疑似早產陣痛',
  '대량 출혈': '大量出血',
  '전자간증 의심': '疑似子癇前症',
  '전자간증 증상(두통+시야변화)': '子癇前症症狀(頭痛+視力變化)',
  '태동 감소/소실': '胎動減少/消失',
  '경련/의식소실': '抽搐/意識喪失',
  '탯줄 탈출 의심': '疑似臍帶脫垂',
  '질 출혈': '陰道出血',
  '규칙적 자궁 수축': '規律性子宮收縮',
  '심한 복통': '嚴重腹痛',
  '급격한 부종': '急遽水腫',
  '소변량 급감': '尿量驟減',
  '심한 구토(임신오조 의심)': '嚴重嘔吐(疑似妊娠劇吐)',
  '혈압 상승': '血壓升高',
  '간헐적 배 뭉침': '間歇性腹部緊繃',
  '비정상 분비물': '異常分泌物',
  '소량 출혈/이슬': '少量出血/落紅',
  '심한 입덧': '嚴重孕吐',
};

function localizeFlagLabel(label: string, locale?: string): string {
  if (locale === 'ja') return LABEL_JA[label] ?? label;
  if (locale === 'zh-Hant') return LABEL_ZH[label] ?? label;
  return label;
}

/**
 * 매칭 전 텍스트 정규화 — 우회 방어:
 *  - NFKC: 전각/반각 통일 (예: '３９도' → '39도')
 *  - 소문자: fever vs FEVER
 *  - 공백 압축: "경 련" → 경련 매칭은 패턴에서 \s* 처리, 여기선 trailing 공백만 제거
 */
function normalizeMessage(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

export function detectRedFlags(message: string, isPregnant = false, locale?: string): RedFlagResult {
  const rules = isPregnant ? PREGNANT_FLAG_RULES : CHILD_FLAG_RULES;
  const flags: string[] = [];
  let highestUrgency: 'emergency' | 'urgent' | 'monitor' | 'none' = 'none';
  const urgencyOrder = { emergency: 3, urgent: 2, monitor: 1, none: 0 };

  const normalized = normalizeMessage(message);
  for (const rule of rules) {
    if (rule.pattern.test(normalized)) {
      flags.push(rule.label);
      if (urgencyOrder[rule.urgency] > urgencyOrder[highestUrgency]) {
        highestUrgency = rule.urgency;
      }
    }
  }

  if (flags.length === 0) {
    return { detected: false, flags: [], urgency: 'none' };
  }

  // 비한국어 로케일이면 사용자에게 보여줄 라벨/메시지만 번역(추가형) — 감지 로직/내부 flags는 무변경
  const displayFlags = flags.map((f) => localizeFlagLabel(f, locale));

  const hospitalLabel = locale === 'ja'
    ? (isPregnant ? '産婦人科や救急外来' : '小児科や救急外来')
    : locale === 'zh-Hant'
      ? (isPregnant ? '婦產科或急診' : '小兒科或急診')
      : (isPregnant ? '산부인과나 응급실' : '소아과나 응급실');
  const clinicLabel = locale === 'ja'
    ? (isPregnant ? '産婦人科' : '小児科')
    : locale === 'zh-Hant'
      ? (isPregnant ? '婦產科' : '小兒科')
      : (isPregnant ? '산부인과' : '소아과');

  const messages: Record<string, string> = locale === 'ja'
    ? {
        emergency: `注意が必要です。${displayFlags.join('、')}の症状がある場合は、まず近くの${hospitalLabel}への受診をおすすめします。以下のアドバイスは参考程度にご覧ください。`,
        urgent: `${displayFlags.join('、')}の症状が見られる場合は、今日中に${clinicLabel}を受診されることをおすすめします。`,
        monitor: `${displayFlags.join('、')}があるのですね。経過を見つつ、悪化するようであれば${clinicLabel}への受診をおすすめします。`,
      }
    : locale === 'zh-Hant'
      ? {
          emergency: `需要留意。若有${displayFlags.join('、')}等症狀，建議先前往附近的${hospitalLabel}就診。以下建議僅供參考。`,
          urgent: `若出現${displayFlags.join('、')}等症狀，建議今天內至${clinicLabel}就診。`,
          monitor: `有${displayFlags.join('、')}的狀況。請先觀察病情變化，若惡化建議前往${clinicLabel}就診。`,
        }
      : {
          emergency: `주의가 필요해요. ${displayFlags.join(', ')} 증상이 있다면, 가까운 ${hospitalLabel} 방문을 먼저 권합니다. 아래 조언은 참고용이에요.`,
          urgent: `${displayFlags.join(', ')} 증상이 보이시면 오늘 중으로 ${clinicLabel} 진료를 받아보시는 게 좋겠어요.`,
          monitor: `${displayFlags.join(', ')}이 있으시군요. 경과를 지켜보시되, 악화되면 ${clinicLabel} 방문을 권합니다.`,
        };

  return {
    detected: true,
    flags: displayFlags,
    urgency: highestUrgency,
    message: messages[highestUrgency],
  };
}
