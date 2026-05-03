/**
 * 위치 유틸 — Haversine 거리 + bounding box 쿼리 보조.
 *
 * 작은 규모(<10k 사용자)에선 geohash 라이브러리 없이도 충분.
 * 흐름: 1) bounding box로 Firestore 쿼리(범위 필터) → 2) 정확 거리로 후처리.
 */

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

/** 두 좌표 사이 거리(km) — Haversine */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * 중심점 + 반경(km) → bounding box (lat/lng 범위).
 * Firestore range 쿼리는 단일 필드만 가능하므로
 * lat 범위로 1차 필터 → in-memory 에서 lng + 정확 거리 필터.
 */
export function radiusBoundingBox(center: LatLng, radiusKm: number): {
  minLat: number; maxLat: number;
  minLng: number; maxLng: number;
} {
  const latDelta = radiusKm / 110.574; // 위도 1도 ≈ 110.574 km
  const lngDelta = radiusKm / (111.320 * Math.cos(toRad(center.lat))); // 경도 1도 ≈ 111.320 * cos(lat)
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/**
 * 1자리 정밀도 geohash(간이) — 위/경도 정수부 기반.
 * 정확한 geohash 라이브러리 불필요. 단순 색인용.
 */
export function locationCellKey(lat: number, lng: number, precision = 1): string {
  const f = Math.pow(10, precision);
  const la = Math.round(lat * f) / f;
  const ln = Math.round(lng * f) / f;
  return `${la.toFixed(precision)},${ln.toFixed(precision)}`;
}

/** 좌표가 유효한지 검증 */
export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    isFinite(lat) && isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}
