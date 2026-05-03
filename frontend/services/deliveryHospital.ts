/**
 * 분만 예정 병원 정보 로컬 저장
 *
 * AsyncStorage 사용 — 서버 스키마 변경 없이 빠르게 출시 가능.
 * (출시 후 안정화되면 Firestore 마이그레이션 별도 작업)
 *
 * 두 가지 병원 분리 저장:
 *  - clinic   : 평소 정기 검진 받는 병원 (주치의)
 *  - delivery : 실제 출산 예정 병원 (친정 등 사유로 다를 수 있음)
 *
 * SOS '분만실 전화하기' 버튼은 우선순위:
 *   delivery 직통번호 → delivery 대표번호 → clinic 직통번호 → clinic 대표번호
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type HospitalKind = 'clinic' | 'delivery';

export interface HospitalInfo {
  /** 병원 이름 */
  name: string;
  /** 대표 전화번호 */
  mainPhone: string;
  /** 분만실 직통 번호 (선택) */
  deliveryWardPhone?: string;
  /** 주소 (선택, 지도 검색용) */
  address?: string;
  /** 산모 메모 (가족분만실 유무 등) */
  memo?: string;
  /** 마지막 업데이트 ISO */
  updatedAt: string;
}

const KEY = (childId: string, kind: HospitalKind) => `hospital_${kind}_${childId}`;

export async function getHospital(
  childId: string,
  kind: HospitalKind,
): Promise<HospitalInfo | null> {
  if (!childId) return null;
  try {
    const raw = await AsyncStorage.getItem(KEY(childId, kind));
    if (!raw) return null;
    return JSON.parse(raw) as HospitalInfo;
  } catch {
    return null;
  }
}

export async function saveHospital(
  childId: string,
  kind: HospitalKind,
  info: Omit<HospitalInfo, 'updatedAt'>,
): Promise<void> {
  if (!childId) return;
  const data: HospitalInfo = { ...info, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEY(childId, kind), JSON.stringify(data));
}

export async function clearHospital(childId: string, kind: HospitalKind): Promise<void> {
  await AsyncStorage.removeItem(KEY(childId, kind));
}

export type PhoneSource = 'delivery_ward' | 'delivery_main' | 'clinic_ward' | 'clinic_main';

export interface PickedPhone {
  phone: string;
  source: PhoneSource;
  /** UI 표시용 짧은 라벨 (예: "분만실", "외래") */
  label: string;
  /** UI 표시용 부가 설명 (예: "밤/주말 우선", "낮 진료시간 우선") */
  subLabel?: string;
}

/**
 * 평일 09:00 ~ 18:00 = 외래(낮) 시간, 그 외 = 분만실(밤/주말) 시간으로 판정.
 */
function isClinicHours(now: Date = new Date()): boolean {
  const dow = now.getDay();           // 0=일, 6=토
  const hour = now.getHours();
  const isWeekday = dow >= 1 && dow <= 5;
  return isWeekday && hour >= 9 && hour < 18;
}

/**
 * 분만실 전화 번호 우선순위 picker — 시간대 스위칭 적용.
 *
 * 외래(낮) 시간: clinic.mainPhone (외래 대표) → delivery.mainPhone → delivery.deliveryWardPhone → clinic.deliveryWardPhone
 * 분만실(밤/주말) 시간: delivery.deliveryWardPhone → delivery.mainPhone → clinic.deliveryWardPhone → clinic.mainPhone
 *
 * options.now 로 테스트 가능.
 */
export async function pickDeliveryPhone(
  childId: string,
  options?: { now?: Date },
): Promise<PickedPhone | null> {
  const delivery = await getHospital(childId, 'delivery');
  const clinic = await getHospital(childId, 'clinic');
  const clinicTime = isClinicHours(options?.now);

  // 후보 조립
  type Cand = { phone?: string; source: PhoneSource; label: string; subLabel?: string };
  const all: Cand[] = [
    { phone: delivery?.deliveryWardPhone, source: 'delivery_ward', label: '분만실 직통', subLabel: '밤/주말 우선' },
    { phone: delivery?.mainPhone, source: 'delivery_main', label: '분만 병원 대표' },
    { phone: clinic?.deliveryWardPhone, source: 'clinic_ward', label: '진료 병원 분만실', subLabel: '밤/주말 우선' },
    { phone: clinic?.mainPhone, source: 'clinic_main', label: '외래 대표', subLabel: '낮 진료시간 우선' },
  ];

  // 시간대별 우선순위 재정렬
  const order: PhoneSource[] = clinicTime
    ? ['clinic_main', 'delivery_main', 'delivery_ward', 'clinic_ward']
    : ['delivery_ward', 'delivery_main', 'clinic_ward', 'clinic_main'];

  for (const src of order) {
    const cand = all.find((c) => c.source === src);
    if (cand?.phone) {
      return { phone: cand.phone, source: cand.source, label: cand.label, subLabel: cand.subLabel };
    }
  }
  return null;
}

/**
 * 등록된 모든 전화번호를 시간대 우선순위 정렬해 반환.
 * 진진통 시 "어디로 전화할까요?" 선택지에 사용 — 1개면 바로, 여러 개면 선택 모달.
 */
export async function pickAllPhones(
  childId: string,
  options?: { now?: Date },
): Promise<PickedPhone[]> {
  const delivery = await getHospital(childId, 'delivery');
  const clinic = await getHospital(childId, 'clinic');
  const clinicTime = isClinicHours(options?.now);

  type Cand = { phone?: string; source: PhoneSource; label: string; subLabel?: string };
  const all: Cand[] = [
    { phone: delivery?.deliveryWardPhone, source: 'delivery_ward', label: '분만실 직통', subLabel: '밤/주말 우선' },
    { phone: delivery?.mainPhone, source: 'delivery_main', label: '분만 병원 대표' },
    { phone: clinic?.deliveryWardPhone, source: 'clinic_ward', label: '진료 병원 분만실', subLabel: '밤/주말 우선' },
    { phone: clinic?.mainPhone, source: 'clinic_main', label: '외래 대표', subLabel: '낮 진료시간 우선' },
  ];

  const order: PhoneSource[] = clinicTime
    ? ['clinic_main', 'delivery_main', 'delivery_ward', 'clinic_ward']
    : ['delivery_ward', 'delivery_main', 'clinic_ward', 'clinic_main'];

  const out: PickedPhone[] = [];
  for (const src of order) {
    const cand = all.find((c) => c.source === src);
    if (cand?.phone) {
      out.push({ phone: cand.phone, source: cand.source, label: cand.label, subLabel: cand.subLabel });
    }
  }
  return out;
}
