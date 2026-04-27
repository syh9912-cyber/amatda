import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '개인정보 처리방침', headerShown: true }} />

      <Text style={styles.heading}>개인정보 처리방침</Text>
      <Text style={styles.meta}>
        시행일: 2026년 4월 5일{'\n'}
        회사명: SY Labs{'\n'}
        서비스명: 아맞다 (아이맞춤다이어리)
      </Text>

      <Text style={styles.intro}>
        SY Labs(이하 &quot;회사&quot;)는 「개인정보 보호법」에 따라 이용자의
        개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수
        있도록 다음과 같이 개인정보 처리방침을 수립하여 공개합니다.
      </Text>

      <Section title="1. 개인정보 수집 항목">
        {`회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.

[필수 수집 항목]
- 이메일 주소 (회원 식별 및 로그인)
- 비밀번호 해시값 (계정 보안, 원문 저장하지 않음)
- 자녀 정보: 이름, 생년월일, 성별, 출생시각 (기질 분석 및 맞춤 서비스)

[선택 수집 항목]
- 관찰 일기 내용 (텍스트, 성장 기록 및 AI 분석)
- 사진 (프로필 사진, 성장 앨범)
- 위치 정보 (주변 학원 추천, 사용 시에만 수집)

[자동 수집 항목]
- 기기 정보 (OS 버전, 앱 버전, 기기 식별자)
- 서비스 이용 기록 (접속 일시, 이용 기능)`}
      </Section>

      <Section title="2. 수집 목적">
        {`회사는 수집한 개인정보를 다음 목적으로 이용합니다.

- 아이의 고유 기질 분석 및 맞춤형 육아 솔루션 제공
- 연령별 맞춤 교육, 영양, 활동 추천
- 성장 기록 관리 (관찰 일기, 성장 앨범)
- 회원 관리 및 본인 확인
- 서비스 개선 및 신규 기능 개발
- 고객 문의 및 불만 처리

수집된 개인정보는 위 목적 외의 용도로 사용하지 않으며, 목적이 변경될 경우 사전에 동의를 구합니다.`}
      </Section>

      <Section title="3. 보관 기간 및 파기">
        {`- 회원 탈퇴 시: 모든 개인정보를 즉시 삭제합니다.
- 자녀 정보 삭제 요청 시: 해당 자녀의 모든 관련 데이터(관찰 일기, 사진, 분석 결과)를 즉시 삭제합니다.

[법정 보관 의무에 따른 예외]
- 전자상거래 등에서의 소비자보호에 관한 법률에 따라 계약 또는 청약철회 등에 관한 기록: 5년
- 대금 결제 및 재화 등의 공급에 관한 기록: 5년
- 소비자의 불만 또는 분쟁 처리에 관한 기록: 3년
- 통신비밀보호법에 따른 로그 기록: 3개월

파기 방법: 전자적 파일 형태의 정보는 복구 불가능한 방법으로 영구 삭제하며, 종이 문서는 분쇄하여 파기합니다.`}
      </Section>

      <Section title="4. 제3자 제공">
        {`회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다.

다만, 다음의 경우에는 예외로 합니다:
- 이용자가 사전에 동의한 경우
- 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우

[AI 분석 시 데이터 처리]
- AI 기질 분석 및 맞춤 추천 시 아이의 실명을 마스킹 처리하여 외부 AI 서비스(Google Gemini)에 전송합니다.
- 마스킹된 데이터에서는 개인을 식별할 수 없습니다.
- AI 서비스 제공자는 전송된 데이터를 학습 목적으로 사용하지 않습니다.`}
      </Section>

      <Section title="5. 아동 개인정보 보호">
        {`회사는 만 14세 미만 아동의 개인정보를 수집할 때 법정대리인(부모 등)의 동의를 받습니다.

- 본 서비스는 부모(법정대리인)가 자녀의 정보를 등록하고 관리하는 서비스입니다.
- 자녀의 개인정보는 법정대리인의 동의 하에 수집되며, 법정대리인은 언제든지 자녀의 개인정보 열람, 수정, 삭제를 요청할 수 있습니다.
- 만 14세 미만 아동이 직접 서비스에 가입하는 것은 허용하지 않습니다.
- 법정대리인의 동의 없이 수집된 아동의 개인정보는 즉시 파기합니다.`}
      </Section>

      <Section title="6. 이용자의 권리 및 행사 방법">
        {`이용자(또는 법정대리인)는 다음의 권리를 행사할 수 있습니다.

- 개인정보 열람 요청
- 개인정보 수정 요청
- 개인정보 삭제 요청
- 개인정보 처리 정지 요청
- 회원 탈퇴 및 전체 데이터 삭제 요청

권리 행사 방법:
- 앱 내 [더보기 > 설정 > 계정 삭제]를 통해 직접 처리
- 이메일 요청: privacy@sylabs.kr
- 회사는 요청을 받은 날로부터 10일 이내에 처리합니다.`}
      </Section>

      <Section title="7. 개인정보 보호 책임자">
        {`회사는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 이용자의 불만 처리 및 피해 구제를 위해 아래와 같이 개인정보 보호 책임자를 지정하고 있습니다.

개인정보 보호 책임자
- 이메일: privacy@sylabs.kr
- 회사명: SY Labs

개인정보 침해 관련 신고 및 상담:
- 개인정보침해신고센터 (한국인터넷진흥원): 118, privacy.kisa.or.kr
- 개인정보 분쟁조정위원회: 1833-6972, kopico.go.kr
- 대검찰청 사이버수사과: 1301, spo.go.kr
- 경찰청 사이버안전국: 182, cyberbureau.police.go.kr`}
      </Section>

      <Section title="8. 데이터 처리 위탁">
        {`회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.

[위탁 업체 및 내용]
- Google Cloud Platform / Firebase: 데이터 저장, 인증, 호스팅
  (데이터 처리 지역: 미국, Google Cloud 보안 정책 준수)
- Google (Gemini AI): AI 기질 분석 및 육아 코칭 (마스킹된 데이터만 전송, 데이터 학습 미사용)

위탁 업체는 관련 법령에 따라 개인정보를 안전하게 처리하며, 위탁 목적 외 개인정보 이용을 금지하고 있습니다.`}
      </Section>

      <Section title="9. 쿠키 및 자동 수집 장치">
        {`본 서비스는 모바일 앱으로서 웹 쿠키를 사용하지 않습니다.

- 자동 로그인을 위한 인증 토큰은 기기의 보안 저장소(Secure Store)에 암호화되어 저장됩니다.
- 별도의 행동 추적 도구(트래커)를 사용하지 않습니다.
- 광고 식별자를 수집하지 않습니다.`}
      </Section>

      <Section title="10. 정책 변경 안내">
        {`본 개인정보 처리방침은 법령, 정책 또는 보안 기술의 변경에 따라 내용이 추가, 삭제 및 수정될 수 있습니다.

- 변경 사항은 시행일 최소 7일 전에 앱 내 공지사항을 통해 안내합니다.
- 중요한 변경 사항(수집 항목 추가, 제3자 제공 등)은 시행일 최소 30일 전에 안내하며, 필요 시 이용자의 동의를 다시 받습니다.
- 본 방침은 2026년 4월 5일부터 시행됩니다.`}
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          SY Labs | privacy@sylabs.kr
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 60 },
  heading: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  meta: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  intro: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  body: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  footerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
});
