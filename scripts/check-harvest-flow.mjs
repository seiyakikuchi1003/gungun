#!/usr/bin/env node
/**
 * 収穫〜取引完了までの通しテスト（npm run check:harvest）。
 *
 * アプリと同じ経路で確認する：PostgREST + デモアカウントの実セッション。
 * DB関数を直接叩くのではなく HTTP 越しに叩くので、RLS・権限・スキーマキャッシュまで含めて通る。
 *
 *   収穫 → 交換の輪 → 発送 → 受け取り → 評価 → completed → パス外の枝の独立
 *
 * 実行前に `npm run db:apply:seed` でデモデータを入れ直すこと（収穫は1種1回のため）。
 * 2026-08-05 作成。デモアカウントがログインできない不具合を検出した。
 */
import fs from 'node:fs';
const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
const U = env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m)[1].trim();
const K = env.match(/^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m)[1].trim();

let pass = 0, fail = 0;
const t = (label, ok, extra = '') => {
  console.log((ok ? '  ✅ ' : '  ❌ ') + label + (extra ? '  ' + extra : ''));
  ok ? pass++ : fail++;
};
const h = (tok) => ({ apikey: K, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' });

async function login(email) {
  const r = await fetch(U + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password' }),
  });
  const j = await r.json();
  return { tok: j.access_token, uid: j.user?.id };
}
const get = async (tok, path) => (await fetch(U + '/rest/v1/' + path, { headers: h(tok) })).json();
async function rpc(tok, fn, body) {
  const r = await fetch(U + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h(tok), body: JSON.stringify(body) });
  return { status: r.status, text: await r.text() };
}

const metan = await login('metan@example.com');
const takusan = await login('takusan@example.com');
const kenta = await login('kenta@example.com');

console.log('\n① 収穫');
const seeds = await get(metan.tok, `items?select=id,name,status&parent_id=is.null&user_id=eq.${metan.uid}`);
const seed = seeds.find((s) => s.status === 'growing');
const tree = await get(metan.tok, `items?select=id,name,depth&root_id=eq.${seed.id}&order=depth`);
const BRANCH = 'b1000000-0000-4000-8000-000000000023';  // 収穫パスから外れる枝
const path = tree.filter((x) => x.id !== BRANCH);
const target = path[path.length - 1];
console.log(`  木: ${tree.map((x) => x.name).join(' / ')}`);
console.log(`  収穫する一本道: ${path.map((x) => x.name).join(' → ')}`);
const hv = await rpc(metan.tok, 'harvest', { p_root_id: seed.id, p_target_id: target.id });
t('収穫が成功する', hv.status < 300, hv.status >= 300 ? hv.text.slice(0, 80) : '');
const hid = JSON.parse(hv.text);

console.log('\n② 交換の輪');
const exAll = { metan: await get(metan.tok, 'exchanges?select=id,position,status,from_user_id,to_user_id&order=position'),
                takusan: await get(takusan.tok, 'exchanges?select=id,position,status,from_user_id,to_user_id&order=position'),
                kenta: await get(kenta.tok, 'exchanges?select=id,position,status,from_user_id,to_user_id&order=position') };
const uniq = new Map();
Object.values(exAll).flat().forEach((e) => uniq.set(e.id, e));
const ring = [...uniq.values()].sort((a, b) => a.position - b.position);
t('exchanges が3件できる', ring.length === 3, `実際=${ring.length}件`);
ring.forEach((e) => console.log(`     pos${e.position}: ${e.from_user_id.slice(-2)} → ${e.to_user_id.slice(-2)}  ${e.status}`));
t('輪が閉じている（最後の受取人＝起点のめたん）', ring[ring.length - 1]?.to_user_id === metan.uid);
t('各自1回ずつ発送する', new Set(ring.map((e) => e.from_user_id)).size === 3);
t('各自1回ずつ受け取る', new Set(ring.map((e) => e.to_user_id)).size === 3);

const items = await get(metan.tok, `items?select=id,name,status&id=in.(${path.map((x) => x.id).join(',')})`);
t('パス上の商品が trading になる', items.every((i) => i.status === 'trading'), items.map((i) => i.status).join(','));
const notif = await get(metan.tok, `notifications?select=id&type=eq.harvested&related_id=eq.${hid}`);
t('起点に収穫通知が届く', notif.length === 1);

console.log('\n③ 発送しないと受け取れない');
const mine = (who, u) => ({ send: ring.find((e) => e.from_user_id === u.uid), recv: ring.find((e) => e.to_user_id === u.uid) });
const mMetan = mine('metan', metan), mTaku = mine('takusan', takusan), mKenta = mine('kenta', kenta);
const early = await rpc(metan.tok, 'receive_exchange', { p_exchange_id: mMetan.recv.id });
t('発送前に受け取り報告すると弾かれる', early.status >= 300, early.status < 300 ? '通ってしまった' : JSON.parse(early.text).message?.slice(0, 40));

console.log('\n④ 発送 → 受け取り');
for (const [name, u, m] of [['めたん', metan, mMetan], ['たくさん', takusan, mTaku], ['けんた', kenta, mKenta]]) {
  const s = await rpc(u.tok, 'ship_exchange', { p_exchange_id: m.send.id });
  t(`${name} が発送報告できる`, s.status < 300, s.status >= 300 ? s.text.slice(0, 60) : '');
}
for (const [name, u, m] of [['めたん', metan, mMetan], ['たくさん', takusan, mTaku], ['けんた', kenta, mKenta]]) {
  const r = await rpc(u.tok, 'receive_exchange', { p_exchange_id: m.recv.id });
  t(`${name} が受け取り報告できる`, r.status < 300, r.status >= 300 ? r.text.slice(0, 60) : '');
}
const after = await get(metan.tok, 'exchanges?select=status');
t('全件 received になる', after.every((e) => e.status === 'received'), after.map((e) => e.status).join(','));

console.log('\n⑤ 評価 → 完了');
for (const [name, u, m] of [['めたん', metan, mMetan], ['たくさん', takusan, mTaku], ['けんた', kenta, mKenta]]) {
  const a = await rpc(u.tok, 'submit_rating', { p_exchange_id: m.send.id, p_score: 5, p_comment: '発送ありがとうございました' });
  const b = await rpc(u.tok, 'submit_rating', { p_exchange_id: m.recv.id, p_score: 5, p_comment: '良い商品でした' });
  t(`${name} が両方に評価を出せる`, a.status < 300 && b.status < 300, `${a.status}/${b.status}`);
}
const done = await get(metan.tok, `items?select=name,status&id=in.(${path.map((x) => x.id).join(',')})`);
t('評価が揃った商品が completed になる', done.every((i) => i.status === 'completed'), done.map((i) => `${i.name}:${i.status}`).join(' / '));

console.log('\n⑥ 分裂（パス外の枝）');
const [branch] = await get(metan.tok, `items?select=id,name,parent_id,root_id,status&id=eq.${BRANCH}`);
t('パス外の枝が新しいタネになる（parent_id=null）', branch?.parent_id === null, branch?.name);
t('パス外の枝の root_id が自分自身になる', branch?.root_id === branch?.id);
t('パス外の枝は growing のまま', branch?.status === 'growing', branch?.status);

console.log(`\n──────── 合計 ${pass} 通過 / ${fail} 失敗 ────────`);
process.exit(fail === 0 ? 0 : 1);
