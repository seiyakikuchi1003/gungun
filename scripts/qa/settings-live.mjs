/**
 * 管理画面で変えた値が、アプリを更新せずに反映されるか（M-4・T-7）。
 *
 *   node scripts/qa/settings-live.mjs http://localhost:4700
 *
 * 管理画面の書き込みは本番につながっているので押せない。ここでは同じことが
 * 起きるよう、dev の app_settings を直接書き換えて、**アプリを作り直さずに**
 * 画面の表示が変わるかを見る。仕組みとしてはこれが M-4 の中身。
 *
 * 終わったら必ず元の値に戻す。
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { launch, session, outDir } from './lib.mjs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:4700').replace(/\/$/, '');
const DEV_REF = 'bypjhlfcqzebmukwzthi';
const KEY = 'water_cost';
const TEST_VALUE = 137; // 見てすぐ分かる、ふだん出ない値

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
if (!env.SUPABASE_DB_URL?.includes(DEV_REF)) {
  console.error(`接続先が dev（${DEV_REF}）ではありません。中止します。`);
  process.exit(1);
}

const db = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

// value は jsonb。文字列で入れると "137" になり、アプリ側は数値として読めない
const read = async () => (await db.query('select value from app_settings where key = $1', [KEY])).rows[0]?.value;
const write = (v) => db.query('update app_settings set value = to_jsonb($1::int) where key = $2', [v, KEY]);
const original = await read();
console.log(`いまの ${KEY}: ${original}`);

const dir = outDir('settings');
const browser = await launch();
let ok = false;

try {
  const s = await session(browser, { base: BASE, email: 'metan@example.com', password: 'password', label: 'S', dir });
  await s.login();

  // 商品詳細の水やりボタンに「◯◯肥料」と出る。ここが変わるかを見る
  await s.page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
  await s.page.waitForTimeout(1800);
  const box = s.page.locator('input').first();
  await box.fill('Nintendo Switch');
  await box.press('Enter');
  await s.page.waitForTimeout(2200);
  await s.tap('Nintendo Switch');
  await s.page.waitForTimeout(2500);
  const before = await s.step('設定を変える前');
  console.log(`  変える前の表示: ${before.text.filter((t) => /肥料/.test(t)).join(' / ')}`);

  await write(TEST_VALUE);
  console.log(`  ${KEY} を ${TEST_VALUE} にした（アプリは作り直していない）`);

  // 開いたままの画面での再読み込み
  await s.page.reload({ waitUntil: 'domcontentloaded' });
  await s.page.waitForTimeout(4000);
  const reloaded = await s.step('同じ画面を再読み込み', `${KEY}=${TEST_VALUE}`);
  const okReload = reloaded.text.some((t) => t.trim() === String(TEST_VALUE));
  console.log(`  再読み込み後: ${okReload ? TEST_VALUE + ' に変わった' : '変わらない'}`);
  await s.finish();

  // 利用者が新しく開いた場合（まっさらな状態）
  const s2 = await session(browser, { base: BASE, email: 'metan@example.com', password: 'password', label: 'S2', dir });
  await s2.login();
  await s2.page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
  await s2.page.waitForTimeout(1800);
  const box2 = s2.page.locator('input').first();
  await box2.fill('Nintendo Switch');
  await box2.press('Enter');
  await s2.page.waitForTimeout(2200);
  await s2.tap('Nintendo Switch');
  await s2.page.waitForTimeout(3000);
  const fresh = await s2.step('新しく開いた場合', `${KEY}=${TEST_VALUE}`);
  const okFresh = fresh.text.some((t) => t.trim() === String(TEST_VALUE));
  console.log(`  新しく開いた場合: ${okFresh ? TEST_VALUE + ' に変わった' : '変わらない'}`);
  await s2.finish();
  ok = okReload || okFresh;
} finally {
  await write(original);
  console.log(`  ${KEY} を ${original} に戻しました`);
  await db.end();
  await browser.close();
}

console.log(ok
  ? '\n✓ アプリを作り直さずに反映されました（M-4）'
  : '\n✗ 反映されていません');
console.log(dir);
process.exit(ok ? 0 : 1);
