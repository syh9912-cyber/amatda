/**
 * 토큰 암호화 유틸 — Firestore에 평문 저장하면 안 되는 단기 비밀(소셜 access_token 등)용.
 *
 * 알고리즘: AES-256-GCM (인증된 암호화)
 *   - IV 12바이트 (NIST 권장)
 *   - authTag 16바이트
 *   - 키 32바이트 (256비트)
 *
 * 형식: 'gcm:<iv-base64>:<ciphertext-base64>:<authTag-base64>'
 *
 * 키 출처: env.TOKEN_ENCRYPTION_KEY (hex 64자 = 32바이트). 미설정이면 평문 그대로
 *   저장(=현재 동작 유지). 운영 강화 시 firebase functions:secrets:set TOKEN_ENCRYPTION_KEY 로 등록.
 *
 * 호환성:
 *   - encryptToken(plain): 키 있으면 'gcm:...' 반환, 없으면 plain 그대로
 *   - decryptToken(stored): 'gcm:' prefix 감지하면 복호화, 아니면 그대로 반환
 *   → 기존 평문 토큰도 unlink 호출 가능. 점진적 마이그레이션.
 */

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'gcm:';

let cachedKey: Buffer | null = null;
let warnedMissing = false;

function loadKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  // .trim() — Secret Manager 등록 시 stdin 끝 newline 이 포함되는 경우 방어
  // (console.log 출력값을 secret 으로 등록 시 \n 1자 추가됨 → 길이 검증 실패).
  const hex = (process.env.TOKEN_ENCRYPTION_KEY || '').trim();
  if (!hex) {
    if (!warnedMissing) {
      console.warn(
        '[crypto] TOKEN_ENCRYPTION_KEY 미설정 — 소셜 access_token 평문 저장됩니다. ' +
        '운영 강화 시 32바이트(64 hex) 키를 secret 으로 등록하세요.',
      );
      warnedMissing = true;
    }
    return null;
  }
  if (hex.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY 형식 오류: hex 64자(32바이트) 필요. ' +
      `현재 길이: ${hex.length}`,
    );
  }
  cachedKey = Buffer.from(hex, 'hex');
  if (cachedKey.length !== 32) {
    cachedKey = null;
    throw new Error('TOKEN_ENCRYPTION_KEY hex 디코드 실패');
  }
  return cachedKey;
}

/**
 * 토큰을 암호화한 형태로 직렬화. 키 미설정 시 평문 반환(=회귀 없음).
 */
export function encryptToken(plain: string): string {
  if (!plain) return plain;
  const key = loadKey();
  if (!key) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`;
}

/**
 * 저장된 값을 복호화. 'gcm:' prefix 없으면 (legacy 평문) 그대로 반환.
 * 키가 없는데 'gcm:' prefix 가 들어오면 throw — 이전에 암호화된 값을 키 없이 풀 수 없으므로.
 */
export function decryptToken(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored; // legacy 평문

  const key = loadKey();
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY 가 필요합니다 (저장된 토큰이 암호화되어 있음)');
  }

  const body = stored.slice(PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) throw new Error('암호화 토큰 형식 오류');
  const [ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
