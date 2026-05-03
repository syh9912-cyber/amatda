/**
 * 출산가방 공유 — 카카오톡/링크/문자로 가족과 공유.
 *
 * 흐름:
 *   POST /api/birthbag-share         (auth) — 사용자가 자기 가방 데이터를 보냄 → token + url 반환
 *   GET  /api/birthbag-share/:token  (public) — HTML 페이지 렌더링 (앱 설치 없이 웹에서 보기)
 *   GET  /api/birthbag-share/:token/data (public) — JSON 데이터만
 *
 * 보관: Firestore `share_birthbag/{token}` — 30일 만료.
 * 보안: 민감정보(아이 실명, 출산예정일) 클라이언트가 보내지 않으면 저장 안 됨.
 *
 * ⚠️ TTL 정책: Firestore native TTL 적용 필요.
 *   문서에 'expiresAt' (Timestamp) 필드를 저장하고, Firebase Console에서
 *   share_birthbag 컬렉션의 expiresAt 필드에 TTL 정책을 활성화해야 자동 삭제됨.
 *   설정 방법: LAUNCH-CHECKLIST.md 또는
 *   `gcloud firestore fields ttls update expiresAt --collection-group=share_birthbag --enable-ttl`
 *   GET 핸들러 내 expiresAtMs 체크는 TTL 설정 미적용/지연된 경우 안전망.
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { db } from '../services/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';
import { randomBytes } from 'crypto';

const router = Router();

/**
 * 항목 업데이트 전용 rate-limit — 공유 토큰 보유자가 무한 호출하는 것을 방지.
 * 키는 토큰 단위(:token) — 토큰 한 건당 분당 30회까지 (UX 상 한 화면에서
 * 항목 30개 이상을 1분 안에 토글하기 어려움).
 */
const itemUpdateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `birthbag:${String(req.params.token || 'unknown').slice(0, 64)}`,
  message: { success: false, error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const COLLECTION = 'share_birthbag';
const SHARE_TTL_DAYS = 30;

interface ShareItem {
  id: string;
  label: string;
  hint?: string;
  category: 'mom' | 'baby' | 'docs';
  owner?: 'mom' | 'dad' | 'both' | null;
  status?: 'need' | 'ready' | 'packed' | 'na' | null;
  checked?: boolean;
}

interface SharePayload {
  ownerLabel?: string; // "엄마" or 익명 표시. 실명 X
  birthType?: 'natural' | 'csection';
  postpartumPlan?: 'sanhujowon' | 'home';
  items: ShareItem[];
}

function generateToken(): string {
  // URL-safe 22자리
  return randomBytes(16).toString('base64url');
}

/* ===================== POST: 공유 링크 생성 ===================== */

router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) { error(res, '인증 필요', 401); return; }

    const body = req.body as Partial<SharePayload>;
    if (!body || !Array.isArray(body.items)) {
      error(res, 'items 배열이 필요합니다', 400);
      return;
    }

    // 검증/정제: 100개 초과 거부, 라벨 100자 제한
    if (body.items.length > 100) {
      error(res, '항목이 너무 많습니다', 400);
      return;
    }
    // Firestore는 undefined 거부 → null 또는 omit으로 처리
    const sanitizedItems = body.items.map((it) => {
      const item: Record<string, unknown> = {
        id: String(it.id || '').slice(0, 64),
        label: String(it.label || '').slice(0, 100),
        category: (['mom', 'baby', 'docs'] as const).includes(it.category as 'mom') ? it.category : 'mom',
        owner: it.owner === 'mom' || it.owner === 'dad' || it.owner === 'both' ? it.owner : null,
        status: ['need', 'ready', 'packed', 'na'].includes(String(it.status))
          ? it.status
          : null,
        checked: it.checked === true,
      };
      if (it.hint) item.hint = String(it.hint).slice(0, 200);
      return item;
    });

    const token = generateToken();
    const now = Date.now();
    const expiresAt = now + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000;

    await db.collection(COLLECTION).doc(token).set({
      ownerUserId: userId,
      ownerLabel: body.ownerLabel ? String(body.ownerLabel).slice(0, 20) : null,
      birthType: body.birthType === 'natural' || body.birthType === 'csection' ? body.birthType : null,
      postpartumPlan: body.postpartumPlan === 'sanhujowon' || body.postpartumPlan === 'home' ? body.postpartumPlan : null,
      items: sanitizedItems,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: now,
      expiresAtMs: expiresAt,
      // Firestore native TTL — expiresAt(Timestamp) 필드에 TTL 정책을 한 번 활성화하면
      // 만료 시점에 자동 삭제. 활성화: gcloud firestore fields ttls update expiresAt --collection-group=share_birthbag --enable-ttl
      expiresAt: Timestamp.fromMillis(expiresAt),
    });

    // 호스트 자체로 공유 링크 구성 (Cloud Run의 publicly accessible URL)
    const host = req.get('host') || 'api-usglfifguq-uc.a.run.app';
    const protocol = req.secure ? 'https' : 'https'; // Cloud Run은 항상 https
    const url = `${protocol}://${host}/api/birthbag-share/${token}`;

    success(res, { token, url, expiresAtMs: expiresAt });
  } catch (e) {
    logger.error('birthbag-share POST failed', e);
    error(res, '공유 링크 생성 실패', 500);
  }
});

/* ===================== GET JSON: 공유 데이터 조회 (public) ===================== */

router.get('/:token/data', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token || '').slice(0, 64);
    const snap = await db.collection(COLLECTION).doc(token).get();
    if (!snap.exists) { error(res, '만료되었거나 존재하지 않는 링크', 404); return; }
    const data = snap.data() as { expiresAtMs?: number; items?: ShareItem[]; birthType?: string; postpartumPlan?: string; ownerLabel?: string } | undefined;
    if (!data || (data.expiresAtMs && data.expiresAtMs < Date.now())) {
      error(res, '만료된 링크', 404);
      return;
    }
    success(res, {
      ownerLabel: data.ownerLabel ?? null,
      birthType: data.birthType ?? null,
      postpartumPlan: data.postpartumPlan ?? null,
      items: data.items ?? [],
    });
  } catch (e) {
    logger.error('birthbag-share GET data failed', { error: e instanceof Error ? e.message : String(e) });
    error(res, '데이터 조회 실패', 500);
  }
});

/* ===================== POST: 공유 페이지에서 항목 업데이트 (public, 토큰 보유자) ===================== */

router.post('/:token/items/:itemId', itemUpdateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token || '').slice(0, 64);
    const itemId = String(req.params.itemId || '').slice(0, 64);
    if (!token || !itemId) { error(res, 'token/itemId 필요', 400); return; }

    const { checked, status } = (req.body || {}) as { checked?: boolean; status?: string };
    const updates: { checked?: boolean; status?: string | null } = {};
    if (typeof checked === 'boolean') updates.checked = checked;
    if (status !== undefined) {
      if (status === null || ['need', 'ready', 'packed', 'na'].includes(String(status))) {
        updates.status = status === null ? null : String(status);
      } else {
        error(res, 'status 값이 올바르지 않습니다', 400);
        return;
      }
    }
    if (Object.keys(updates).length === 0) { error(res, '업데이트할 필드 없음', 400); return; }

    // 'packed' 상태면 자동 체크, 그 외면 자동 해제 (앱과 동일 로직)
    if (updates.status !== undefined) {
      updates.checked = updates.status === 'packed';
    } else if (updates.checked !== undefined) {
      // 체크만 토글 — 상태도 동기화 (✓ → packed, ✗ → packed였으면 ready)
      // 다음 트랜잭션에서 처리
    }

    const docRef = db.collection(COLLECTION).doc(token);

    // 트랜잭션으로 items 배열 안 특정 item 업데이트 (atomic)
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const data = snap.data() as { expiresAtMs?: number; items?: ShareItem[] };
      if (data.expiresAtMs && data.expiresAtMs < Date.now()) throw new Error('EXPIRED');
      const items = (data.items || []).map((it) => {
        if (it.id !== itemId) return it;
        const newItem: ShareItem = { ...it };
        if (updates.checked !== undefined) newItem.checked = updates.checked;
        if (updates.status !== undefined) {
          newItem.status = updates.status as ShareItem['status'];
        } else if (updates.checked === true) {
          newItem.status = 'packed';
        } else if (updates.checked === false && it.status === 'packed') {
          newItem.status = 'ready';
        }
        return newItem;
      });
      tx.update(docRef, { items });
    });

    success(res, { updated: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'NOT_FOUND' || msg === 'EXPIRED') {
      error(res, '만료된 링크', 404);
      return;
    }
    logger.error('birthbag-share POST item failed', e);
    error(res, '업데이트 실패', 500);
  }
});

/* ===================== GET HTML: 웹 페이지 (public, 앱 설치 X 가능) ===================== */

router.get('/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token || '').slice(0, 64);
    const snap = await db.collection(COLLECTION).doc(token).get();
    if (!snap.exists) {
      res.status(404).type('html').send(notFoundHtml());
      return;
    }
    const data = snap.data() as { expiresAtMs?: number; items?: ShareItem[]; birthType?: string; postpartumPlan?: string; ownerLabel?: string };
    if (data.expiresAtMs && data.expiresAtMs < Date.now()) {
      res.status(404).type('html').send(notFoundHtml());
      return;
    }
    const html = renderShareHtml({
      ownerLabel: data.ownerLabel ?? null,
      birthType: data.birthType ?? null,
      postpartumPlan: data.postpartumPlan ?? null,
      items: data.items ?? [],
    });
    // 공유 페이지는 인라인 script(데이터 임베드 + 필터 로직) 필요 → CSP 완화
    // 출력은 jsonForScriptTag + escapeHtml로 XSS 방어 완료된 상태
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'",
    );
    res.status(200).type('html').send(html);
  } catch (e) {
    logger.error('birthbag-share GET html failed', e);
    res.status(500).type('html').send(notFoundHtml());
  }
});

/* ===================== HTML 렌더 ===================== */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * <script> 태그 안 JSON 데이터 안전 직렬화 — XSS 방지.
 *
 * 위협: 사용자 입력에 "</script>" 가 들어 있으면 HTML 파서가 script 블록을
 *      일찍 종료시켜 XSS 가능.
 * 방어: "</" 를 "<\/" 로 치환 (JSON 안에서 \/ 는 / 로 복원되므로 무손실).
 */
function jsonForScriptTag(value: unknown): string {
  const json = JSON.stringify(value);
  const BACKSLASH = String.fromCharCode(92);
  // </ 를 <BACKSLASH/ 로 치환 — HTML 파서는 종료 태그로 보지 않음
  return json.split('</').join('<' + BACKSLASH + '/');
}

function notFoundHtml(): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>출산가방 — 만료된 링크</title><style>body{font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#FFF7F2;color:#1C1C1E;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}.card{background:#fff;border-radius:18px;padding:32px;text-align:center;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,0.06)}h1{font-size:18px;margin:0 0 8px}p{color:#636366;font-size:14px;margin:0}</style></head><body><div class="card"><h1>링크가 만료되었어요</h1><p>출산가방 공유 링크는 30일 동안만 유효해요.<br/>가족에게 새 링크를 받아주세요.</p></div></body></html>`;
}

function renderShareHtml(data: {
  ownerLabel: string | null;
  birthType: string | null;
  postpartumPlan: string | null;
  items: ShareItem[];
}): string {
  // 'na' 제외, hidden 클라이언트 단에서 이미 제거됨
  const visible = data.items.filter((it) => it.status !== 'na');
  const total = visible.length;
  const done = visible.filter((it) => it.checked).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const dadCount = visible.filter((it) => it.owner === 'dad' && !it.checked).length;
  const needCount = visible.filter((it) => it.status === 'need').length;

  const ownerName = data.ownerLabel ? escapeHtml(data.ownerLabel) : '엄마';
  const birthTypeLabel = data.birthType === 'natural' ? '자연분만' : data.birthType === 'csection' ? '제왕절개' : '';
  const planLabel = data.postpartumPlan === 'sanhujowon' ? '조리원' : data.postpartumPlan === 'home' ? '집 산후' : '';
  const sub = [birthTypeLabel, planLabel].filter(Boolean).join(' · ');

  const dataJson = jsonForScriptTag(visible);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<title>출산가방 — ${ownerName} 공유</title>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;padding:0;background:#F8F5F2;color:#1C1C1E;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif}
  .wrap{max-width:560px;margin:0 auto;padding:18px 16px 80px}
  .hero{background:linear-gradient(135deg,#FF8C5A,#FFA06B);color:#fff;border-radius:18px;padding:18px 16px;margin-bottom:14px}
  .hero h1{margin:0 0 4px;font-size:18px;font-weight:800}
  .hero .sub{font-size:12px;opacity:0.92;font-weight:600}
  .progressCard{background:#fff;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid #EFE6DC}
  .progressTop{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
  .progressLabel{font-size:13px;font-weight:700;color:#1C1C1E}
  .progressValue{font-size:15px;font-weight:900;color:#FF8C5A}
  .progressPct{font-size:12px;color:#636366;font-weight:700;margin-left:4px}
  .progressTrack{height:8px;background:#F2E6DC;border-radius:4px;overflow:hidden}
  .progressFill{height:100%;background:#FF8C5A;border-radius:4px;transition:width .3s}
  .chips{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
  .chip{flex:1;min-width:0;background:#F2E6DC;color:#5D4037;padding:6px;border-radius:10px;font-size:11px;font-weight:700;text-align:center}
  .chipNeed{background:#FFF3E0;color:#E65100}
  .chipDad{background:#E3F2FD;color:#1565C0}
  .chipDone{background:#E8F5E9;color:#2E7D32}
  .filterRow{display:flex;gap:6px;overflow-x:auto;padding:4px 0;margin-bottom:10px;scrollbar-width:none}
  .filterRow::-webkit-scrollbar{display:none}
  .filterChip{padding:6px 12px;border-radius:14px;background:#fff;border:1px solid #EFE6DC;font-size:12px;font-weight:700;color:#636366;white-space:nowrap;cursor:pointer}
  .filterChip.active{background:#FF8C5A;border-color:#FF8C5A;color:#fff;font-weight:900}
  .section{background:#fff;border-radius:14px;padding:12px;margin-bottom:10px;border:1px solid #EFE6DC}
  .sectionTitle{font-size:14px;font-weight:900;color:#1C1C1E;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
  .sectionCount{font-size:11px;color:#636366;font-weight:700}
  .item{display:flex;gap:10px;padding:8px 4px;align-items:flex-start;border-bottom:1px solid #F0E6DC}
  .item:last-child{border-bottom:none}
  .checkbox{width:24px;height:24px;border:1.5px solid #D6CDC2;border-radius:6px;flex-shrink:0;background:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;font-weight:900;margin-top:2px;cursor:pointer;transition:background .15s}
  .checkbox:active{transform:scale(0.92)}
  .checkbox.checked{background:#FF8C5A;border-color:#FF8C5A}
  .statusRow{display:flex;gap:4px;margin-top:6px;flex-wrap:wrap}
  .statusBtn{padding:4px 10px;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #E0D5C8;background:#FAFAFA;color:#636366;transition:all .15s}
  .statusBtn:active{transform:scale(0.95)}
  .statusBtn.active.need{background:#FFF3E0;border-color:#FFB74D;color:#E65100}
  .statusBtn.active.ready{background:#E8F5E9;border-color:#A5D6A7;color:#2E7D32}
  .statusBtn.active.packed{background:#E3F2FD;border-color:#90CAF9;color:#1565C0}
  .itemBody{flex:1}
  .itemLabel{font-size:13px;font-weight:600;color:#1C1C1E;line-height:18px}
  .itemLabel.checked{text-decoration:line-through;color:#9A9A9F}
  .itemHint{font-size:11px;color:#636366;font-weight:600;margin-top:2px}
  .tagRow{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
  .tag{padding:2px 8px;border-radius:8px;font-size:10px;font-weight:900}
  .tagOwner-mom{background:#FCE4EC;color:#C2185B}
  .tagOwner-dad{background:#E3F2FD;color:#1565C0}
  .tagOwner-both{background:#EDE7F6;color:#6A1B9A}
  .tagStatus-need{background:#FFF3E0;color:#E65100}
  .tagStatus-ready{background:#E8F5E9;color:#2E7D32}
  .tagStatus-packed{background:#E3F2FD;color:#1565C0}
  .empty{padding:30px 20px;text-align:center;color:#9A9A9F;font-size:13px}
  .footer{text-align:center;font-size:11px;color:#9A9A9F;padding:24px 0;font-weight:600}
  .badge{display:inline-block;font-size:10px;font-weight:900;padding:2px 6px;border-radius:6px;background:#FFE0CC;color:#FF8C5A;margin-left:6px;vertical-align:middle}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>${ownerName}의 출산가방<span class="badge">공유</span></h1>
    ${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''}
  </div>

  <div class="progressCard">
    <div class="progressTop">
      <span class="progressLabel">진행률</span>
      <span class="progressValue">${done}/${total}<span class="progressPct">(${pct}%)</span></span>
    </div>
    <div class="progressTrack"><div class="progressFill" style="width:${pct}%"></div></div>
    <div class="chips">
      <div class="chip">총 ${total}</div>
      <div class="chip chipDone">완료 ${done}</div>
      <div class="chip chipNeed">구매필요 ${needCount}</div>
      <div class="chip chipDad">아빠 ${dadCount}</div>
    </div>
  </div>

  <div class="filterRow">
    <div class="filterChip active" data-filter="all">전체</div>
    <div class="filterChip" data-filter="todo">아직 안 챙긴 것</div>
    <div class="filterChip" data-filter="dad">아빠 담당</div>
    <div class="filterChip" data-filter="need">구매 필요</div>
    <div class="filterChip" data-filter="docs">서류만</div>
  </div>

  <div id="list"></div>

  <div class="footer">
    아맞다 — 출산가방 공유 (보기 전용) · 30일 후 만료
  </div>
</div>

<script>
const ITEMS = ${dataJson};
const CAT_LABEL = { mom: '엄마(산모) 가방', baby: '아기 가방', docs: '서류 가방' };
const STATUS_LABEL = { need: '구매 필요', ready: '준비 완료', packed: '가방에 넣음' };
const OWNER_LABEL = { mom: '엄마', dad: '아빠', both: '같이' };

function applyFilter(f) {
  return ITEMS.filter(it => {
    if (f === 'todo') return !it.checked;
    if (f === 'dad') return it.owner === 'dad';
    if (f === 'need') return it.status === 'need';
    if (f === 'docs') return it.category === 'docs';
    return true;
  });
}

const TOKEN = window.location.pathname.split('/').pop();
let CURRENT_FILTER = 'all';

function render(filter) {
  CURRENT_FILTER = filter;
  const items = applyFilter(filter);
  const list = document.getElementById('list');
  if (items.length === 0) {
    list.innerHTML = '<div class="section empty">해당하는 항목이 없어요</div>';
    return;
  }
  const byCat = { mom: [], baby: [], docs: [] };
  for (const it of items) (byCat[it.category] || byCat.mom).push(it);
  const html = ['mom', 'baby', 'docs']
    .filter(c => byCat[c].length > 0)
    .map(c => {
      const inner = byCat[c].map(it => {
        const cls = it.checked ? 'checked' : '';
        const ownerTag = it.owner && OWNER_LABEL[it.owner]
          ? '<span class="tag tagOwner-' + it.owner + '">' + OWNER_LABEL[it.owner] + '</span>'
          : '';
        const statusBtns = ['need', 'ready', 'packed'].map(s => {
          const active = it.status === s ? 'active' : '';
          return '<button class="statusBtn ' + active + ' ' + s + '" data-id="' + escapeHtml(it.id) + '" data-status="' + s + '">' + STATUS_LABEL[s] + '</button>';
        }).join('');
        return '<div class="item">'
          + '<div class="checkbox ' + cls + '" data-id="' + escapeHtml(it.id) + '">' + (it.checked ? '✓' : '') + '</div>'
          + '<div class="itemBody">'
          + '<div class="itemLabel ' + cls + '">' + escapeHtml(it.label) + '</div>'
          + (it.hint ? '<div class="itemHint">' + escapeHtml(it.hint) + '</div>' : '')
          + '<div class="statusRow">' + statusBtns + (ownerTag ? '<span style="margin-left:auto">' + ownerTag + '</span>' : '') + '</div>'
          + '</div></div>';
      }).join('');
      return '<div class="section">'
        + '<div class="sectionTitle">' + CAT_LABEL[c] + ' <span class="sectionCount">' + byCat[c].length + '개</span></div>'
        + inner
        + '</div>';
    }).join('');
  list.innerHTML = html;
  bindItemEvents();
  updateProgress();
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function updateProgress() {
  const visible = ITEMS.filter(it => it.status !== 'na');
  const total = visible.length;
  const done = visible.filter(it => it.checked).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const dadCount = visible.filter(it => it.owner === 'dad' && !it.checked).length;
  const needCount = visible.filter(it => it.status === 'need').length;
  const pv = document.querySelector('.progressValue');
  const pp = document.querySelector('.progressPct');
  const pf = document.querySelector('.progressFill');
  const chips = document.querySelectorAll('.progressCard .chip');
  if (pv) pv.firstChild.nodeValue = done + '/' + total;
  if (pp) pp.textContent = '(' + pct + '%)';
  if (pf) pf.style.width = pct + '%';
  if (chips.length >= 4) {
    chips[0].textContent = '총 ' + total;
    chips[1].textContent = '완료 ' + done;
    chips[2].textContent = '구매필요 ' + needCount;
    chips[3].textContent = '아빠 ' + dadCount;
  }
}

async function updateItem(itemId, payload) {
  try {
    const res = await fetch('/api/birthbag-share/' + TOKEN + '/items/' + itemId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return true;
  } catch (e) {
    alert('업데이트 실패. 잠시 후 다시 시도해주세요.');
    return false;
  }
}

function bindItemEvents() {
  // 체크박스 클릭 → 토글 + 상태도 자동 동기화
  document.querySelectorAll('.checkbox[data-id]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.id;
      const it = ITEMS.find(x => x.id === id);
      if (!it) return;
      const newChecked = !it.checked;
      it.checked = newChecked;
      // 자동 상태 동기화 (앱과 동일 로직)
      if (newChecked) it.status = 'packed';
      else if (it.status === 'packed') it.status = 'ready';
      render(CURRENT_FILTER);
      updateItem(id, { checked: newChecked });
    });
  });

  // 상태 버튼 클릭 → 상태 토글 (이미 active면 해제)
  document.querySelectorAll('.statusBtn[data-id]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.id;
      const status = el.dataset.status;
      const it = ITEMS.find(x => x.id === id);
      if (!it) return;
      const newStatus = it.status === status ? null : status;
      it.status = newStatus;
      // packed면 자동 체크, 그 외면 자동 해제
      it.checked = newStatus === 'packed';
      render(CURRENT_FILTER);
      updateItem(id, { status: newStatus });
    });
  });
}

document.querySelectorAll('.filterChip').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.filterChip').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    render(el.dataset.filter);
  });
});

render('all');
</script>
</body>
</html>`;
}

export default router;
