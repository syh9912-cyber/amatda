const jwt = require('jsonwebtoken');
const fs = require('fs');
const KEY = fs.readFileSync('../AuthKey_SQ3HB62VCH.p8');
const BASE = 'https://api.appstoreconnect.apple.com';
function tok() {
  return jwt.sign({}, KEY, { algorithm: 'ES256', expiresIn: '10m',
    issuer: '488debaf-47af-4d1c-8f5f-e9baa8dc1b24', audience: 'appstoreconnect-v1',
    header: { alg: 'ES256', kid: 'SQ3HB62VCH', typ: 'JWT' } });
}
async function api(method, path, body) {
  const res = await fetch(BASE + path, { method,
    headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  return { status: res.status, json: j };
}
async function findKor(subId, target) {
  let path = `/v1/subscriptions/${subId}/pricePoints?filter[territory]=KOR&limit=200`, best = null;
  for (let p = 0; p < 6 && path; p++) {
    const r = await api('GET', path);
    if (!r.json.data) break;
    for (const pp of r.json.data) {
      const price = parseFloat(pp.attributes.customerPrice);
      if (best === null || Math.abs(price - target) < Math.abs(parseFloat(best.attributes.customerPrice) - target)) best = pp;
    }
    path = r.json.links && r.json.links.next ? r.json.links.next.replace(BASE, '') : null;
  }
  return best;
}
const SUBS = [{ id: '6777005928', t: 3900 }, { id: '6777006158', t: 33900 }];

async function trySet(subId, ppId, variant) {
  let body;
  if (variant === 'A') body = { data: { type: 'subscriptionPrices',
    relationships: { subscription: { data: { type: 'subscriptions', id: subId } },
      subscriptionPricePoint: { data: { type: 'subscriptionPricePoints', id: ppId } } } } };
  if (variant === 'B') body = { data: { type: 'subscriptionPrices', attributes: { startDate: null },
    relationships: { subscription: { data: { type: 'subscriptions', id: subId } },
      subscriptionPricePoint: { data: { type: 'subscriptionPricePoints', id: ppId } } } } };
  const r = await api('POST', '/v1/subscriptionPrices', body);
  return r;
}
(async () => {
  for (const s of SUBS) {
    const pp = await findKor(s.id, s.t);
    console.log(`\nsub ${s.id} pricePoint ${pp.id} (KRW ${pp.attributes.customerPrice})`);
    for (const v of ['A', 'B']) {
      const r = await trySet(s.id, pp.id, v);
      console.log(`  variant ${v}:`, r.status, r.json.data ? 'OK ✅' : JSON.stringify(r.json.errors).slice(0, 220));
      if (r.json.data) break;
    }
  }
  console.log('\n== STATE ==');
  for (const s of SUBS) {
    const r = await api('GET', `/v1/subscriptions/${s.id}`);
    if (r.json.data) console.log(`  ${r.json.data.attributes.productId}: ${r.json.data.attributes.state}`);
  }
})().catch((e) => console.error('ERR', e.message));
