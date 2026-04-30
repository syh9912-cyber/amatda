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

/**
 * 분만실 전화 번호 우선순위 picker
 * delivery 우선 → clinic 폴백
 */
export async function pickDeliveryPhone(
  childId: string,
): Promise<{ phone: string; source: 'delivery_ward' | 'delivery_main' | 'clinic_ward' | 'clinic_main' } | null> {
  const delivery = await getHospital(childId, 'delivery');
  if (delivery?.deliveryWardPhone) return { phone: delivery.deliveryWardPhone, source: 'delivery_ward' };
  if (delivery?.mainPhone) return { phone: delivery.mainPhone, source: 'delivery_main' };
  const clinic = await getHospital(childId, 'clinic');
  if (clinic?.deliveryWardPhone) return { phone: clinic.deliveryWardPhone, source: 'clinic_ward' };
  if (clinic?.mainPhone) return { phone: clinic.mainPhone, source: 'clinic_main' };
  return null;
}
