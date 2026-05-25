/**
 * Apple App Store Server Notifications V2 — JWS 서명 검증.
 *
 * webhook 으로 들어온 signedPayload / signedTransactionInfo / signedRenewalInfo 의
 * Apple 발신 진위를 Apple Root CA 체인으로 검증한다.
 *
 * 정석 (Apple 공식 권장):
 *   1. JWS payload 의 헤더 → x5c 인증서 체인 추출
 *   2. 체인 root 가 Apple Root CA (G2/G3 등) 인지 확인
 *   3. leaf 인증서로 signature 검증
 *
 * 사용 라이브러리: @apple/app-store-server-library
 * 인증서 경로: src/services/payment/apple-root-cas/*.cer
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _verifier: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ASSL: any | null = null;
let _initFailed = false;

function loadRootCAs(): Buffer[] {
  // GCP Functions 런타임은 함수가 unpacked 된 dist 옆 같은 위치에 cer 파일 번들.
  // tsc build 시 .cer 파일은 자동 복사 안 됨 → firebase.json 의 functions.predeploy
  // 또는 별도 copy step 필요. 일단 src 경로 + dist 경로 모두 시도.
  const candidates = [
    path.join(__dirname, 'apple-root-cas'),
    path.join(__dirname, '..', '..', '..', 'src', 'services', 'payment', 'apple-root-cas'),
  ];
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.cer'));
      if (files.length === 0) continue;
      const buffers = files.map((f) => fs.readFileSync(path.join(dir, f)));
      logger.info('apple-jws-verifier', `loaded ${buffers.length} root CAs from ${dir}`);
      return buffers;
    } catch {
      /* try next */
    }
  }
  throw new Error('Apple Root CA 디렉토리를 찾을 수 없음');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getVerifier(): any | null {
  if (_verifier) return _verifier;
  if (_initFailed) return null;
  try {
    if (!env.APPLE_BUNDLE_ID) {
      logger.warn('apple-jws-verifier', 'APPLE_BUNDLE_ID 미설정 — JWS 검증 비활성');
      _initFailed = true;
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _ASSL = require('@apple/app-store-server-library');
    const rootCAs = loadRootCAs();
    // production 환경. SANDBOX 와 PRODUCTION 모두 검증하려면 별도 인스턴스 필요.
    // 단 webhook payload 의 environment 필드로 자동 분기 가능 — 단순화 위해 production 기준.
    const env_ = _ASSL.Environment ? _ASSL.Environment.PRODUCTION : 'Production';
    _verifier = new _ASSL.SignedDataVerifier(
      rootCAs,
      true, // enableOnlineChecks (OCSP)
      env_,
      env.APPLE_BUNDLE_ID,
      undefined, // appAppleId (production 권장이나 sandbox 도 동작)
    );
    logger.info('apple-jws-verifier', 'initialized');
    return _verifier;
  } catch (e) {
    logger.warn(
      'apple-jws-verifier',
      `init 실패 — fallback to API-only verification: ${e instanceof Error ? e.message : String(e)}`,
    );
    _initFailed = true;
    return null;
  }
}

/**
 * App Store Server Notifications V2 의 signedPayload(JWS) 서명 검증 + 디코드.
 *
 * 반환:
 *   - ok=true + payload: 검증 통과, payload 사용 가능
 *   - ok=false: 검증 실패 (위변조 또는 라이브러리 미초기화)
 *
 * fail-safe: 라이브러리 init 실패 시 ok=true + payload(unverified) — 기존 동작 유지.
 *   (Apple API 재조회가 ground truth 역할, JWS 는 추가 방어층)
 */
export async function verifyAppleNotificationPayload(
  signedPayload: string,
): Promise<{ ok: boolean; verified: boolean; payload?: unknown; reason?: string }> {
  const verifier = getVerifier();
  if (!verifier) {
    return { ok: true, verified: false, reason: 'verifier-unavailable' };
  }
  try {
    const payload = await verifier.verifyAndDecodeNotification(signedPayload);
    return { ok: true, verified: true, payload };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    logger.warn('apple-jws-verifier', `verify FAILED: ${reason}`);
    return { ok: false, verified: false, reason };
  }
}

/**
 * signedTransactionInfo JWS 검증.
 */
export async function verifyAppleSignedTransaction(
  signedTransactionInfo: string,
): Promise<{ ok: boolean; verified: boolean; payload?: unknown; reason?: string }> {
  const verifier = getVerifier();
  if (!verifier) {
    return { ok: true, verified: false, reason: 'verifier-unavailable' };
  }
  try {
    const payload = await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
    return { ok: true, verified: true, payload };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    logger.warn('apple-jws-verifier', `verify transaction FAILED: ${reason}`);
    return { ok: false, verified: false, reason };
  }
}
