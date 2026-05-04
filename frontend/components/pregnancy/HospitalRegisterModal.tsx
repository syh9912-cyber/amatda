/**
 * 분만/주치의 병원 등록 모달
 *
 * 사용:
 *   <HospitalRegisterModal
 *     visible={...}
 *     childId={...}
 *     initialKind="delivery" // 기본 탭
 *     onClose={...}
 *     onSaved={() => ...}
 *   />
 */

import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import {
  type HospitalInfo,
  type HospitalKind,
  getHospital,
  saveHospital,
} from '../../services/deliveryHospital';

interface Props {
  visible: boolean;
  childId: string;
  initialKind?: HospitalKind;
  onClose: () => void;
  onSaved?: () => void;
}

export function HospitalRegisterModal({
  visible,
  childId,
  initialKind = 'delivery',
  onClose,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<HospitalKind>(initialKind);
  const [name, setName] = useState('');
  const [mainPhone, setMainPhone] = useState('');
  const [deliveryWardPhone, setDeliveryWardPhone] = useState('');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [isUniversityHospital, setIsUniversityHospital] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !childId) return;
    setTab(initialKind);
  }, [visible, childId, initialKind]);

  // 탭 전환 시 해당 병원 정보 불러오기
  useEffect(() => {
    if (!visible || !childId) return;
    getHospital(childId, tab).then((info: HospitalInfo | null) => {
      setName(info?.name ?? '');
      setMainPhone(info?.mainPhone ?? '');
      setDeliveryWardPhone(info?.deliveryWardPhone ?? '');
      setAddress(info?.address ?? '');
      setMemo(info?.memo ?? '');
      setIsUniversityHospital(info?.isUniversityHospital === true);
    });
  }, [visible, childId, tab]);

  const handleSave = async () => {
    if (!name.trim() || !mainPhone.trim()) {
      Alert.alert('필수 입력', '병원명과 대표 전화번호는 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      await saveHospital(childId, tab, {
        name: name.trim(),
        mainPhone: mainPhone.trim(),
        deliveryWardPhone: deliveryWardPhone.trim() || undefined,
        address: address.trim() || undefined,
        memo: memo.trim() || undefined,
        isUniversityHospital: tab === 'delivery' ? isUniversityHospital : undefined,
      });
      // 분만 병원이고 직통번호가 비어있으면 부드러운 추가 권유 (사용자 의도: "스마트 제안")
      if (tab === 'delivery' && !deliveryWardPhone.trim()) {
        Alert.alert(
          '저장 완료',
          '밤이나 주말에 전화할 분만실 직통 번호가 따로 있나요?\n없으면 그냥 넘어가도 괜찮아요.',
          [
            { text: '없어요 / 다음에', style: 'cancel', onPress: () => { onSaved?.(); onClose(); } },
            { text: '직통번호 추가하기', onPress: () => {/* 모달 유지 — 사용자가 직통번호 필드에 입력 후 다시 저장 */} },
          ],
        );
        // 모달 닫지 않음 — 사용자가 추가 입력 가능. "없어요" 선택 시 cancel onPress 가 닫음.
      } else {
        Alert.alert('저장 완료', `${tab === 'delivery' ? '분만 예정' : '현재 진료'} 병원 정보가 저장되었습니다.`);
        onSaved?.();
        onClose();
      }
    } catch {
      Alert.alert('저장 실패', '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenMap = () => {
    if (!address.trim() && !name.trim()) {
      Alert.alert('주소 또는 병원명을 먼저 입력해주세요.');
      return;
    }
    const q = encodeURIComponent(address.trim() || name.trim());
    Linking.openURL(`https://map.kakao.com/link/search/${q}`).catch(() => {
      Alert.alert('지도 앱을 열 수 없습니다.');
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>병원 등록</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* 탭 — 진료 / 분만 */}
        <View style={styles.tabRow}>
          {(['clinic', 'delivery'] as const).map((k) => (
            <TouchableOpacity
              key={k}
              style={[styles.tabBtn, tab === k && styles.tabBtnActive]}
              onPress={() => setTab(k)}
            >
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
                {k === 'clinic' ? '🏥 진료 병원' : '🤰 분만 예정 병원'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'delivery' ? (
            <View style={styles.guideBox}>
              <Text style={styles.guideText}>
                친정에서의 출산 등으로 분만 장소가 진료 병원과 다를 경우 여기에 등록하세요.{'\n'}
                <Text style={{ fontWeight: '700', color: '#7C5CFF' }}>
                  SOS 화면에서 이 번호로 즉시 연결됩니다.
                </Text>
              </Text>
            </View>
          ) : (
            <View style={styles.guideBox}>
              <Text style={styles.guideText}>
                평소 정기 검진을 받는 주치의 병원 정보입니다.
              </Text>
            </View>
          )}

          {/* 대학병원 체크박스 — 분만 탭에서만 노출 */}
          {tab === 'delivery' && (
            <>
              <TouchableOpacity
                style={[styles.checkboxRow, isUniversityHospital && styles.checkboxRowActive]}
                onPress={() => setIsUniversityHospital((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, isUniversityHospital && styles.checkboxChecked]}>
                  {isUniversityHospital && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkboxLabel}>🏥 대학병원(상급종합병원)이에요</Text>
                  <Text style={styles.checkboxSub}>
                    예: 서울대병원, 삼성서울병원, 차병원 본원 등
                  </Text>
                </View>
              </TouchableOpacity>

              {isUniversityHospital && (
                <View style={styles.uniInfoBox}>
                  <Text style={styles.uniInfoText}>
                    💡 대학병원은 야간/주말 외래가 닫혀있어,{'\n'}
                    <Text style={{ fontWeight: '800', color: '#7C5CFF' }}>
                      낮에도 분만실(MFICU) 직통 번호
                    </Text>
                    로 안내됩니다.
                  </Text>
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>병원명 *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="예: 차병원 강남"
            placeholderTextColor="#BBB"
          />

          <Text style={styles.label}>대표 전화번호 *</Text>
          <TextInput
            style={styles.input}
            value={mainPhone}
            onChangeText={setMainPhone}
            placeholder="예: 02-3468-3000"
            placeholderTextColor="#BBB"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>
            {tab === 'delivery' && isUniversityHospital
              ? '고위험 산모센터(MFICU) / 분만실 직통 *'
              : '분만실 직통번호 (선택)'}
          </Text>
          <TextInput
            style={styles.input}
            value={deliveryWardPhone}
            onChangeText={setDeliveryWardPhone}
            placeholder={
              tab === 'delivery' && isUniversityHospital
                ? '대학병원은 야간/주말 외래가 안 받아요'
                : '예: 02-3468-3010 (있으면 SOS 시 우선 연결)'
            }
            placeholderTextColor="#BBB"
            keyboardType="phone-pad"
          />
          {tab === 'delivery' && isUniversityHospital && !deliveryWardPhone.trim() && (
            <Text style={styles.warnText}>
              ⚠️ 대학병원은 분만실 직통 번호가 꼭 필요해요. 병원 안내 데스크에 문의하세요.
            </Text>
          )}

          <Text style={styles.label}>주소 (선택)</Text>
          <View style={styles.addressRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              value={address}
              onChangeText={setAddress}
              placeholder="주소를 입력하세요"
              placeholderTextColor="#BBB"
            />
            <TouchableOpacity style={styles.mapBtn} onPress={handleOpenMap} hitSlop={8}>
              <Text style={styles.mapBtnText}>🗺️ 지도</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>메모 (가족 분만실 / 르바이에 / 기타 특징)</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            value={memo}
            onChangeText={setMemo}
            placeholder="예: 가족 분만실 가능, 1인 입원실 신청 완료"
            placeholderTextColor="#BBB"
            multiline
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '저장하기'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? 36 : 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  closeBtn: { fontSize: 22, color: '#666' },
  title: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  tabBtnActive: { backgroundColor: '#FFF3EC', borderColor: '#FF8C5A' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#FF8C5A', fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  guideBox: {
    backgroundColor: '#F5F2FF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  guideText: { fontSize: 13.5, color: '#3C3450', lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#333', marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
  },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  mapBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFE4D2',
    borderRadius: 8,
  },
  mapBtnText: { fontSize: 13, color: '#FF8C5A', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#FF8C5A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F7FF',
    borderWidth: 1,
    borderColor: '#E4DFFA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  checkboxRowActive: {
    backgroundColor: '#EFEAFF',
    borderColor: '#7C5CFF',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#BBB',
    backgroundColor: '#FFF',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#7C5CFF',
    backgroundColor: '#7C5CFF',
  },
  checkboxMark: { color: '#FFF', fontSize: 14, fontWeight: '900', lineHeight: 16 },
  checkboxLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  checkboxSub: { fontSize: 12, color: '#777', marginTop: 2 },
  uniInfoBox: {
    backgroundColor: '#FFF8E8',
    borderLeftWidth: 3,
    borderLeftColor: '#F5B400',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  uniInfoText: { fontSize: 13, color: '#5A4A20', lineHeight: 19 },
  warnText: {
    fontSize: 12,
    color: '#D9534F',
    marginTop: 6,
    fontWeight: '600',
  },
});
