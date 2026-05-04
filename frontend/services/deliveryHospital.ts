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
  /** 분만실 직통 번호 (선택) — 대학병원이면 'MFICU/분만실' 통합 */
  deliveryWardPhone?: string;
  /** 주소 (선택, 지도 검색용) */
  address?: string;
  /** 산모 메모 (가족분만실 유무 등) */
  memo?: string;
  /**
   * 대학병원/상급종합병원 여부 (옵션, 기본 false).
   * true 면:
   *  - 외래 야간/주말 연결 안 됨 → 낮에도 분만실/MFICU 강조 노출
   *  - 라벨이 "분만실 직통" → "고위험 산모센터/분만실" 로 표시
   */
  isUniversityHospital?: boolean;
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
  /** 사용자가 등록한 실제 병원명 (예: "삼성서울병원") — 모달 가독성 ↑ */
  hospitalName?: string;
}

/**
 * 외래(낮) 시간 판정 — 한국 의료 운영 패턴 반영.
 *
 *   평일(월~금): 09:00 ~ 18:00 = 외래 운영
 *   토요일      : 09:00 ~ 13:00 = 외래 운영 (오후 1시 이후는 외래 닫힘 — 간호사 실무 기준)
 *   일요일/공휴일: 24시간 분만실 (외래 운영 안함)
 *
 * TODO: 공휴일 캘린더 연동 — 현재는 일요일만 휴일 처리.
 */
function isClinicHours(now: Date = new Date()): boolean {
  const dow = now.getDay();           // 0=일, 6=토
  const hour = now.getHours();
  // 평일 09-18 = 외래
  if (dow >= 1 && dow <= 5) return hour >= 9 && hour < 18;
  // 토요일 09-13 = 외래 (13시 이후는 분만실 우선)
  if (dow === 6) return hour >= 9 && hour < 13;
  // 일요일 = 분만실 24시간
  return false;
}

/**
 * 분만실 전화 번호 우선순위 picker — 시간대 + 병원급 스위칭 적용.
 *
 * 일반 의원/종합병원:
 *   외래(낮) 시간: clinic.mainPhone → delivery.mainPhone → delivery.deliveryWardPhone → clinic.deliveryWardPhone
 *   분만실(밤/주말): delivery.deliveryWardPhone → delivery.mainPhone → clinic.deliveryWardPhone → clinic.mainPhone
 *
 * 대학병원(상급종합) — delivery.isUniversityHospital === true:
 *   외래/야간 무관: delivery.deliveryWardPhone(MFICU/분만실) → delivery.mainPhone → clinic.* (시간대 적용)
 *   ※ 대학병원 외래는 응급 연결이 안되므로 분만실(MFICU) 직통이 항상 1순위.
 *
 * options.now 로 테스트 가능.
 */
function buildCandidates(
  delivery: HospitalInfo | null,
  clinic: HospitalInfo | null,
): { phone?: string; source: PhoneSource; label: string; subLabel?: string; hospitalName?: string }[] {
  const isUni = delivery?.isUniversityHospital === true;
  return [
    {
      phone: delivery?.deliveryWardPhone,
      source: 'delivery_ward',
      label: isUni ? '고위험 산모센터(MFICU) / 분만실' : '분만실 직통',
      subLabel: isUni ? '대학병원 — 24시간 응급 연결' : '밤/주말 우선',
      hospitalName: delivery?.name,
    },
    {
      phone: delivery?.mainPhone,
      source: 'delivery_main',
      label: '분만 병원 대표',
      subLabel: isUni ? '교환 통해 분만실 연결 요청' : undefined,
      hospitalName: delivery?.name,
    },
    {
      phone: clinic?.deliveryWardPhone,
      source: 'clinic_ward',
      label: '진료 병원 분만실',
      subLabel: '밤/주말 우선',
      hospitalName: clinic?.name,
    },
    {
      phone: clinic?.mainPhone,
      source: 'clinic_main',
      label: '외래 대표',
      subLabel: '낮 진료시간 우선',
      hospitalName: clinic?.name,
    },
  ];
}

function buildOrder(
  delivery: HospitalInfo | null,
  clinicTime: boolean,
): PhoneSource[] {
  const isUni = delivery?.isUniversityHospital === true;
  // 대학병원: 시간대와 무관하게 분만실(MFICU) 직통이 항상 1순위.
  if (isUni) {
    return clinicTime
      ? ['delivery_ward', 'delivery_main', 'clinic_main', 'clinic_ward']
      : ['delivery_ward', 'delivery_main', 'clinic_ward', 'clinic_main'];
  }
  // 일반 의원/종합병원: 시간대 스위칭.
  return clinicTime
    ? ['clinic_main', 'delivery_main', 'delivery_ward', 'clinic_ward']
    : ['delivery_ward', 'delivery_main', 'clinic_ward', 'clinic_main'];
}

export async function pickDeliveryPhone(
  childId: string,
  options?: { now?: Date; isEmergency?: boolean },
): Promise<PickedPhone | null> {
  const delivery = await getHospital(childId, 'delivery');
  const clinic = await getHospital(childId, 'clinic');
  const clinicTime = isClinicHours(options?.now);

  const all = buildCandidates(delivery, clinic);
  const order = buildOrder(delivery, clinicTime);

  for (const src of order) {
    // 양수파수/출혈 등 위급 증상 시 외래(clinic_main) 후보 스킵 — 골든타임 사수
    if (options?.isEmergency && src === 'clinic_main') continue;
    const cand = all.find((c) => c.source === src);
    if (cand?.phone) {
      return {
        phone: cand.phone,
        source: cand.source,
        label: cand.label,
        subLabel: cand.subLabel,
        hospitalName: cand.hospitalName,
      };
    }
  }
  return null;
}

/**
 * 등록된 모든 전화번호를 시간대 + 병원급 우선순위 정렬해 반환.
 * 진진통 시 "어디로 전화할까요?" 선택지에 사용 — 1개면 바로, 여러 개면 선택 모달.
 *
 * options.isEmergency = true 면 외래(clinic_main) 후보를 제외 — 양수파수/출혈 등 위급 증상 시 사용.
 *   대낮이라도 외래로는 응급 안 받으므로 분만실/MFICU 직통과 분만 병원 대표(교환→분만실)만 노출.
 */
export async function pickAllPhones(
  childId: string,
  options?: { now?: Date; isEmergency?: boolean },
): Promise<PickedPhone[]> {
  const delivery = await getHospital(childId, 'delivery');
  const clinic = await getHospital(childId, 'clinic');
  const clinicTime = isClinicHours(options?.now);

  const all = buildCandidates(delivery, clinic);
  const order = buildOrder(delivery, clinicTime);

  const out: PickedPhone[] = [];
  for (const src of order) {
    // 양수파수/출혈 등 위급 증상 시 외래(clinic_main) 후보 스킵 — 골든타임 사수
    if (options?.isEmergency && src === 'clinic_main') continue;
    const cand = all.find((c) => c.source === src);
    if (cand?.phone) {
      out.push({
        phone: cand.phone,
        source: cand.source,
        label: cand.label,
        subLabel: cand.subLabel,
        hospitalName: cand.hospitalName,
      });
    }
  }
  return out;
}
