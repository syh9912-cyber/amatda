export interface OnboardingQuestion {
  id: string;
  text: string;
  category: string;
  options: string[];
}

export type AgeGroup = 'infant' | 'kinder' | 'elem_low' | 'elem_high';

export function getAgeGroup(months: number): AgeGroup {
  if (months <= 36) return 'infant';
  if (months <= 72) return 'kinder';
  if (months <= 108) return 'elem_low';
  return 'elem_high';
}

export const FALLBACK_QUESTIONS: OnboardingQuestion[] = [
  { id: 'q1', category: '사회성', text: '새로운 장소에 가면?', options: ['바로 탐험한다', '부모 옆에 있는다', '관찰 후 합류한다', '불안해한다'] },
  { id: 'q2', category: '사회성', text: '친구와 놀 때?', options: ['리더 역할을 한다', '양보하는 편이다', '혼자 놀기를 좋아한다', '관찰하는 편이다'] },
  { id: 'q3', category: '정서', text: '실패했을 때 반응은?', options: ['바로 다시 시도한다', '속상해한다', '쉽게 포기한다', '도움을 요청한다'] },
  { id: 'q4', category: '놀이', text: '좋아하는 놀이는?', options: ['활동적인 놀이', '그림/만들기', '퍼즐/게임', '역할놀이'] },
  { id: 'q5', category: '학습', text: '새로운 것을 배울 때?', options: ['직접 해본다', '설명을 듣는다', '영상/책으로 본다', '친구와 함께 한다'] },
  { id: 'q6', category: '정서', text: '감정 표현 방식은?', options: ['크게 표현한다', '조용히 표현한다', '말로 설명한다', '몸으로 표현한다'] },
  { id: 'q7', category: '집중력', text: '집중하는 시간은?', options: ['매우 길게', '보통 수준', '짧은 편', '관심 있는 것만 길게'] },
  { id: 'q8', category: '생활습관', text: '규칙에 대한 태도는?', options: ['잘 따르는 편', '바꾸려고 한다', '따르기 어려워한다', '왜 그런지 물어본다'] },
  { id: 'q9', category: '정서', text: '스트레스를 받으면?', options: ['혼자 있고 싶어한다', '운동/활동을 한다', '부모에게 말한다', '다른 활동으로 전환'] },
  { id: 'q10', category: '가치관', text: '가장 소중하게 여기는 것은?', options: ['가족', '친구', '자기만의 공간', '반려동물/인형'] },
  { id: 'q11', category: '생활습관', text: '아침에 일어나는 모습은?', options: ['스스로 잘 일어난다', '깨워야 일어난다', '기분에 따라 다르다', '일찍 일어나는 편'] },
  { id: 'q12', category: '동기부여', text: '싫은 일을 해야 할 때?', options: ['빨리 끝낸다', '미루는 편이다', '불평을 한다', '보상이 있으면 한다'] },
  { id: 'q13', category: '창의성', text: '그림을 그릴 때?', options: ['상상의 세계를 그린다', '본 것을 따라 그린다', '추상적으로 그린다', '그리기를 별로 안 한다'] },
  { id: 'q14', category: '사회성', text: '낯선 사람을 만나면?', options: ['먼저 인사한다', '부끄러워한다', '무관심하다', '경계한다'] },
  { id: 'q15', category: '학습', text: '책을 읽을 때?', options: ['혼자 집중해서 읽는다', '읽어달라고 한다', '그림만 본다', '책보다 다른 걸 한다'] },
  { id: 'q16', category: '신체', text: '운동이나 신체활동은?', options: ['매우 활발하다', '보통이다', '조용한 활동 선호', '특정 운동만 좋아한다'] },
  { id: 'q17', category: '정서', text: '화가 나면?', options: ['크게 소리친다', '울음으로 표현한다', '참으려 한다', '물건을 던진다'] },
  { id: 'q18', category: '놀이', text: '장난감을 고를 때?', options: ['새로운 것을 고른다', '익숙한 것을 고른다', '고르기 어려워한다', '여러 개를 한번에 고른다'] },
  { id: 'q19', category: '집중력', text: '숙제나 과제를 할 때?', options: ['스스로 척척 한다', '도움이 필요하다', '미루다 한다', '완벽하게 하려 한다'] },
  { id: 'q20', category: '가치관', text: '커서 되고 싶은 것은?', options: ['확실히 정해져 있다', '자주 바뀐다', '잘 모르겠다', '여러 가지 하고 싶다'] },
];
