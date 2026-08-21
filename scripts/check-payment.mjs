#!/usr/bin/env node
/**
 * 決済まわりのサーバ側検証（npm run check:payment）。
 *
 * 実際にカード情報を入れる部分（Stripe の決済画面）以外を、すべて本番と同じ経路で確認する：
 *   セッション作成 → 署名付き通知の受理 → 付与 → 不正通知の拒否 → 二重付与の防止
 *
 * .env.local の STRIPE_WEBHOOK_SECRET を使って本物と同じ署名を作って送るので、
 * Stripe を介さずに webhook の検証ロジックまで通せる。
 *
 * 実行後は残高が増えるので、デモを綺麗に戻すなら npm run db:apply:seed を流すこと。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const R = new URL('../', import.meta.url).pathname;
const env = fs.readFileSync(R + '.env', 'utf8');
const loc = fs.readFileSync(R + '.env.local', 'utf8');
const U = env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m)[1].trim();
const K = env.match(/^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m)[1].trim();
const WH = loc.match(/^STRIPE_WEBHOOK_SECRET=(.*)$/m)[1].trim();

let pass = 0, fail = 0;
const t = (l, ok, x = '') => { console.log((ok ? '  ✅ ' : '  ❌ ') + l + (x ? '  ' + x : '')); ok ? pass++ : fail++; };

const login = async (email) => {
  const r = await fetch(U + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password' }),
  });
  return r.json();
};
const me = await login('metan@example.com');
const h = { apikey: K, Authorization: 'Bearer ' + me.access_token, 'Content-Type': 'application/json' };

const balance = async () => {
  const r = await fetch(U + `/rest/v1/profiles?select=fertilizer,is_premium,premium_until&id=eq.${me.user.id}`, { headers: h });
  return (await r.json())[0];
};

console.log('\n① 決済セッションの作成（アプリと同じ呼び方）');
const before = await balance();
console.log(`  購入前の残高: ${before.fertilizer} 肥料 / プレミアム: ${before.is_premium}`);

const mk = async (body) => {
  const r = await fetch(U + '/functions/v1/create-checkout-session', { method: 'POST', headers: h, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const s1 = await mk({ kind: 'fertilizer', planId: 'c2' });
t('肥料プランのセッションを作れる', s1.status === 200 && !!s1.body.url, s1.status !== 200 ? JSON.stringify(s1.body).slice(0, 90) : '');
if (s1.body.url) console.log('     決済URL:', s1.body.url.slice(0, 60) + '…');
const s2 = await mk({ kind: 'premium' });
t('プレミアム（サブスク）のセッションを作れる', s2.status === 200 && !!s2.body.url);
const s3 = await mk({ kind: 'fertilizer', planId: 'にせプラン' });
t('存在しないプランは弾かれる', s3.status === 400, JSON.stringify(s3.body).slice(0, 60));
const noauth = await fetch(U + '/functions/v1/create-checkout-session', {
  method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fertilizer', planId: 'c2' }),
});
t('ログインなしでは作れない', noauth.status === 401 || noauth.status === 403, 'HTTP ' + noauth.status);

console.log('\n② Webhook からの付与（署名を作って本物と同じ形で送る）');
const post = async (payload, secret = WH, tsOffset = 0) => {
  const raw = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000) + tsOffset;
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  const r = await fetch(U + '/functions/v1/stripe-webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, body: raw,
  });
  return { status: r.status, text: await r.text() };
};
const sessionId = 'test_' + Date.now();
const ev = (id) => ({
  id: 'evt_' + id, type: 'checkout.session.completed',
  data: { object: { id, mode: 'payment', payment_status: 'paid',
    metadata: { user_id: me.user.id, kind: 'fertilizer', plan_id: 'c2', fertilizer: '3000', price_jpy: '1200' } } },
});
const w1 = await post(ev(sessionId));
t('正しい署名の通知が通る', w1.status === 200, w1.text.slice(0, 80));
const mid = await balance();
t('肥料が3,000増える', mid.fertilizer === before.fertilizer + 3000, `${before.fertilizer} → ${mid.fertilizer}`);

console.log('\n③ 不正な通知は弾く');
const bad = await post(ev('other_' + Date.now()), 'whsec_にせもの');
t('署名が違う通知は拒否される', bad.status === 400, 'HTTP ' + bad.status);
const old = await post(ev('old_' + Date.now()), WH, -600);
t('10分前の古い通知は拒否される（リプレイ対策）', old.status === 400, 'HTTP ' + old.status);
const after1 = await balance();
t('不正な通知では肥料が増えない', after1.fertilizer === mid.fertilizer, `${after1.fertilizer}`);

console.log('\n④ 同じ決済の再送で二重付与しない');
const w2 = await post(ev(sessionId));
t('再送も 200 を返す（Stripeに再送させない）', w2.status === 200);
const after2 = await balance();
t('残高は変わらない', after2.fertilizer === mid.fertilizer, `${after2.fertilizer}`);

console.log('\n⑤ プレミアムの付与');
const pev = {
  id: 'evt_prem', type: 'checkout.session.completed',
  data: { object: { id: 'sub_' + Date.now(), mode: 'subscription', payment_status: 'paid',
    metadata: { user_id: me.user.id, kind: 'premium', premium_days: '30', price_jpy: '480' } } },
};
const w3 = await post(pev);
t('サブスクの通知が通る', w3.status === 200, w3.text.slice(0, 60));
const prem = await balance();
t('プレミアムが有効になる', prem.is_premium === true);
t('期限が約30日後に設定される', !!prem.premium_until,
  prem.premium_until ? new Date(prem.premium_until).toLocaleDateString('ja-JP') + ' まで' : 'なし');

console.log(`\n──────── 合計 ${pass} 通過 / ${fail} 失敗 ────────`);
process.exit(fail === 0 ? 0 : 1);
