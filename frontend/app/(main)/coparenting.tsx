import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Share,
  Linking,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { coparentingApi } from '../../services/api';

/* ------------------------------------------------------------------ */
/* Types & Constants                                                   */
/* ------------------------------------------------------------------ */

interface FamilyMember {
  id: string;
  nickname: string;
  role: string;
  permissions: string[];
  status: 'pending' | 'accepted' | 'declined';
  inviteCode?: string;
  inviteeUserId?: string | null;
}

const PERMISSION_LIST = [
  { key: 'viewRecords', label: '육아 기록 열람', desc: '수유/수면/기저귀 기록 보기', icon: '📋' },
  { key: 'editRecords', label: '육아 기록 작성', desc: '기록 추가/수정', icon: '✏️' },
  { key: 'viewCoaching', label: '상담이모 열람', desc: '상담 내역 보기', icon: '💬' },
  { key: 'useCoaching', label: '상담이모 사용', desc: '직접 상담이모에 질문하기', icon: '🤖' },
  { key: 'viewGrowth', label: '성장 통계 열람', desc: '성장 분석/그래프 보기', icon: '📊' },
  { key: 'viewTimeline', label: '타임라인 열람', desc: '성장 사진 보기', icon: '📸' },
  { key: 'editTimeline', label: '타임라인 추가', desc: '사진/마일스톤 추가', icon: '🖼' },
  { key: 'viewProfile', label: '프로필 열람', desc: '아이 기본 정보 보기', icon: '👶' },
  { key: 'editProfile', label: '프로필 수정', desc: '아이 정보 수정', icon: '✏️' },
  { key: 'manageFamily', label: '가족 관리', desc: '구성원 초대/삭제', icon: '👥' },
] as const;

const ROLE_OPTIONS = [
  { key: 'parent', label: '부모', icon: '👨‍👩‍👦', desc: '모든 권한' },
  { key: 'grandparent', label: '조부모', icon: '👴', desc: '열람 위주' },
  { key: 'helper', label: '도우미', icon: '🧑‍🍼', desc: '기록 작성 위주' },
  { key: 'viewer', label: '열람자', icon: '👀', desc: '보기만 가능' },
];

const ROLE_PRESETS: Record<string, string[]> = {
  parent: ['viewRecords', 'editRecords', 'viewCoaching', 'useCoaching', 'viewGrowth', 'viewTimeline', 'editTimeline', 'viewProfile', 'editProfile', 'manageFamily'],
  grandparent: ['viewRecords', 'viewCoaching', 'viewGrowth', 'viewTimeline', 'viewProfile'],
  helper: ['viewRecords', 'editRecords', 'viewProfile'],
  viewer: ['viewRecords', 'viewGrowth', 'viewTimeline', 'viewProfile'],
};

const COLOR = {
  bg: '#FFF5EC',
  card: '#FFFFFF',
  accent: '#FF8C5A',
  accentLight: '#FFF0E6',
  text: '#2D2016',
  textSub: '#8C7A6B',
  textLight: '#B5A99A',
  mint: '#4ECDC4',
  mintBg: '#E8FAF8',
  border: '#F0EBE4',
  danger: '#E53935',
  dangerBg: '#FFEBEE',
};

const APP_STORE_LINK = 'https://amatda.app/download';

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CoparentingScreen() {
  const insets = useSafeAreaInsets();
  const selectedChild = useChildStore((s) => s.selectedChild);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(true);

  // Invite modal state
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteNickname, setInviteNickname] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState('grandparent');
  const [invitePerms, setInvitePerms] = useState<string[]>(ROLE_PRESETS['grandparent']);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Permission edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editMember, setEditMember] = useState<FamilyMember | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);

  // Accept invite modal
  const [acceptVisible, setAcceptVisible] = useState(false);
  const [acceptCode, setAcceptCode] = useState('');

  const loadMembers = useCallback(async () => {
    if (!selectedChild) return;
    try {
      const res = await coparentingApi.members(selectedChild.id);
      const data = res.data?.data;
      setMembers(data?.members ?? []);
      setIsOwner(data?.isOwner ?? true);
    } catch {
      // not owner or no access
    } finally {
      setLoading(false);
    }
  }, [selectedChild?.id]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // Role change -> update preset permissions
  const handleRoleChange = (role: string) => {
    setInviteRole(role);
    setInvitePerms([...(ROLE_PRESETS[role] ?? ROLE_PRESETS['viewer'])]);
  };

  const toggleInvitePerm = (key: string) => {
    setInvitePerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const toggleEditPerm = (key: string) => {
    setEditPerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  // Send invite
  const handleInvite = async () => {
    if (!inviteNickname.trim()) {
      Alert.alert('알림', '이름/별명을 입력해주세요');
      return;
    }
    if (!selectedChild) return;

    setInviteLoading(true);
    try {
      const res = await coparentingApi.invite(
        selectedChild.id,
        inviteRole,
        inviteNickname.trim(),
        invitePerms,
        invitePhone.replace(/[^0-9]/g, '') || undefined,
      );
      const data = res.data?.data;
      const code = data?.inviteCode ?? '';

      setInviteVisible(false);
      setInviteNickname('');
      setInvitePhone('');

      // SMS or share invite code
      const childName = selectedChild.name;
      const message = `${childName}의 육아에 함께해요!\n초대 코드: ${code}\n앱 다운로드: ${APP_STORE_LINK}`;

      Alert.alert(
        '초대 완료',
        `초대 코드: ${code}\n\n이 코드를 상대방에게 전달해주세요.`,
        [
          {
            text: '문자 보내기',
            onPress: async () => {
              const phone = invitePhone.replace(/[^0-9]/g, '');
              if (phone.length >= 10) {
                const smsUrl = `sms:${phone}${encodeURIComponent(`?body=${message}`)}`;
                try { await Linking.openURL(smsUrl); } catch { /* */ }
              } else {
                try { await Share.share({ message }); } catch { /* */ }
              }
            },
          },
          {
            text: '링크 공유',
            onPress: async () => {
              try { await Share.share({ message }); } catch { /* */ }
            },
          },
          { text: '닫기' },
        ],
      );

      loadMembers();
    } catch {
      Alert.alert('오류', '초대에 실패했습니다');
    } finally {
      setInviteLoading(false);
    }
  };

  // Accept invite
  const handleAccept = async () => {
    if (!acceptCode.trim()) {
      Alert.alert('알림', '초대 코드를 입력해주세요');
      return;
    }
    try {
      await coparentingApi.accept(acceptCode.trim());
      Alert.alert('완료', '가족으로 연결되었습니다!');
      setAcceptVisible(false);
      setAcceptCode('');
      loadMembers();
    } catch {
      Alert.alert('오류', '유효하지 않은 초대 코드입니다');
    }
  };

  // Update permissions
  const handleSavePermissions = async () => {
    if (!editMember) return;
    try {
      await coparentingApi.updatePermissions(editMember.id, editPerms);
      Alert.alert('완료', '권한이 수정되었습니다');
      setEditModalVisible(false);
      loadMembers();
    } catch {
      Alert.alert('오류', '권한 수정에 실패했습니다');
    }
  };

  // Remove member
  const handleRemove = (member: FamilyMember) => {
    Alert.alert(
      '구성원 삭제',
      `${member.nickname}님을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: async () => {
            try {
              await coparentingApi.removeMember(member.id);
              loadMembers();
            } catch {
              Alert.alert('오류', '삭제에 실패했습니다');
            }
          },
        },
      ],
    );
  };

  const openEditPerms = (member: FamilyMember) => {
    setEditMember(member);
    setEditPerms([...member.permissions]);
    setEditModalVisible(true);
  };

  const roleIcon = (role: string) =>
    ROLE_OPTIONS.find((r) => r.key === role)?.icon ?? '👤';
  const roleLabel = (role: string) =>
    ROLE_OPTIONS.find((r) => r.key === role)?.label ?? role;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>공동육아</Text>
        <Text style={styles.subtitle}>
          가족과 함께 {selectedChild?.name ?? '아이'}의 성장을 기록하세요
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLOR.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Owner: me */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>나</Text>
              <View style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberIcon}>{'👩'}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>나 (소유자)</Text>
                  <Text style={styles.memberPerm}>모든 권한</Text>
                </View>
                <View style={[styles.statusBadge, styles.statusOwner]}>
                  <Text style={styles.statusOwnerText}>소유자</Text>
                </View>
              </View>
            </View>

            {/* Connected members */}
            {members.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  연결된 가족 ({members.filter((m) => m.status === 'accepted').length})
                </Text>
                {members.map((m) => (
                  <View key={m.id} style={styles.memberCard}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberIcon}>{roleIcon(m.role)}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{m.nickname}</Text>
                      <Text style={styles.memberRole}>
                        {roleLabel(m.role)} ({m.permissions.length}개 권한)
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[
                        styles.statusBadge,
                        m.status === 'accepted' ? styles.statusAccepted : styles.statusPending,
                      ]}>
                        <Text style={[
                          styles.statusText,
                          m.status === 'accepted' ? styles.statusAcceptedText : styles.statusPendingText,
                        ]}>
                          {m.status === 'accepted' ? '연결됨' : '대기중'}
                        </Text>
                      </View>
                      {isOwner && (
                        <View style={styles.memberActions}>
                          <TouchableOpacity onPress={() => openEditPerms(m)}>
                            <Text style={styles.actionEdit}>권한수정</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleRemove(m)}>
                            <Text style={styles.actionRemove}>삭제</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionButtons}>
              {isOwner && (
                <TouchableOpacity
                  style={styles.inviteBtn}
                  onPress={() => {
                    setInviteRole('grandparent');
                    setInvitePerms([...ROLE_PRESETS['grandparent']]);
                    setInviteNickname('');
                    setInvitePhone('');
                    setInviteVisible(true);
                  }}
                >
                  <Text style={styles.inviteBtnText}>{'+'} 가족 초대하기</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => setAcceptVisible(true)}
              >
                <Text style={styles.acceptBtnText}>{'🔑'} 초대 코드 입력</Text>
              </TouchableOpacity>
            </View>

            {/* Benefits */}
            <View style={styles.benefitCard}>
              <Text style={styles.benefitTitle}>{'✨'} 공동육아의 장점</Text>
              <Text style={styles.benefitItem}>{'•'} 아빠가 수유 기록하면 엄마에게 즉시 반영</Text>
              <Text style={styles.benefitItem}>{'•'} 조부모는 열람만 가능해서 기록 실수 방지</Text>
              <Text style={styles.benefitItem}>{'•'} 도우미에게 필요한 권한만 부여 가능</Text>
              <Text style={styles.benefitItem}>{'•'} 모든 가족의 기록이 상담이모에 반영</Text>
            </View>
          </>
        )}

        <View style={{ height: insets.bottom + 30 }} />
      </ScrollView>

      {/* ── Invite Modal ── */}
      <Modal visible={inviteVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>가족 초대</Text>

              <Text style={styles.fieldLabel}>이름/별명</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="예: 할머니, 아빠"
                placeholderTextColor={COLOR.textLight}
                value={inviteNickname}
                onChangeText={setInviteNickname}
              />

              <Text style={styles.fieldLabel}>전화번호 (선택)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="01012345678"
                placeholderTextColor={COLOR.textLight}
                value={invitePhone}
                onChangeText={setInvitePhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>역할 선택</Text>
              <View style={styles.roleGrid}>
                {ROLE_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.roleChip, inviteRole === r.key && styles.roleChipActive]}
                    onPress={() => handleRoleChange(r.key)}
                  >
                    <Text style={styles.roleChipIcon}>{r.icon}</Text>
                    <Text style={[styles.roleChipLabel, inviteRole === r.key && styles.roleChipLabelActive]}>
                      {r.label}
                    </Text>
                    <Text style={styles.roleChipDesc}>{r.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>세부 권한 설정</Text>
              <Text style={styles.fieldHint}>역할 기본 권한이 적용됩니다. 필요에 따라 조정하세요.</Text>
              {PERMISSION_LIST.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={styles.permRow}
                  onPress={() => toggleInvitePerm(p.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.permIcon}>{p.icon}</Text>
                  <View style={styles.permInfo}>
                    <Text style={styles.permLabel}>{p.label}</Text>
                    <Text style={styles.permDesc}>{p.desc}</Text>
                  </View>
                  <Switch
                    value={invitePerms.includes(p.key)}
                    onValueChange={() => toggleInvitePerm(p.key)}
                    trackColor={{ false: '#E0D8D0', true: '#FFD0B5' }}
                    thumbColor={invitePerms.includes(p.key) ? COLOR.accent : '#F0EBE4'}
                  />
                </TouchableOpacity>
              ))}

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => setInviteVisible(false)}
                >
                  <Text style={styles.modalBtnCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnSave, inviteLoading && { opacity: 0.5 }]}
                  onPress={handleInvite}
                  disabled={inviteLoading}
                >
                  <Text style={styles.modalBtnSaveText}>
                    {inviteLoading ? '처리중...' : '초대하기'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Permission Edit Modal ── */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editMember?.nickname} 권한 수정
              </Text>
              <Text style={styles.fieldHint}>
                {roleLabel(editMember?.role ?? '')} 역할
              </Text>

              {PERMISSION_LIST.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={styles.permRow}
                  onPress={() => toggleEditPerm(p.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.permIcon}>{p.icon}</Text>
                  <View style={styles.permInfo}>
                    <Text style={styles.permLabel}>{p.label}</Text>
                    <Text style={styles.permDesc}>{p.desc}</Text>
                  </View>
                  <Switch
                    value={editPerms.includes(p.key)}
                    onValueChange={() => toggleEditPerm(p.key)}
                    trackColor={{ false: '#E0D8D0', true: '#FFD0B5' }}
                    thumbColor={editPerms.includes(p.key) ? COLOR.accent : '#F0EBE4'}
                  />
                </TouchableOpacity>
              ))}

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.modalBtnCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBtnSave}
                  onPress={handleSavePermissions}
                >
                  <Text style={styles.modalBtnSaveText}>저장</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Accept Code Modal ── */}
      <Modal visible={acceptVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '40%' }]}>
            <Text style={styles.modalTitle}>초대 코드 입력</Text>
            <Text style={styles.fieldHint}>
              가족에게 받은 초대 코드를 입력하세요
            </Text>
            <TextInput
              style={[styles.fieldInput, { fontSize: 20, textAlign: 'center', letterSpacing: 4 }]}
              placeholder="ABCD1234"
              placeholderTextColor={COLOR.textLight}
              value={acceptCode}
              onChangeText={setAcceptCode}
              autoCapitalize="characters"
              maxLength={8}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setAcceptVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleAccept}>
                <Text style={styles.modalBtnSaveText}>연결하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '800', color: COLOR.text },
  subtitle: { fontSize: 14, color: COLOR.textSub, marginTop: 4, marginBottom: 24 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLOR.text, marginBottom: 10 },

  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLOR.card, borderRadius: 16, padding: 16,
    marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  memberAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLOR.accentLight, alignItems: 'center', justifyContent: 'center',
  },
  memberIcon: { fontSize: 26 },
  memberInfo: { flex: 1, marginLeft: 14 },
  memberName: { fontSize: 15, fontWeight: '700', color: COLOR.text },
  memberRole: { fontSize: 12, color: COLOR.textSub, marginTop: 2 },
  memberPerm: { fontSize: 12, color: COLOR.mint, marginTop: 2 },
  memberActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionEdit: { fontSize: 11, fontWeight: '600', color: COLOR.accent },
  actionRemove: { fontSize: 11, fontWeight: '600', color: COLOR.danger },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusOwner: { backgroundColor: COLOR.accentLight },
  statusOwnerText: { fontSize: 11, fontWeight: '700', color: COLOR.accent },
  statusAccepted: { backgroundColor: COLOR.mintBg },
  statusPending: { backgroundColor: '#FFF9C4' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusAcceptedText: { color: COLOR.mint },
  statusPendingText: { color: '#F57F17' },

  actionButtons: { gap: 10, marginBottom: 20 },
  inviteBtn: {
    backgroundColor: COLOR.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  inviteBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  acceptBtn: {
    backgroundColor: COLOR.card, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLOR.accent,
  },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: COLOR.accent },

  benefitCard: { backgroundColor: COLOR.mintBg, borderRadius: 16, padding: 20, marginBottom: 20 },
  benefitTitle: { fontSize: 16, fontWeight: '700', color: COLOR.text, marginBottom: 12 },
  benefitItem: { fontSize: 13, color: '#5A4F45', lineHeight: 22 },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLOR.text, marginBottom: 8 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 10 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#F0EBE4', alignItems: 'center',
  },
  modalBtnCancelText: { fontSize: 15, fontWeight: '700', color: COLOR.textSub },
  modalBtnSave: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: COLOR.accent, alignItems: 'center',
  },
  modalBtnSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  /* Fields */
  fieldLabel: { fontSize: 14, fontWeight: '700', color: COLOR.text, marginTop: 16, marginBottom: 6 },
  fieldHint: { fontSize: 12, color: COLOR.textSub, marginBottom: 10 },
  fieldInput: {
    backgroundColor: '#F8F4F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLOR.text,
  },

  /* Role grid */
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: {
    width: '47%', backgroundColor: '#F8F4F0', borderRadius: 14,
    padding: 12, borderWidth: 2, borderColor: 'transparent',
  },
  roleChipActive: { borderColor: COLOR.accent, backgroundColor: COLOR.accentLight },
  roleChipIcon: { fontSize: 28, marginBottom: 4 },
  roleChipLabel: { fontSize: 14, fontWeight: '700', color: COLOR.text },
  roleChipLabelActive: { color: COLOR.accent },
  roleChipDesc: { fontSize: 11, color: COLOR.textSub, marginTop: 2 },

  /* Permission rows */
  permRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EBE4',
  },
  permIcon: { fontSize: 20, width: 32 },
  permInfo: { flex: 1 },
  permLabel: { fontSize: 14, fontWeight: '600', color: COLOR.text },
  permDesc: { fontSize: 11, color: COLOR.textSub, marginTop: 1 },
});
