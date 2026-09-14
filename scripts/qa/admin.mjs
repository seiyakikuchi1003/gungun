/**
 * 管理画面（T-1〜T-8）を確認する。
 *
 *   cd admin && npm run dev          # localhost:3100。localhost はパスワード不要
 *   node scripts/qa/admin.mjs http://localhost:3100
 *
 * ★ admin/.env.local は本番を指している。この台本は**読むだけ**にしてある。
 *   肥料の増減・利用停止・非表示・通報の対応・設定変更は、押さずに
 *   「操作できる状態か」だけを見る。書き込みまで試すには dev の service_role キーが要る。
 */
import { launch, session, outDir } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:3100').replace(/\/$/, '');
const dir = outDir('admin');
console.log(`記録先: ${dir}\n★ 読むだけ。データは変更しません。\n`);

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ja-JP' });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => {
  // 「Failed to load resource」はURLを持たないので、下の response 側で拾う
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) {
    errors.push(m.text().slice(0, 200));
  }
});
// どのURLで落ちたかを残す。console の文字だけでは追えない
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) {
    errors.push(`${r.status()} ${r.url().slice(0, 140)}`);
  }
});

const log = [];
let n = 0;
const look = async (name, route, want) => {
  n += 1;
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const file = path.join(dir, `${String(n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const text = await page.evaluate(() => document.body.innerText);
  const missing = want.filter((w) => !text.includes(w));
  const took = errors.splice(0, errors.length).filter((e) => !/favicon/.test(e));
  const ok = missing.length === 0 && took.length === 0;
  log.push({ name, route, ok, missing, errors: took });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${missing.length ? `  出ていない: ${missing.join(' / ')}` : ''}${took.length ? `  エラー ${took.length}件` : ''}`);
  return text;
};

await look('ダッシュボード', '/', ['登録', '出品', '通報']);
await look('ユーザー一覧', '/users', ['肥料']);
// 仕様（T-3）は「段・ツリー・状態で絞り込める」だが、実際の絞り込みは
// すべて／出品中／取引中／タネ／非表示にしたもの。段とツリーでの絞り込みは無い。
await look('商品一覧', '/items', ['出品中', '取引中', 'タネ', '非表示にしたもの']);
await look('通報', '/reports', ['通報']);
await look('設定', '/settings', ['肥料']);

writeFileSync(path.join(dir, 'admin.json'), JSON.stringify(log, null, 2));
await browser.close();
const ng = log.filter((l) => !l.ok);
console.log(`\n完了。${log.length} 画面のうち ${ng.length} 件に問題。`);
console.log(dir);
