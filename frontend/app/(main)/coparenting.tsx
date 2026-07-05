import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { getCoparentingGuide } from '../../features/guide/coparentingGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { coparentingApi } from '../../services/api';
import { AdSlot } from '../../components/ads/AdSlot';

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

function getPermissionList(t: TFunction) {
  return [
    { key: 'viewRecords', label: t('coparenting.permission.viewRecords.label'), desc: t('coparenting.permission.viewRecords.desc'), icon: '📋' },
    { key: 'editRecords', label: t('coparenting.permission.editRecords.label'), desc: t('coparenting.permission.editRecords.desc'), icon: '✏️' },
    { key: 'viewCoaching', label: t('coparenting.permission.viewCoaching.label'), desc: t('coparenting.permission.viewCoaching.desc'), icon: '💬' },
    { key: 'useCoaching', label: t('coparenting.permission.useCoaching.label'), desc: t('coparenting.permission.useCoaching.desc'), icon: '🤖' },
    { key: 'viewGrowth', label: t('coparenting.permission.viewGrowth.label'), desc: t('coparenting.permission.viewGrowth.desc'), icon: '📊' },
    { key: 'viewTimeline', label: t('coparenting.permission.viewTimeline.label'), desc: t('coparenting.permission.viewTimeline.desc'), icon: '📸' },
    { key: 'editTimeline', label: t('coparenting.permission.editTimeline.label'), desc: t('coparenting.permission.editTimeline.desc'), icon: '🖼' },
    { key: 'viewProfile', label: t('coparenting.permission.viewProfile.label'), desc: t('coparenting.permission.viewProfile.desc'), icon: '👶' },
    { key: 'editProfile', label: t('coparenting.permission.editProfile.label'), desc: t('coparenting.permission.editProfile.desc'), icon: '✏️' },
    { key: 'manageFamily', label: t('coparenting.permission.manageFamily.label'), desc: t('coparenting.permission.manageFamily.desc'), icon: '👥' },
  ] as const;
}

function getRoleOptions(t: TFunction) {
  return [
    { key: 'parent', label: t('coparenting.role.parent.label'), icon: '🫂', desc: t('coparenting.role.parent.desc') },
    { key: 'grandparent', label: t('coparenting.role.grandparent.label'), icon: '🧓', desc: t('coparenting.role.grandparent.desc') },
    { key: 'helper', label: t('coparenting.role.helper.label'), icon: '🤝', desc: t('coparenting.role.helper.desc') },
    { key: 'viewer', label: t('coparenting.role.viewer.label'), icon: '👁️', desc: t('coparenting.role.viewer.desc') },
  ];
}

const ROLE_PRESETS: Record<string, string[]> = {
  parent: ['viewRecords', 'editRecords', 'viewCoaching', 'useCoaching', 'viewGrowth', 'viewTimeline', 'editTimeline', 'viewProfile', 'editProfile', 'manageFamily'],
  grandparent: ['viewRecords', 'viewCoaching', 'viewGrowth', 'viewTimeline', 'viewProfile'],
  helper: ['viewRecords', 'editRecords', 'viewProfile'],
  viewer: ['viewRecords', 'viewGrowth', 'viewTimeline', 'viewProfile'],
};

const COLOR = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  accent: '#FF8C5A',
  accentLight: '#FFF0E6',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  mint: '#4ECDC4',
  mintBg: '#E8FAF8',
  border: '#E5E5EA',
  danger: '#FF3B30',
  dangerBg: '#FFEBEE',
};

// 정식 출시 후 Play Store URL 로 자동 작동. iOS 출시 후엔 OS 분기 랜딩 페이지로 교체 예정.
// 가족 초대 링크 랜딩(Firebase Hosting): 앱 있으면 자동 열기, 없으면 스토어+재탭 안내
const INVITE_LINK_BASE = 'https://amatda-parenting.web.app/invite';

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CoparentingScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const authUserId = useAuthStore((s) => s.userId);

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

  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => { shouldAutoShowGuide('coparenting').then((sh) => { if (sh) setGuideVisible(true); }); }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('coparenting'); };

  const loadMembers = useCallback(async () => {
    // 선택된 아이가 없으면(예: 초대 링크로 막 진입한 피초대자) 로딩을 끝내고 안내 화면 노출.
    // 여기서 return만 하면 loading=true가 유지돼 스피너가 무한히 도는 버그가 발생함.
    if (!selectedChild) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // 초대 링크(amatda://coparenting?inviteCode=XXX)로 진입 시 자동 수락.
  // (랜딩페이지가 앱을 이 딥링크로 열어줌 → 코드 손입력 없이 바로 가족 연결)
  const inviteParams = useLocalSearchParams<{ inviteCode?: string }>();
  const handledInviteRef = useRef(false);
  useEffect(() => {
    const code = typeof inviteParams.inviteCode === 'string'
      ? inviteParams.inviteCode.trim().toUpperCase() : '';
    if (!code || handledInviteRef.current) return;
    handledInviteRef.current = true;
    (async () => {
      try {
        await coparentingApi.accept(code);
        Alert.alert(t('common.complete'), t('coparenting.alert.autoConnected'));
        loadMembers();
      } catch {
        // 자동 수락 실패 → 코드 채워서 수동 시도 가능하게
        setAcceptCode(code);
        setAcceptVisible(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteParams.inviteCode, loadMembers]);

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
      Alert.alert(t('common.notice'), t('coparenting.alert.nicknameRequired'));
      return;
    }
    if (!selectedChild) return;

    setInviteLoading(true);
    // 전화번호를 초기화(setInvitePhone(''))하기 전에 지역 변수로 캡처 —
    // 이후 Alert 콜백에서도 동일 값을 안전하게 사용(상태 초기화 영향 없음).
    const phoneDigits = invitePhone.replace(/[^0-9]/g, '');
    try {
      const res = await coparentingApi.invite(
        selectedChild.id,
        inviteRole,
        inviteNickname.trim(),
        invitePerms,
        phoneDigits || undefined,
      );
      const data = res.data?.data;
      const code = data?.inviteCode ?? '';

      setInviteVisible(false);
      setInviteNickname('');
      setInvitePhone('');

      // SMS or share invite code
      const childName = selectedChild.name;
      const inviteUrl = `${INVITE_LINK_BASE}?code=${code}&lang=${i18n.language}`;
      const message = t('coparenting.inviteMessage', { childName, inviteUrl, code });

      Alert.alert(
        t('coparenting.alert.inviteCompleteTitle'),
        t('coparenting.alert.inviteCompleteDesc', { code }),
        [
          {
            text: t('coparenting.alert.sendSms'),
            onPress: async () => {
              const phone = phoneDigits;
              if (phone.length >= 10) {
                // iOS는 본문 구분자로 '&', Android는 '?' 사용. 메시지만 인코딩(구분자는 인코딩 금지).
                const sep = Platform.OS === 'ios' ? '&' : '?';
                const smsUrl = `sms:${phone}${sep}body=${encodeURIComponent(message)}`;
                try {
                  const ok = await Linking.canOpenURL(smsUrl);
                  if (ok) { await Linking.openURL(smsUrl); }
                  else { await Share.share({ message }); }
                } catch { try { await Share.share({ message }); } catch { /* */ } }
              } else {
                try { await Share.share({ message }); } catch { /* */ }
              }
            },
          },
          {
            text: t('coparenting.alert.shareLink'),
            onPress: async () => {
              try { await Share.share({ message }); } catch { /* */ }
            },
          },
          { text: t('common.close') },
        ],
      );

      loadMembers();
    } catch {
      Alert.alert(t('common.error'), t('coparenting.alert.inviteFailed'));
    } finally {
      setInviteLoading(false);
    }
  };

  // Accept invite
  const handleAccept = async () => {
    if (!acceptCode.trim()) {
      Alert.alert(t('common.notice'), t('coparenting.alert.inviteCodeRequired'));
      return;
    }
    try {
      await coparentingApi.accept(acceptCode.trim());
      Alert.alert(t('common.complete'), t('coparenting.alert.connected'));
      setAcceptVisible(false);
      setAcceptCode('');
      loadMembers();
    } catch {
      Alert.alert(t('common.error'), t('coparenting.alert.invalidInviteCode'));
    }
  };

  // Update permissions
  const handleSavePermissions = async () => {
    if (!editMember) return;
    try {
      await coparentingApi.updatePermissions(editMember.id, editPerms);
      Alert.alert(t('common.complete'), t('coparenting.alert.permissionsUpdated'));
      setEditModalVisible(false);
      loadMembers();
    } catch {
      Alert.alert(t('common.error'), t('coparenting.alert.permissionsUpdateFailed'));
    }
  };

  // Remove member
  const handleRemove = (member: FamilyMember) => {
    Alert.alert(
      t('coparenting.alert.removeMemberTitle'),
      t('coparenting.alert.removeMemberDesc', { nickname: member.nickname }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            try {
              await coparentingApi.removeMember(member.id);
              loadMembers();
            } catch {
              Alert.alert(t('common.error'), t('coparenting.alert.removeFailed'));
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
    getRoleOptions(t).find((r) => r.key === role)?.icon ?? '👤';
  const roleLabel = (role: string) =>
    getRoleOptions(t).find((r) => r.key === role)?.label ?? role;

  // invitee(소유자 아님) 본인의 연결 정보 — members 목록에서 내 userId로 식별
  const myMembership = members.find((m) => m.inviteeUserId === authUserId) ?? null;
  const myRole = myMembership?.role ?? 'viewer';
  const myPerms = myMembership?.permissions ?? [];
  const myNickname = myMembership?.nickname ?? '';
  // 나를 제외한, 함께 연결된 다른 가족(읽기 전용 표시용)
  const otherMembers = members.filter(
    (m) => m.status === 'accepted' && m.inviteeUserId !== authUserId,
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={t('coparenting.headerTitle')} right={<GuideButton onPress={() => setGuideVisible(true)} />} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          {t('coparenting.subtitle', { childName: selectedChild?.name ?? t('coparenting.defaultChildName') })}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLOR.accent} style={{ marginTop: 40 }} />
        ) : !selectedChild ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👶</Text>
            <Text style={styles.emptyTitle}>{t('coparenting.emptyState.title')}</Text>
            <Text style={styles.emptyDesc}>
              {t('coparenting.emptyState.desc')}
            </Text>
            <TouchableOpacity
              style={[styles.acceptBtn, { marginTop: 20, alignSelf: 'stretch' }]}
              onPress={() => setAcceptVisible(true)}
            >
              <Text style={styles.acceptBtnText}>{t('coparenting.enterInviteCode')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {isOwner ? (
              <>
                {/* Owner: me */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('coparenting.me')}</Text>
                  <View style={styles.memberCard}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberIcon}>{'★'}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{t('coparenting.meOwner')}</Text>
                      <Text style={styles.memberPerm}>{t('coparenting.allPermissions')}</Text>
                    </View>
                    <View style={[styles.statusBadge, styles.statusOwner]}>
                      <Text style={styles.statusOwnerText}>{t('coparenting.owner')}</Text>
                    </View>
                  </View>
                </View>

                {/* Connected members */}
                {members.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      {t('coparenting.familyCount', { count: members.length })}
                    </Text>
                    {members.map((m) => (
                      <View key={m.id} style={styles.memberCard}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberIcon}>{roleIcon(m.role)}</Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{m.nickname}</Text>
                          <Text style={styles.memberRole}>
                            {t('coparenting.roleWithPermCount', { role: roleLabel(m.role), count: m.permissions.length })}
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
                              {m.status === 'accepted' ? t('coparenting.status.connected') : t('coparenting.status.pending')}
                            </Text>
                          </View>
                          <View style={styles.memberActions}>
                            <TouchableOpacity onPress={() => openEditPerms(m)}>
                              <Text style={styles.actionEdit}>{t('coparenting.editPermissions')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleRemove(m)}>
                              <Text style={styles.actionRemove}>{t('common.delete')}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Invitee: 내 연결 상태 */}
                <View style={styles.connCard}>
                  <View style={styles.connAvatar}>
                    <Text style={styles.connAvatarIcon}>{roleIcon(myRole)}</Text>
                  </View>
                  <Text style={styles.connTitle}>
                    {t('coparenting.connTitle', { childName: selectedChild?.name ?? t('coparenting.defaultChildName') })}{'\n'}
                    <Text style={styles.connRole}>{roleLabel(myRole)}</Text>
                    {t('coparenting.connTitleSuffix')}
                  </Text>
                  {myNickname ? (
                    <Text style={styles.connNick}>{t('coparenting.displayName', { nickname: myNickname })}</Text>
                  ) : null}
                  <View style={styles.connBadge}>
                    <Text style={styles.connBadgeText}>{t('coparenting.status.connected')}</Text>
                  </View>
                </View>

                {/* Invitee: 내 권한 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('coparenting.myPermissionsCount', { count: myPerms.length })}</Text>
                  <Text style={styles.fieldHint}>
                    {t('coparenting.myPermissionsHint')}
                  </Text>
                  {getPermissionList(t).map((p) => {
                    const on = myPerms.includes(p.key);
                    return (
                      <View
                        key={p.key}
                        style={[styles.permStatusRow, !on && styles.permStatusRowOff]}
                      >
                        <Text style={[styles.permIcon, !on && styles.permDimmed]}>{p.icon}</Text>
                        <View style={styles.permInfo}>
                          <Text style={[styles.permLabel, !on && styles.permDimmed]}>{p.label}</Text>
                          <Text style={styles.permDesc}>{p.desc}</Text>
                        </View>
                        <Text style={on ? styles.permOn : styles.permOff}>
                          {on ? t('coparenting.permAllowed') : t('coparenting.permRestricted')}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Invitee: 함께하는 다른 가족 (읽기 전용) */}
                {otherMembers.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('coparenting.otherFamilyCount', { count: otherMembers.length })}</Text>
                    {otherMembers.map((m) => (
                      <View key={m.id} style={styles.memberCard}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberIcon}>{roleIcon(m.role)}</Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{m.nickname}</Text>
                          <Text style={styles.memberRole}>{roleLabel(m.role)}</Text>
                        </View>
                        <View style={[styles.statusBadge, styles.statusAccepted]}>
                          <Text style={[styles.statusText, styles.statusAcceptedText]}>{t('coparenting.status.connected')}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
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
                  <Text style={styles.inviteBtnText}>{'+'} {t('coparenting.inviteFamily')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => setAcceptVisible(true)}
              >
                <Text style={styles.acceptBtnText}>{t('coparenting.enterInviteCode')}</Text>
              </TouchableOpacity>
            </View>

            {/* Benefits */}
            <View style={styles.benefitCard}>
              <Text style={styles.benefitTitle}>{t('coparenting.benefits.title')}</Text>
              <Text style={styles.benefitItem}>{'•'} {t('coparenting.benefits.item1')}</Text>
              <Text style={styles.benefitItem}>{'•'} {t('coparenting.benefits.item2')}</Text>
              <Text style={styles.benefitItem}>{'•'} {t('coparenting.benefits.item3')}</Text>
              <Text style={styles.benefitItem}>{'•'} {t('coparenting.benefits.item4')}</Text>
            </View>
          </>
        )}

        <View style={{ height: insets.bottom + 30 }} />
      </ScrollView>
      <AdSlot />

      {/* ── Invite Modal ── */}
      <Modal visible={inviteVisible} transparent animationType="slide" onRequestClose={() => setInviteVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{t('coparenting.inviteFamily')}</Text>

              <Text style={styles.fieldLabel}>{t('coparenting.field.nickname')}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={t('coparenting.field.nicknamePlaceholder')}
                placeholderTextColor={COLOR.textLight}
                value={inviteNickname}
                onChangeText={setInviteNickname}
              />

              <Text style={styles.fieldLabel}>{t('coparenting.field.phone')}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="01012345678"
                placeholderTextColor={COLOR.textLight}
                value={invitePhone}
                onChangeText={setInvitePhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>{t('coparenting.field.selectRole')}</Text>
              <View style={styles.roleGrid}>
                {getRoleOptions(t).map((r) => (
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

              <Text style={styles.fieldLabel}>{t('coparenting.field.detailedPermissions')}</Text>
              <Text style={styles.fieldHint}>{t('coparenting.field.detailedPermissionsHint')}</Text>
              {getPermissionList(t).map((p) => (
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
                    thumbColor={invitePerms.includes(p.key) ? COLOR.accent : '#E5E5EA'}
                  />
                </TouchableOpacity>
              ))}

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => setInviteVisible(false)}
                >
                  <Text style={styles.modalBtnCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnSave, inviteLoading && { opacity: 0.5 }]}
                  onPress={handleInvite}
                  disabled={inviteLoading}
                >
                  <Text style={styles.modalBtnSaveText}>
                    {inviteLoading ? t('coparenting.processing') : t('coparenting.inviteAction')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Permission Edit Modal ── */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {t('coparenting.editPermissionsFor', { nickname: editMember?.nickname ?? '' })}
              </Text>
              <Text style={styles.fieldHint}>
                {t('coparenting.roleSuffix', { role: roleLabel(editMember?.role ?? '') })}
              </Text>

              {getPermissionList(t).map((p) => (
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
                    thumbColor={editPerms.includes(p.key) ? COLOR.accent : '#E5E5EA'}
                  />
                </TouchableOpacity>
              ))}

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.modalBtnCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBtnSave}
                  onPress={handleSavePermissions}
                >
                  <Text style={styles.modalBtnSaveText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Accept Code Modal ── */}
      <Modal visible={acceptVisible} transparent animationType="fade" onRequestClose={() => setAcceptVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '40%' }]}>
            <Text style={styles.modalTitle}>{t('coparenting.enterInviteCode')}</Text>
            <Text style={styles.fieldHint}>
              {t('coparenting.enterInviteCodeHint')}
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
                <Text style={styles.modalBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleAccept}>
                <Text style={styles.modalBtnSaveText}>{t('coparenting.connect')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <GuideCarousel visible={guideVisible} pages={getCoparentingGuide(t)} onClose={closeGuide} onComplete={closeGuide} accent="#9D8CC6" />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '600', color: COLOR.text },
  subtitle: { fontSize: 14, color: COLOR.textSub, marginTop: 4, marginBottom: 24 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLOR.text, marginBottom: 10 },

  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLOR.card, borderRadius: 16, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0',
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

  emptyState: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLOR.text, marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: COLOR.textSub, textAlign: 'center', lineHeight: 20 },

  benefitCard: { backgroundColor: COLOR.mintBg, borderRadius: 16, padding: 20, marginBottom: 20 },
  benefitTitle: { fontSize: 16, fontWeight: '700', color: COLOR.text, marginBottom: 12 },
  benefitItem: { fontSize: 13, color: '#5A4F45', lineHeight: 22 },

  /* Invitee connection card */
  connCard: {
    backgroundColor: COLOR.card, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: COLOR.accentLight,
  },
  connAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLOR.accentLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  connAvatarIcon: { fontSize: 34 },
  connTitle: {
    fontSize: 16, fontWeight: '600', color: COLOR.text,
    textAlign: 'center', lineHeight: 24,
  },
  connRole: { color: COLOR.accent, fontWeight: '700' },
  connNick: { fontSize: 13, color: COLOR.textSub, marginTop: 8 },
  connBadge: {
    marginTop: 14, paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 12, backgroundColor: COLOR.mintBg,
  },
  connBadgeText: { fontSize: 12, fontWeight: '700', color: COLOR.mint },

  /* Invitee permission status rows */
  permStatusRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLOR.card, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0',
  },
  permStatusRowOff: { backgroundColor: '#FAFAFA', opacity: 0.7 },
  permDimmed: { color: COLOR.textLight },
  permOn: { fontSize: 12, fontWeight: '700', color: COLOR.mint },
  permOff: { fontSize: 12, fontWeight: '600', color: COLOR.textLight },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
  },
  modalTitle: { fontSize: 22, fontWeight: '600', color: COLOR.text, marginBottom: 8 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 10 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#E5E5EA', alignItems: 'center',
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
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E5EA',
  },
  permIcon: { fontSize: 20, width: 32 },
  permInfo: { flex: 1 },
  permLabel: { fontSize: 14, fontWeight: '600', color: COLOR.text },
  permDesc: { fontSize: 11, color: COLOR.textSub, marginTop: 1 },
});
