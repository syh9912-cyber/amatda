/**
 * 임신 여정 상세 페이지 — 5단계별 필수 정보 매핑
 *
 * 단계: early(1-12주) / 12wk(12주 검진) / stable(13-24주) / late(25-37주) / birth(38주+)
 *
 * 각 단계별로 영양제 / 운동 / 식단 / 주의사항 / 검사 / 마일스톤 정리.
 *
 * 모든 정보는 일반 안내 — 의료적 결정은 산부인과 권유.
 */

import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Stage = 'early' | 'wk12' | 'stable' | 'late' | 'birth';

interface CategoryItem {
  emoji: string;
  title: string;
  body: string;
}

interface StageContent {
  label: string;
  weeks: string;
  hero: string;        // 섹션 진입 헤드라인
  heroSub: string;
  /** 카테고리별 항목 묶음 */
  sections: { title: string; items: CategoryItem[] }[];
}

const COLOR = {
  bg: '#FCF6F2',
  card: '#FFFFFF',
  border: '#FFE0CC',
  text: '#1C1C1E',
  textSub: '#636366',
  pink: '#E91E63',
  pinkBg: '#FCE4EC',
  accent: '#FF8C5A',
  warmYellow: '#FFF8E1',
};

/* ────────────────────────────────────────────────────────────────────
 * 단계별 콘텐츠 (임신 일반 안내 — 한국 가이드라인 기반)
 * ──────────────────────────────────────────────────────────────────── */
const STAGE_CONTENT: Record<Stage, StageContent> = {
  early: {
    label: '초기',
    weeks: '1-12주',
    hero: '엄마, 첫 시작이에요',
    heroSub: '몸이 가장 예민한 시기. 무리하지 말고 천천히.',
    sections: [
      {
        title: '💊 영양제',
        items: [
          { emoji: '🌿', title: '엽산 (필수)', body: '하루 400-800㎍. 신경관 결손 예방. 임신 1주 전부터 12주까지 핵심.' },
          { emoji: '💊', title: '비타민 D', body: '하루 600-1000IU. 뼈와 면역 형성에 필수.' },
          { emoji: '🐟', title: '오메가-3 (DHA)', body: '주 2회 등푸른 생선 또는 보충제. 태아 뇌 발달.' },
        ],
      },
      {
        title: '🍽️ 식단',
        items: [
          { emoji: '🥬', title: '엽산 식품', body: '시금치, 브로콜리, 아스파라거스, 콩, 아보카도, 오렌지' },
          { emoji: '🥛', title: '단백질 + 칼슘', body: '계란, 두부, 살코기, 우유, 요거트' },
          { emoji: '🚫', title: '피해야 할 것', body: '날 음식, 카페인 200mg 이상, 술, 흡연, 비살균 우유/치즈' },
        ],
      },
      {
        title: '🚶 운동',
        items: [
          { emoji: '🚶‍♀️', title: '걷기', body: '하루 20-30분 가벼운 산책. 무리하지 말 것.' },
          { emoji: '🧘', title: '임산부 요가', body: '주 1-2회. 호흡과 골반 이완 동작 위주.' },
          { emoji: '⛔', title: '주의', body: '복부에 충격 가는 운동 / 격렬한 트레이닝 금지' },
        ],
      },
      {
        title: '🩺 검사',
        items: [
          { emoji: '📅', title: '첫 산부인과 방문', body: '임신 6-8주 권장. 자궁 내 임신 확인 + 심장박동.' },
          { emoji: '🩸', title: '초기 혈액 검사', body: '풍진 면역 / B형간염 / 빈혈 / 갑상선' },
          { emoji: '📸', title: '첫 정밀 초음파', body: '11-13주. NT 검사 (목 투명대 두께).' },
        ],
      },
      {
        title: '💗 주의사항',
        items: [
          { emoji: '🤢', title: '입덧', body: '6-12주에 절정. 자주 적게 먹기, 따뜻한 음료, 비타민 B6 도움.' },
          { emoji: '😴', title: '극심한 피로', body: '몸이 보내는 신호. 충분한 수면 (7-9시간).' },
          { emoji: '⚠️', title: '병원 즉시 연락', body: '심한 출혈 / 38℃ 이상 발열 / 격렬한 복통' },
        ],
      },
    ],
  },

  wk12: {
    label: '12주 검진',
    weeks: '12주 전후',
    hero: '첫 정밀 초음파 시기',
    heroSub: 'NT 검사로 태아 건강 처음 확인하는 중요한 시점.',
    sections: [
      {
        title: '🩺 핵심 검사',
        items: [
          { emoji: '📸', title: 'NT 검사 (목 투명대)', body: '11-13주 6일 사이. 다운증후군 등 염색체 이상 1차 선별.' },
          { emoji: '🩸', title: '통합 선별 검사', body: 'NT + 혈액 검사 결합. 정확도 높음.' },
          { emoji: '🧬', title: 'NIPT (선택)', body: '비침습 산전 유전 검사. 35세 이상 권장.' },
        ],
      },
      {
        title: '💗 알아둘 변화',
        items: [
          { emoji: '🌅', title: '입덧 진정', body: '12주 즈음부터 점차 가라앉음.' },
          { emoji: '⚖️', title: '체중 증가 시작', body: '주당 0.4-0.5kg 권장. 영양 균형 중요.' },
          { emoji: '🤰', title: '자궁 위치', body: '치골 위로 올라옴. 배가 살짝 나오기 시작.' },
        ],
      },
      {
        title: '✅ 이번 시기 체크',
        items: [
          { emoji: '🏥', title: '산부인과 정기 체크', body: '4주마다 1회 (28주까지).' },
          { emoji: '👔', title: '회사 보고 (선택)', body: '안정기 진입 시점. 출산휴가 일정 미리 확인.' },
          { emoji: '📚', title: '임신 책/유튜브', body: '믿을 만한 의료 콘텐츠로 학습.' },
        ],
      },
    ],
  },

  stable: {
    label: '안정기',
    weeks: '13-24주',
    hero: '엄마, 가장 컨디션 좋은 시기예요',
    heroSub: '입덧이 가라앉고 태동을 처음 느끼는 시기.',
    sections: [
      {
        title: '💊 영양제',
        items: [
          { emoji: '🦴', title: '칼슘', body: '하루 1000mg. 태아 뼈 형성 본격화.' },
          { emoji: '🩸', title: '철분', body: '하루 30mg. 빈혈 예방. 비타민 C와 함께 흡수율 ↑.' },
          { emoji: '🐟', title: 'DHA 지속', body: '태아 뇌 발달 핵심 시기.' },
        ],
      },
      {
        title: '🍽️ 식단',
        items: [
          { emoji: '🥩', title: '단백질 늘리기', body: '하루 75-100g. 살코기, 생선, 콩, 두부, 계란.' },
          { emoji: '🥕', title: '비타민 A', body: '당근, 시금치, 고구마, 브로콜리.' },
          { emoji: '🧂', title: '나트륨 조절', body: '부종 예방을 위해 짠 음식 줄이기.' },
        ],
      },
      {
        title: '🚶 운동',
        items: [
          { emoji: '🏊', title: '임산부 수영', body: '관절 부담 적고 부종 완화. 주 2-3회.' },
          { emoji: '🧘', title: '임산부 요가/필라테스', body: '주 2-3회. 골반 근육과 호흡 강화.' },
          { emoji: '🚶‍♀️', title: '걷기 늘리기', body: '하루 30-45분. 출산 체력 준비.' },
        ],
      },
      {
        title: '🩺 검사',
        items: [
          { emoji: '🧪', title: '쿼드 검사', body: '15-20주. 4가지 호르몬으로 기형 선별.' },
          { emoji: '📸', title: '정밀 초음파', body: '20-24주. 태아 장기 발달 정밀 확인. 성별도 확인 가능.' },
          { emoji: '🩸', title: '임당 1차 검사', body: '24-28주. 1시간 포도당 검사.' },
        ],
      },
      {
        title: '✨ 즐길 것들',
        items: [
          { emoji: '🦶', title: '첫 태동', body: '16-22주 사이. 처음엔 가스 같은 감각.' },
          { emoji: '🎵', title: '태교 시작', body: '음악 듣기 / 책 읽어주기 / 대화하기.' },
          { emoji: '📷', title: '만삭 사진 (선택)', body: '20주 즈음 첫 임신 사진 기록.' },
        ],
      },
    ],
  },

  late: {
    label: '후기',
    weeks: '25-37주',
    hero: '출산이 가까워지고 있어요',
    heroSub: '몸이 무거워지지만 태교의 황금기.',
    sections: [
      {
        title: '💊 영양제',
        items: [
          { emoji: '🦴', title: '칼슘 + 비타민 D', body: '태아 골격 완성기. 산모 골다공증 예방.' },
          { emoji: '🩸', title: '철분 강화', body: '출산 시 출혈 대비. 하루 30-60mg.' },
          { emoji: '🥥', title: '마그네슘', body: '쥐남(다리 경련) 예방.' },
        ],
      },
      {
        title: '🍽️ 식단',
        items: [
          { emoji: '🍚', title: '소량 자주', body: '위가 눌려 한 번에 많이 못 먹음. 5-6끼로 나누기.' },
          { emoji: '🌾', title: '식이섬유', body: '변비 예방. 통곡물, 과일, 채소.' },
          { emoji: '💧', title: '수분 충분히', body: '하루 2L 이상. 부종 + 변비 예방.' },
        ],
      },
      {
        title: '🚶 운동',
        items: [
          { emoji: '🤸‍♀️', title: '케겔 운동', body: '골반저 근육 강화. 출산 + 산후 회복에 핵심.' },
          { emoji: '🧘', title: '호흡 훈련', body: '진통 호흡법 연습 (1초 들숨, 2초 날숨).' },
          { emoji: '🚶‍♀️', title: '가벼운 걷기', body: '하루 20-30분. 골반 자극으로 출산 준비.' },
        ],
      },
      {
        title: '🩺 검사',
        items: [
          { emoji: '👶', title: '태아 성장 초음파', body: '28-32주. 체중·자세 확인.' },
          { emoji: '🦠', title: 'GBS 검사', body: '35-37주. 산도 세균 검사. 양성이면 항생제.' },
          { emoji: '💉', title: 'Tdap 백신', body: '27-36주. 신생아 백일해 예방.' },
        ],
      },
      {
        title: '🧳 출산 준비',
        items: [
          { emoji: '🧳', title: '출산가방', body: '32주 즈음 미리 준비. 산모/아기 용품 + 서류.' },
          { emoji: '🏥', title: '병원 등록', body: '분만 병원 + 응급 연락처 / 이동 경로 확인.' },
          { emoji: '🏠', title: '아기방 세팅', body: '아기 침대, 카시트, 기저귀, 분유/모유용품.' },
        ],
      },
      {
        title: '⚠️ 주의 신호',
        items: [
          { emoji: '🦵', title: '심한 부종', body: '얼굴/손 부종 + 두통은 전자간증 의심. 즉시 병원.' },
          { emoji: '👶', title: '태동 감소', body: '평소보다 현저히 줄면 즉시 병원 연락.' },
          { emoji: '💧', title: '양수 누출', body: '맑은 물 흐르면 조기 양막 파수. 즉시 병원.' },
        ],
      },
    ],
  },

  birth: {
    label: '출산',
    weeks: '38주+',
    hero: '곧 만나요!',
    heroSub: '진통이 시작되면 침착하게 병원으로.',
    sections: [
      {
        title: '⏱️ 진통 신호',
        items: [
          { emoji: '🌊', title: '규칙적 진통', body: '5분 간격 1분 지속이 1시간 → 병원으로.' },
          { emoji: '🩸', title: '이슬', body: '점액성 분비물 (피 섞일 수 있음). 며칠 안에 진통.' },
          { emoji: '💦', title: '양수 파열', body: '맑은 물 흐름. 시간 기록 후 즉시 병원.' },
        ],
      },
      {
        title: '🧳 출산가방 최종 체크',
        items: [
          { emoji: '📋', title: '서류', body: '신분증, 산모수첩, 보험증, 출산준비물 리스트' },
          { emoji: '👕', title: '산모 용품', body: '산모복, 수유복, 슬리퍼, 세면도구, 생리대' },
          { emoji: '👶', title: '아기 용품', body: '배냇저고리, 손싸개, 모자, 양말, 카시트' },
        ],
      },
      {
        title: '🫁 호흡법',
        items: [
          { emoji: '🌬️', title: '초기 진통', body: '천천히 깊게 - 코로 들이쉬고 입으로 내쉬기' },
          { emoji: '😤', title: '강한 진통', body: '짧고 빠르게 - "후-후-후" 헐떡이듯' },
          { emoji: '💪', title: '밀어내기', body: '의료진 지시 따라. 숨 참고 5초씩 3번.' },
        ],
      },
      {
        title: '🏥 병원 도착 후',
        items: [
          { emoji: '📝', title: '입원 절차', body: '응급실 또는 분만실 → 자궁 개대 확인' },
          { emoji: '💉', title: '무통 분만 (선택)', body: '자궁 개대 4-5cm에서 시작 가능.' },
          { emoji: '🤝', title: '도와줄 사람', body: '남편/가족 동행. 마사지/물 챙겨줄 사람 필요.' },
        ],
      },
      {
        title: '💖 출산 직후',
        items: [
          { emoji: '👶', title: '캥거루 케어', body: '출산 직후 1시간 피부 접촉. 모유 첫수유.' },
          { emoji: '🤱', title: '초유', body: '면역 항체 가득. 빠를수록 좋음.' },
          { emoji: '🏥', title: '산후 입원', body: '자연분만 2-3일 / 제왕절개 5-7일.' },
        ],
      },
    ],
  },
};

const STAGE_LABELS: Record<Stage, string> = {
  early: '초기 (1-12주)',
  wk12: '12주 검진',
  stable: '안정기 (13-24주)',
  late: '후기 (25-37주)',
  birth: '출산 (38주+)',
};

export default function PregnancyJourneyDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const stageParam = (params.stage as string) ?? 'stable';
  const stage: Stage = (['early', 'wk12', 'stable', 'late', 'birth'].includes(stageParam)
    ? stageParam
    : 'stable') as Stage;
  const content = STAGE_CONTENT[stage];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: STAGE_LABELS[stage],
          headerStyle: { backgroundColor: COLOR.bg },
          headerTitleStyle: { fontSize: 16, fontWeight: '900', color: COLOR.text },
          headerTintColor: COLOR.pink,
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{content.weeks}</Text>
          </View>
          <Text style={styles.heroTitle}>{content.hero}</Text>
          <Text style={styles.heroSub}>{content.heroSub}</Text>
        </View>

        {/* 섹션들 */}
        {content.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <View
                  key={item.title}
                  style={[
                    styles.itemRow,
                    idx < section.items.length - 1 && styles.itemRowDivider,
                  ]}
                >
                  <Text style={styles.itemEmoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemBody}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ 이 정보는 일반 안내입니다. 모든 의료적 결정은 산부인과 전문의와 상담하세요.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'flex-start',
  },
  heroBadge: {
    backgroundColor: COLOR.pinkBg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLOR.pink,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLOR.text,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    color: COLOR.textSub,
    fontWeight: '600',
    lineHeight: 19,
  },

  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLOR.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: COLOR.card,
    borderRadius: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  itemRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F4ECE6',
  },
  itemEmoji: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
    marginTop: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLOR.text,
    marginBottom: 3,
  },
  itemBody: {
    fontSize: 12,
    color: COLOR.textSub,
    fontWeight: '500',
    lineHeight: 17,
  },

  disclaimer: {
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#7E5400',
    fontWeight: '700',
    lineHeight: 16,
  },
});
