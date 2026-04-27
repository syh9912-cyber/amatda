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

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '이용약관', headerShown: true }} />

      <Text style={styles.heading}>이용약관</Text>
      <Text style={styles.meta}>
        시행일: 2026년 4월 5일{'\n'}
        회사명: SY Labs{'\n'}
        서비스명: 아맞다 (아이맞춤다이어리)
      </Text>

      <Section title="제1조 (목적)">
        {`본 약관은 SY Labs(이하 "회사")가 제공하는 "아맞다" 모바일 애플리케이션 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자의 권리, 의무, 책임 사항 등을 규정함을 목적으로 합니다.`}
      </Section>

      <Section title="제2조 (정의)">
        {`1. "서비스"란 회사가 제공하는 아이 기질 분석, 맞춤 육아 솔루션, 성장 기록 관리 등 관련 제반 서비스를 말합니다.
2. "이용자"란 본 약관에 동의하고 회사가 제공하는 서비스를 이용하는 자를 말합니다.
3. "자녀 정보"란 이용자가 서비스에 등록하는 자녀의 이름, 생년월일, 성별, 출생시각 등의 정보를 말합니다.
4. "콘텐츠"란 서비스 내에서 이용자가 작성하거나 업로드한 관찰 일기, 사진, 메모 등을 말합니다.`}
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)">
        {`1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.
2. 회사는 관련 법령에 위배되지 않는 범위에서 본 약관을 변경할 수 있습니다.
3. 약관이 변경될 경우 회사는 변경 내용을 시행일 7일 전부터 서비스 내 공지사항에 게시합니다.
4. 이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.`}
      </Section>

      <Section title="제4조 (서비스 내용)">
        {`회사는 다음과 같은 서비스를 제공합니다.

1. 아이 기질 분석: 생년월일시를 기반으로 아이의 고유한 기질과 성향을 분석합니다.
2. 맞춤 육아 솔루션: 연령, 성별, 기질에 맞춘 교육, 영양, 활동을 추천합니다.
3. 성장 기록: 관찰 일기, 사진 앨범, 일일 기록을 통해 아이의 성장을 기록합니다.
4. 상담이모: 육아 상담 서비스를 제공합니다.
5. 학원 추천: 위치 기반 주변 학원 정보를 제공합니다.
6. 영양 가이드: 연령 및 기질에 맞는 식단을 추천합니다.
7. 형제자매 궁합: 자녀 간 성향 궁합을 분석합니다.

서비스의 구체적인 내용은 회사의 사정에 따라 변경될 수 있습니다.`}
      </Section>

      <Section title="제5조 (회원 가입 및 탈퇴)">
        {`1. 이용자는 회사가 정한 절차에 따라 회원 가입을 신청하고, 회사가 이를 승낙함으로써 회원 가입이 완료됩니다.
2. 회원은 언제든지 서비스 내 [더보기 > 설정 > 계정 삭제]를 통해 탈퇴를 요청할 수 있습니다.
3. 회원 탈퇴 시 모든 개인정보와 서비스 이용 기록은 즉시 삭제됩니다. 단, 관계 법령에 따라 보관이 필요한 정보는 해당 기간 동안 보관합니다.`}
      </Section>

      <Section title="제6조 (이용자의 의무)">
        {`이용자는 다음 각 호의 행위를 하여야 합니다.

1. 회원 가입 시 정확한 정보를 제공할 것
2. 자신의 계정 정보를 안전하게 관리할 것
3. 자녀의 개인정보를 등록할 경우 법정대리인으로서의 권한이 있을 것
4. 타인의 개인정보를 부정하게 사용하지 않을 것
5. 서비스 이용 시 관련 법령 및 본 약관을 준수할 것`}
      </Section>

      <Section title="제7조 (금지 행위)">
        {`이용자는 다음 각 호의 행위를 해서는 안 됩니다.

1. 타인의 정보를 도용하여 회원 가입하는 행위
2. 회사의 서비스를 이용하여 얻은 정보를 회사의 사전 승낙 없이 복제, 유통, 상업적으로 이용하는 행위
3. 서비스의 안정적 운영을 방해하는 행위
4. 회사의 지적재산권을 침해하는 행위
5. 외설적이거나 폭력적인 내용, 기타 공서양속에 반하는 콘텐츠를 업로드하는 행위
6. 해킹, 악성코드 유포 등 서비스를 비정상적으로 이용하는 행위
7. 자동화된 수단(봇, 스크래퍼 등)을 이용하여 서비스에 접근하는 행위
8. 다른 이용자의 서비스 이용을 방해하는 행위

위반 시 회사는 해당 이용자의 서비스 이용을 제한하거나 회원 자격을 정지, 상실시킬 수 있습니다.`}
      </Section>

      <Section title="제8조 (서비스 제공의 변경 및 중단)">
        {`1. 회사는 운영상, 기술상의 필요에 따라 서비스의 전부 또는 일부를 변경할 수 있습니다.
2. 서비스 변경 시 변경 내용과 적용일을 서비스 내 공지사항에 게시합니다.
3. 회사는 다음 각 호의 사유가 있는 경우 서비스의 전부 또는 일부를 제한하거나 중단할 수 있습니다:
   - 시스템 정기 점검, 증설, 교체 등 설비 보수 시
   - 천재지변, 전쟁 등 불가항력적 사유 발생 시
   - 기타 회사가 서비스를 제공할 수 없는 사유가 발생한 경우`}
      </Section>

      <Section title="제9조 (지적재산권)">
        {`1. 서비스에 포함된 모든 콘텐츠(디자인, 텍스트, 이미지, 소프트웨어 등)에 대한 지적재산권은 회사에 귀속됩니다.
2. 이용자가 서비스에 업로드한 콘텐츠의 저작권은 해당 이용자에게 귀속됩니다.
3. 이용자는 회사에 서비스 운영 목적에 한하여 해당 콘텐츠를 사용할 수 있는 비독점적 라이선스를 부여합니다.`}
      </Section>

      <Section title="제10조 (면책 조항)">
        {`1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인해 서비스를 제공할 수 없는 경우 서비스 제공에 대한 책임이 면제됩니다.
2. 회사는 이용자의 귀책 사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.
3. 기질 분석 결과 및 추천 정보는 참고 목적으로 제공되며, 의학적 진단이나 전문 상담을 대체하지 않습니다. 회사는 분석 결과의 정확성이나 완전성을 보장하지 않습니다.
4. 이용자가 서비스에 게재한 정보의 신뢰도, 정확성에 대해서는 해당 이용자가 책임을 부담합니다.
5. 회사는 이용자 간 또는 이용자와 제3자 간에 서비스를 매개로 발생한 분쟁에 대해 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.`}
      </Section>

      <Section title="제11조 (손해배상)">
        {`1. 회사 또는 이용자가 본 약관을 위반하여 상대방에게 손해를 입힌 경우 그 손해를 배상할 책임이 있습니다.
2. 회사의 손해배상 범위는 직접적이고 통상적인 손해에 한하며, 특별 손해나 간접 손해는 포함하지 않습니다.`}
      </Section>

      <Section title="제12조 (분쟁 해결)">
        {`1. 본 약관에 관한 분쟁은 대한민국 법률에 따라 해석됩니다.
2. 서비스 이용과 관련하여 회사와 이용자 간에 분쟁이 발생한 경우, 쌍방은 분쟁 해결을 위해 성실히 협의합니다.
3. 협의가 이루어지지 않는 경우 관할 법원은 회사의 본사 소재지를 관할하는 법원으로 합니다.
4. 이용자는 한국소비자원(www.kca.go.kr) 또는 전자거래분쟁조정위원회(www.ecmc.or.kr)에 분쟁 조정을 신청할 수 있습니다.`}
      </Section>

      <Section title="부칙">
        {`본 약관은 2026년 4월 5일부터 시행합니다.`}
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          SY Labs | privacy@bloomincorp.com
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
