#!/usr/bin/env node
/**
 * 自動更新が効いているかの検証（npm run check:refresh）。
 *
 * dist を配信してブラウザで開き、別経路（別ユーザー／DB直）でデータを変えて、
 * 画面が自分で追いつくかを見る：
 *   ① 通知画面を開いたまま新しい通知が届く（定期取得）
 *   ② 別の人が出したタネが、画面を移動して戻ると出る（フォーカス時の取り直し）
 *
 * 事前に `npx expo export --platform web` で dist を作っておくこと。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from 'playwright-core';
const { chromium } = pw;
import { browserPath } from './lib/browser.mjs';

const R = new URL('../', import.meta.url).pathname;
const env = fs.readFileSync(R + '.env', 'utf8');
const U = env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m)[1].trim();
const K = env.match(/^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m)[1].trim();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(R + 'dist', u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(R + 'dist', 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(8899, r));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const t = (l, ok, x = '') => { console.log((ok ? '  ✅ ' : '  ❌ ') + l + (x ? '  ' + x : '')); ok ? pass++ : fail++; };

// 別経路（サーバ側）でデータを変える
const login = async (email) => (await (await fetch(U + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'password' }) })).json());
const metan = await login('metan@example.com');
const haru = await login('haru@example.com');
const h = (tok) => ({ apikey: K, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' });

const browser = await chromium.launch({ executablePath: browserPath() });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:8899/', { waitUntil: 'domcontentloaded' });
await wait(3500);
const inputs = await page.locator('input').all();
await inputs[0].fill('metan@example.com');
await inputs[1].fill('password');
await page.getByText('ログイン', { exact: false }).last().click().catch(() => {});
await wait(6000);

// ── 1. 通知の自動更新（20秒間隔） ────────────────────────
console.log('\n① 通知：画面を開いたまま新しい通知が届くか');
await page.goto('http://127.0.0.1:8899/notifications', { waitUntil: 'domcontentloaded' });
await wait(2500);
const before = (await page.locator('body').innerText()).length;
const uniq = 'テスト通知' + Date.now().toString().slice(-5);
// はるさんの権限では他人に通知を作れないので、service_role 相当の経路は使わず
// DB に直接入れる（検証用）
const pgMod = await import('pg');
const Client = (pgMod.default ?? pgMod).Client;
const dbUrl = fs.readFileSync(R + '.env.local', 'utf8').match(/^SUPABASE_DB_URL=(.*)$/m)[1].trim();
const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, query_timeout: 20000 });
await c.connect();
await c.query("insert into notifications (user_id, type, body) values ('00000000-0000-0000-0000-0000000000a2','message',$1)", [uniq]);
console.log('  （DBに通知を1件追加しました。画面は開いたまま）');
let appeared = false;
for (let i = 0; i < 12; i++) {   // 最大24秒待つ
  await wait(2000);
  if ((await page.locator('body').innerText()).includes(uniq)) { appeared = true; break; }
}
t('開いたままで新しい通知が出る（定期取得）', appeared, appeared ? '' : '24秒待っても出ませんでした');

// ── 2. 画面に戻ったときの取り直し ──────────────────────
console.log('\n② ホーム：別の人が出した新しいタネが、戻ってきたときに出るか');
await page.goto('http://127.0.0.1:8899/', { waitUntil: 'domcontentloaded' });
await wait(3000);
const seedName = '自動更新テスト' + Date.now().toString().slice(-5);
await fetch(U + '/rest/v1/rpc/plant_seed', { method: 'POST', headers: h(haru.access_token),
  body: JSON.stringify({ p_user_id: haru.user.id, p_name: seedName, p_description: '検証用', p_category: '家電', p_condition: '新品・未使用' }) });
console.log('  （はるさんが新しいタネを出しました）');
// 別画面へ行って戻る＝フォーカスの取り直しが走る
await page.goto('http://127.0.0.1:8899/mypage', { waitUntil: 'domcontentloaded' });
await wait(1500);
await page.goto('http://127.0.0.1:8899/search', { waitUntil: 'domcontentloaded' });
await wait(3000);
const found = (await page.locator('body').innerText()).includes(seedName);
t('別の人の新しいタネが、画面遷移後に出る', found, found ? '' : '出ませんでした');

// 後片付け
await c.query("delete from notifications where body = $1", [uniq]);
await c.query("delete from items where name = $1", [seedName]);
await c.end();

console.log(`\n──────── ${pass} 通過 / ${fail} 失敗 ────────`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);
