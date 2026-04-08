import { RedFlagResult } from './types';

interface FlagRule {
  pattern: RegExp;
  label: string;
  urgency: 'emergency' | 'urgent' | 'monitor';
}

const FLAG_RULES: FlagRule[] = [
  // ─── Emergency (즉시 병원) ───
  { pattern: /(?:열|체온).*(?:3[89]|4[01])\s*도/i, label: '38도 이상 발열', urgency: 'emergency' },
  { pattern: /(?:3[89]|4[01])(?:\.\d)?\s*도/, label: '고열', urgency: 'emergency' },
  { pattern: /경련|발작|경기/, label: '경련/발작', urgency: 'emergency' },
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

export function detectRedFlags(message: string): RedFlagResult {
  const flags: string[] = [];
  let highestUrgency: 'emergency' | 'urgent' | 'monitor' | 'none' = 'none';
  const urgencyOrder = { emergency: 3, urgent: 2, monitor: 1, none: 0 };

  for (const rule of FLAG_RULES) {
    if (rule.pattern.test(message)) {
      flags.push(rule.label);
      if (urgencyOrder[rule.urgency] > urgencyOrder[highestUrgency]) {
        highestUrgency = rule.urgency;
      }
    }
  }

  if (flags.length === 0) {
    return { detected: false, flags: [], urgency: 'none' };
  }

  const messages: Record<string, string> = {
    emergency: `주의가 필요해요. ${flags.join(', ')} 증상이 있다면, 가까운 소아과나 응급실 방문을 먼저 권합니다. 아래 조언은 참고용이에요.`,
    urgent: `${flags.join(', ')} 증상이 보이시면 오늘 중으로 소아과 진료를 받아보시는 게 좋겠어요.`,
    monitor: `${flags.join(', ')}이 있으시군요. 경과를 지켜보시되, 악화되면 소아과 방문을 권합니다.`,
  };

  return {
    detected: true,
    flags,
    urgency: highestUrgency,
    message: messages[highestUrgency],
  };
}
