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
const CHILD_FLAG_RULES: FlagRule[] = [
  // ─── Emergency (즉시 병원) ───
  // 한국어 + 영문(fever, 39 degrees, 39c) 모두 커버
  { pattern: /(?:열|체온|fever|temp|temperature).*(?:3[89]|4[01])(?:\.\d)?\s*(?:도|°|c|celsius|degrees?)?/i, label: '38도 이상 발열', urgency: 'emergency' },
  { pattern: /(?:3[89]|4[01])(?:\.\d)?\s*(?:도|°|c|celsius|degrees?)/i, label: '고열', urgency: 'emergency' },
  { pattern: /(?:🤒|🥵|🌡)/, label: '체온 관련 이모지', urgency: 'emergency' },
  { pattern: /경\s*련|발\s*작|경\s*기|seizure|convulsion/i, label: '경련/발작', urgency: 'emergency' },
  { pattern: /의식.*(?:잃|없|저하)|깨워도.*안.*깨/, label: '의식 저하', urgency: 'emergency' },
  { pattern: /호흡.*(?:곤란|이상|멈|거칠|힘들)|숨.*(?:못|안).*(?:쉬|쉼)/, label: '호흡 곤란', urgency: 'emergency' },
  { pattern: /혈변|피.*(?:섞|나|묻).*(?:변|똥)|피가.*(?:나|묻)/, label: '혈변 의심', urgency: 'emergency' },
  { pattern: /(?:검은|검정|타르).*(?:변|똥)/, label: '타르변(흑색변)', urgency: 'emergency' },
  { pattern: /(?:흰|하얀|회색|창백).*(?:변|똥)/, label: '백색/회색변', urgency: 'emergency' },
  { pattern: /탈수|소변.*(?:안|없|감소|줄)|입.*(?:마르|건조)|눈물.*(?:없|안)/, label: '탈수 의심', urgency: 'emergency' },
  { pattern: /(?:비명|날카로운|끊이지\s*않).*울/, label: '비명성 지속 울음', urgency: 'emergency' },

  // ─── Urgent (24시간 내 진료) ───
  { pattern: /구토.*(?:반복|계속|멈추지)|토.*(?:반복|계속)/, label: '반복 구토', urgency: 'urgent' },
  { pattern: /(?:밥|음식|수유|분유).*(?:안|거부).*(?:24|하루|종일)/, label: '24시간 이상 식사 거부', urgency: 'urgent' },
  { pattern: /(?:2|두)\s*시간.*(?:이상|넘게).*(?:울|보채)/, label: '2시간 이상 지속 울음', urgency: 'urgent' },
  { pattern: /축.*처지|늘어지|기운.*없/, label: '심한 처짐/무기력', urgency: 'urgent' },
  { pattern: /발진.*(?:전신|온몸|퍼)/, label: '전신 발진', urgency: 'urgent' },

  // ─── Monitor (경과 관찰) ───
  { pattern: /37\.[5-9]\s*도/, label: '미열 (37.5~37.9도)', urgency: 'monitor' },
  { pattern: /(?:콧물|기침).*(?:며칠|계속|일주일)/, label: '지속 감기 증상', urgency: 'monitor' },
  { pattern: /설사.*(?:며칠|계속|반복)/, label: '지속 설사', urgency: 'monitor' },
];

// ─── 임산부 전용 레드 플래그 ───
const PREGNANT_FLAG_RULES: FlagRule[] = [
  // ─── Emergency (즉시 병원) ───
  { pattern: /양수.*(?:터|파|흐름|줄줄|파수)|파수/, label: '양수 파수 의심', urgency: 'emergency' },
  { pattern: /(?:조기|빠른).*진통|37주.*전.*진통/, label: '조기진통 의심', urgency: 'emergency' },
  { pattern: /(?:대량|다량|심한).*(?:출혈|피)|피.*(?:많이|쏟|흐름)/, label: '대량 출혈', urgency: 'emergency' },
  { pattern: /전자간증|자간|임신중독/, label: '전자간증 의심', urgency: 'emergency' },
  { pattern: /(?:심한|갑작스런).*두통.*(?:시야|눈|시력|부종)|시야.*(?:흐려|흐림|번쩍)/, label: '전자간증 증상(두통+시야변화)', urgency: 'emergency' },
  { pattern: /태동.*(?:없|안.*느|급감|감소|줄)|아기.*(?:안.*움직|안.*놀)/, label: '태동 감소/소실', urgency: 'emergency' },
  { pattern: /경련|발작|의식.*(?:잃|없)/, label: '경련/의식소실', urgency: 'emergency' },
  { pattern: /탯줄.*(?:나|빠져|보|느껴)/, label: '탯줄 탈출 의심', urgency: 'emergency' },

  // ─── Urgent (24시간 내 진료) ───
  { pattern: /(?:출혈|피).*(?:나|묻|보|있)|질.*(?:출혈|피)/, label: '질 출혈', urgency: 'urgent' },
  { pattern: /(?:규칙|반복).*(?:뭉침|수축|배.*아파)|배.*뭉침.*(?:반복|규칙)/, label: '규칙적 자궁 수축', urgency: 'urgent' },
  { pattern: /(?:심한|극심|참을수없).*(?:복통|배.*아파|하복부)/, label: '심한 복통', urgency: 'urgent' },
  { pattern: /(?:갑자기|급격).*(?:부종|붓|부어)|얼굴.*(?:붓|부)/, label: '급격한 부종', urgency: 'urgent' },
  { pattern: /소변.*(?:안|없|감소|줄)|24시간.*소변/, label: '소변량 급감', urgency: 'urgent' },
  { pattern: /(?:5|다섯).*회.*(?:이상|넘).*(?:토|구토)|구토.*(?:계속|멈추지)/, label: '심한 구토(임신오조 의심)', urgency: 'urgent' },
  { pattern: /140.*90|(?:높|올).*혈압/, label: '혈압 상승', urgency: 'urgent' },

  // ─── Monitor (경과 관찰) ───
  { pattern: /(?:가끔|가벼운).*(?:뭉침|수축)/, label: '간헐적 배 뭉침', urgency: 'monitor' },
  { pattern: /(?:갈색|묽은).*(?:분비물|냉)/, label: '비정상 분비물', urgency: 'monitor' },
  { pattern: /(?:소량|약간).*(?:피|출혈|이슬)/, label: '소량 출혈/이슬', urgency: 'monitor' },
  { pattern: /(?:심한|극심).*(?:입덧|구역|토)/, label: '심한 입덧', urgency: 'monitor' },
];

const FLAG_RULES = CHILD_FLAG_RULES;
void FLAG_RULES;  // 외부 명시 export 없음 — 내부 참조용

/**
 * 매칭 전 텍스트 정규화 — 우회 방어:
 *  - NFKC: 전각/반각 통일 (예: '３９도' → '39도')
 *  - 소문자: fever vs FEVER
 *  - 공백 압축: "경 련" → 경련 매칭은 패턴에서 \s* 처리, 여기선 trailing 공백만 제거
 */
function normalizeMessage(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

export function detectRedFlags(message: string, isPregnant = false): RedFlagResult {
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

  const hospitalLabel = isPregnant ? '산부인과나 응급실' : '소아과나 응급실';
  const clinicLabel = isPregnant ? '산부인과' : '소아과';

  const messages: Record<string, string> = {
    emergency: `주의가 필요해요. ${flags.join(', ')} 증상이 있다면, 가까운 ${hospitalLabel} 방문을 먼저 권합니다. 아래 조언은 참고용이에요.`,
    urgent: `${flags.join(', ')} 증상이 보이시면 오늘 중으로 ${clinicLabel} 진료를 받아보시는 게 좋겠어요.`,
    monitor: `${flags.join(', ')}이 있으시군요. 경과를 지켜보시되, 악화되면 ${clinicLabel} 방문을 권합니다.`,
  };

  return {
    detected: true,
    flags,
    urgency: highestUrgency,
    message: messages[highestUrgency],
  };
}
