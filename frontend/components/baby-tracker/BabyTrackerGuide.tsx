/**
 * BabyTrackerGuide — 아기시간 첫 진입 1회 기능 가이드.
 *
 * - 캡처 이미지 없이 "코드 목업형" 비주얼 (RN 컴포넌트로 미니 UI를 직접 그림)
 *   → 사용자가 줄 이미지 없음 + UI 바뀌어도 안 낡음.
 * - 결과 화면은 실제 아기시간 타임라인 카드 스타일을 그대로 흉내냄.
 * - 표시 제어는 부모(baby-tracker)가 담당 (첫 진입 자동 1회 + 헤더 '?' 버튼 재열람).
 *   visible + onClose(건너뛰기/닫기) + onComplete(마지막 '시작하기').
 */
import { View, Text, StyleSheet } from 'react-native';
import { GuideCarousel, type GuidePage } from '../common/GuideCarousel';

/* 세련된 팔레트 (아기시간 톤 + 차분한 뉴트럴) */
const C = {
  bg: '#FFFFFF',
  overlay: 'rgba(22,20,28,0.5)',
  accent: '#F0976C',
  accentSoft: '#FCF1EA',
  diaper: '#7FB1BB',
  diaperLight: '#EDF5F6',
  feeding: '#D8B071',
  feedingLight: '#F8F2E4',
  sleep: '#9D8CC6',
  sleepLight: '#F1EDF8',
  medication: '#7CA46E',
  text: '#2B2B30',
  textSub: '#76767E',
  textLight: '#A6A6AE',
  border: '#ECECF1',
  frame: '#F7F7FA',
  track: '#EEEEF2',
  note: '#FFFCF6',
  noteBorder: '#F0E6D4',
  noteInk: '#6E5C3C',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 마지막 '시작하기'로 완료했을 때 (건너뛰기/닫기와 구분) */
  onComplete?: () => void;
}

/* ── 미니 폰 프레임 ── */
function MockFrame({ children }: { children: React.ReactNode }) {
  return <View style={s.mockFrame}>{children}</View>;
}

/* ── 실제 앱 타임라인 카드 흉내 ── */
function MiniRecord({
  time, label, detail, color, bg,
}: { time: string; label: string; detail?: string; color: string; bg: string }) {
  return (
    <View style={s.recRow}>
      <Text style={s.recTime}>{time}</Text>
      <View style={[s.recCard, { borderLeftColor: color }]}>
        <View style={[s.recTag, { backgroundColor: bg }]}>
          <Text style={[s.recTagText, { color }]}>{label}</Text>
        </View>
        {detail ? <Text style={s.recDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

/* ── Page 1: 4개 탭 ── */
function MockTabs() {
  const tabs = [
    { label: '배변', color: C.diaper },
    { label: '수유·식사', color: C.feeding },
    { label: '수면', color: C.sleep },
    { label: '투약', color: C.medication },
  ];
  return (
    <MockFrame>
      <View style={s.tabRow}>
        {tabs.map((t, i) => (
          <View key={t.label} style={[s.tabChip, { backgroundColor: i === 1 ? t.color : '#EFEFF3' }]}>
            <Text style={[s.tabChipText, i === 1 && { color: '#FFF' }]}>{t.label}</Text>
          </View>
        ))}
      </View>
      <Text style={s.frameCaption}>📋  오늘의 타임라인</Text>
      <MiniRecord time="09:20" label="분유" detail="120ml" color={C.feeding} bg={C.feedingLight} />
      <MiniRecord time="11:00" label="낮잠" detail="1시간 20분" color={C.sleep} bg={C.sleepLight} />
      <MiniRecord time="14:30" label="소변" color={C.diaper} bg={C.diaperLight} />
      <MiniRecord time="15:00" label="이유식" detail="잘 먹음" color={C.feeding} bg={C.feedingLight} />
    </MockFrame>
  );
}

/* ── Page 2: 원터치 / 길게=수정·직접입력 ── */
function MockQuickButtons() {
  return (
    <MockFrame>
      <View style={s.quickRow}>
        <View style={[s.quickBtn, { backgroundColor: '#EBC97E' }]}><Text style={s.quickBtnText}>분유</Text></View>
        <View style={[s.quickBtn, { backgroundColor: '#BCAEDE' }]}><Text style={s.quickBtnText}>수면 시작</Text></View>
        <View style={[s.quickBtn, { backgroundColor: '#96C7D0' }]}><Text style={s.quickBtnText}>소변</Text></View>
      </View>
      <View style={s.tapHint}><Text style={s.tapHintText}>👆  한 번 = 지금 시각으로 기록</Text></View>
      <View style={[s.tapHint, { marginTop: 8 }]}><Text style={s.tapHintText}>✏️  길게 = 시간 수정·직접 입력</Text></View>
      <Text style={s.arrowDown}>↓</Text>
      <MiniRecord time="14:30" label="분유" detail="120ml" color={C.feeding} bg={C.feedingLight} />
    </MockFrame>
  );
}

/* ── Page 3: 음성으로 기록 ── */
function MockVoice() {
  return (
    <MockFrame>
      <View style={s.voiceMicRow}>
        <View style={s.voiceMic}><Text style={{ fontSize: 20 }}>🎤</Text></View>
        <View style={s.voiceBubble}>
          <Text style={s.voiceBubbleText}>
            “분유 백이십 먹였고, 소변 봤고,{'\n'}이유식도 조금, 한 시간쯤 잤어”
          </Text>
        </View>
      </View>
      <Text style={s.arrowDown}>↓</Text>
      <MiniRecord time="09:20" label="분유" detail="120ml" color={C.feeding} bg={C.feedingLight} />
      <MiniRecord time="09:40" label="소변" color={C.diaper} bg={C.diaperLight} />
      <MiniRecord time="11:30" label="이유식" color={C.feeding} bg={C.feedingLight} />
      <MiniRecord time="13:00" label="수면" detail="1시간" color={C.sleep} bg={C.sleepLight} />
    </MockFrame>
  );
}

/* ── Page 4: 진짜 알림장처럼 → AI가 정리 ── */
function MockNote() {
  return (
    <MockFrame>
      <View style={s.noteCard}>
        <View style={s.noteTop}>
          <Text style={s.noteTitle}>🌱 오늘의 알림장</Text>
          <Text style={s.noteDate}>6/2 (화)</Text>
        </View>
        <Text style={s.noteLine}>점심에 이유식 한 그릇 다 먹었어요</Text>
        <Text style={s.noteLine}>1시~2시 반까지 낮잠 푹 잤어요</Text>
        <Text style={s.noteLine}>오후에 응가도 한 번 했어요</Text>
      </View>
      <Text style={s.noteArrow}>↓  AI가 자동으로 정리</Text>
      <MiniRecord time="12:00" label="이유식" detail="점심 다 먹음" color={C.feeding} bg={C.feedingLight} />
      <MiniRecord time="13:00" label="낮잠" detail="13:00 ~ 14:30" color={C.sleep} bg={C.sleepLight} />
      <MiniRecord time="14:40" label="대변" detail="1회" color={C.diaper} bg={C.diaperLight} />
    </MockFrame>
  );
}

/* ── Page 5: 한눈에 보기 ── */
function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <View style={s.refCol}>
      <Text style={s.refLabel}>{label}</Text>
      <Text style={s.refValue}>{value}</Text>
      <View style={s.refTrack}>
        <View style={[s.refFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}
function MockOverview() {
  return (
    <MockFrame>
      <View style={s.refRow}>
        <Bar label="식사 텀" value="2h 10m" pct={75} color={C.accent} />
        <Bar label="일일 분유" value="540ml" pct={68} color={C.feeding} />
        <Bar label="일일 수면" value="13h" pct={90} color={C.sleep} />
      </View>
      <View style={s.weekTable}>
        <View style={s.weekHeaderRow}>
          <Text style={s.weekHcell}>날짜</Text>
          <Text style={s.weekHcell}>분유</Text>
          <Text style={s.weekHcell}>수면</Text>
          <Text style={s.weekHcell}>배변</Text>
        </View>
        {[['오늘', '540', '13h', '3'], ['어제', '600', '12h', '4'], ['그제', '580', '13h', '3']].map((r, i) => (
          <View key={i} style={s.weekDataRow}>
            {r.map((c, j) => (
              <Text key={j} style={[s.weekCell, j === 0 && i === 0 && { color: C.accent, fontWeight: '700' }]}>{c}</Text>
            ))}
          </View>
        ))}
      </View>
      <View style={s.aiInsight}>
        <Text style={s.aiInsightText}>🤖  수면이 권장량에 가까워요. 잘하고 있어요!</Text>
      </View>
    </MockFrame>
  );
}

const PAGES: GuidePage[] = [
  {
    title: '아기시간에 오신 걸 환영해요',
    desc: '배변·수유·수면·투약을 탭별로\n간편하게 기록하고 한눈에 볼 수 있어요',
    visual: <MockTabs />,
  },
  {
    title: '버튼 한 번이면 기록 끝',
    desc: '자주 쓰는 기록은 원터치로,\n길게 누르면 시간 수정·직접 입력도 돼요',
    visual: <MockQuickButtons />,
  },
  {
    title: '말로 여러 개를 한 번에',
    desc: '음성입력 아이콘(앱 안 또는 홈 화면)을 누르고\n말하면 여러 기록도 AI가 한 번에 정리해요',
    visual: <MockVoice />,
  },
  {
    title: '사진 한 장으로 한 번에',
    desc: '어린이집 알림장·메모 사진을 올리면\nAI가 수유·수면·배변을 자동으로 정리해요',
    visual: <MockNote />,
  },
  {
    title: '하루 흐름을 한눈에',
    desc: '권장량 대비 진행, 주간 요약,\nAI 패턴 분석까지 함께 확인하세요',
    visual: <MockOverview />,
  },
];

export function BabyTrackerGuide({ visible, onClose, onComplete }: Props) {
  return <GuideCarousel visible={visible} pages={PAGES} onClose={onClose} onComplete={onComplete} />;
}

const s = StyleSheet.create({
  mockFrame: {
    width: '100%',
    backgroundColor: C.frame,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 16,
    paddingHorizontal: 14,
    height: 282,
    justifyContent: 'center',
    // 어두운 딤 위에서 카드가 '뜨는' 그림자 (iOS shadow* / Android elevation — 각 플랫폼이 지원 속성만 사용)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.34,
    shadowRadius: 30,
    elevation: 16,
  },
  frameCaption: { fontSize: 10.5, fontWeight: '700', color: C.textLight, marginTop: 6, marginBottom: 2, marginLeft: 2 },

  /* 타임라인 카드 */
  recRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  recTime: { fontSize: 11, fontWeight: '700', color: C.textSub, width: 40 },
  recCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, borderLeftWidth: 3,
  },
  recTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  recTagText: { fontSize: 11.5, fontWeight: '700' },
  recDetail: { fontSize: 11.5, fontWeight: '600', color: C.text },

  /* Page 1 */
  tabRow: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  tabChip: { flex: 1, paddingVertical: 7, borderRadius: 12, alignItems: 'center' },
  tabChipText: { fontSize: 10.5, fontWeight: '700', color: C.textSub },

  /* Page 2 */
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  quickBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  quickBtnText: { fontSize: 12, fontWeight: '800', color: '#5C564E' },
  tapHint: { backgroundColor: '#FFF', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  tapHintText: { fontSize: 12, fontWeight: '600', color: C.textSub },

  /* Page 3 */
  voiceMicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  voiceMic: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentSoft,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.accent,
  },
  voiceBubble: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border },
  voiceBubbleText: { fontSize: 12, color: C.text, fontWeight: '600', lineHeight: 17 },
  arrowDown: { fontSize: 16, color: C.textLight, textAlign: 'center', marginVertical: 4, fontWeight: '800' },

  /* Page 4 — 알림장 */
  noteCard: {
    backgroundColor: C.note, borderRadius: 12, borderWidth: 1, borderColor: C.noteBorder,
    paddingVertical: 9, paddingHorizontal: 12, marginBottom: 2,
  },
  noteTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: C.noteBorder, paddingBottom: 5, marginBottom: 5,
  },
  noteTitle: { fontSize: 12, fontWeight: '800', color: C.noteInk },
  noteDate: { fontSize: 10.5, fontWeight: '700', color: C.textLight },
  noteLine: { fontSize: 11.5, color: '#4E4A40', lineHeight: 18 },
  noteArrow: { fontSize: 11.5, color: C.textSub, textAlign: 'center', marginVertical: 6, fontWeight: '700' },

  /* Page 5 */
  refRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  refCol: { flex: 1 },
  refLabel: { fontSize: 9.5, fontWeight: '700', color: C.textSub, marginBottom: 2 },
  refValue: { fontSize: 12, fontWeight: '800', color: C.text },
  refTrack: { height: 4, backgroundColor: C.track, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  refFill: { height: '100%', borderRadius: 2 },
  weekTable: { backgroundColor: '#FFF', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: C.border },
  weekHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 4 },
  weekHcell: { flex: 1, fontSize: 9.5, fontWeight: '700', color: C.textLight, textAlign: 'center' },
  weekDataRow: { flexDirection: 'row', paddingVertical: 4 },
  weekCell: { flex: 1, fontSize: 11, fontWeight: '600', color: C.text, textAlign: 'center' },
  aiInsight: { backgroundColor: C.accentSoft, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginTop: 10 },
  aiInsightText: { fontSize: 11, fontWeight: '700', color: '#C2703B', textAlign: 'center' },
});
