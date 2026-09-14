/**
 * 例外と通信まわり（S-1・S-2・S-3）。
 *
 *   node scripts/qa/edge.mjs http://localhost:4680
 *
 * 正常系と違って、わざと壊してから見る。
 *   S-3 通信を切って、日本語で理由が出るか（英語のまま出していないか）
 *   S-1 写真のアップロードだけ失敗させて、操作を続けられるか
 *   S-2 送信を二度押ししても、二重に登録されないか
 */
import { launch, session, outDir } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:4680').replace(/\/$/, '');
const PHOTO = path.resolve('assets/mikan.png');
const STAMP = new Date().toISOString().slice(11, 16).replace(':', '');

const dir = outDir('edge');
console.log(`記録先: ${dir}\n`);
const browser = await launch();
const log = [];
const phase = async (name, fn) => {
  try { await fn(); log.push({ name, ok: true }); console.log(`  ✓ ${name}`); }
  catch (e) { log.push({ name, ok: false, error: String(e).slice(0, 300) }); console.log(`  ✗ ${name}\n     ${String(e).slice(0, 220)}`); }
};

/** 英語のエラーがそのまま出ていないか。出ていたら人は読めない */
const ENGLISH = /[A-Za-z]{4,}\s+[A-Za-z]{4,}/;
const looksEnglish = (lines) =>
  lines.filter((t) => ENGLISH.test(t) && !/JavaScript|Supabase|QA|Apple Pay|Nintendo|AirPods|iPhone|CD|DVD/.test(t));

const S = await session(browser, { base: BASE, email: 'haru@example.com', password: 'password', label: 'E', dir });
await S.login();

// ── S-3：通信が切れているとき ──────────────────────────
await phase('S-3 通信が切れたときの表示', async () => {
  await S.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await S.page.waitForTimeout(2500);
  await S.page.context().setOffline(true);
  // 引っ張って更新のかわりに、取り直しが起きる画面へ移動する
  await S.page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await S.page.waitForTimeout(3500);
  const r = await S.step('通信を切った状態', 'S-3');
  const eng = looksEnglish(r.text);
  await S.page.context().setOffline(false);
  await S.page.waitForTimeout(1500);
  if (eng.length) throw new Error(`英語のまま出ている: ${eng.slice(0, 3).join(' / ')}`);
});

// ── S-1：写真のアップロードだけ失敗させる ──────────────
await phase('S-1 写真の保存が失敗しても続けられる', async () => {
  // Storage への PUT/POST だけ落とす
  await S.page.route('**/storage/v1/object/**', (route) => route.abort());
  await S.page.goto(`${BASE}/plant/seed`, { waitUntil: 'domcontentloaded' });
  await S.page.waitForTimeout(2200);
  await S.tap('＋写真を追加');
  await S.page.waitForTimeout(600);
  const chooser = S.page.waitForEvent('filechooser', { timeout: 10000 });
  await S.tap('ライブラリから選択');
  (await chooser).setFiles(PHOTO);
  await S.page.waitForTimeout(2500);
  await S.page.getByPlaceholder('商品名を入力してください').fill(`QA失敗 ${STAMP}`);
  await S.tap('タネを植える', { last: true });
  await S.page.waitForTimeout(4000);
  const r = await S.step('アップロードが失敗したとき', 'S-1');
  await S.page.unroute('**/storage/v1/object/**');

  // 画面が操作不能になっていないこと（入力欄がまだ触れる）
  const alive = await S.page.getByPlaceholder('商品名を入力してください').isEditable().catch(() => false);
  if (!alive) throw new Error('失敗したあと入力欄が触れない');
  const eng = looksEnglish(r.text);
  if (eng.length) throw new Error(`英語のまま出ている: ${eng.slice(0, 3).join(' / ')}`);
});

// ── S-2：二度押し ─────────────────────────────────────
await phase('S-2 掲示板の投稿を二度押ししても二重にならない', async () => {
  const text = `QA二度押し ${STAMP}`;
  await S.page.goto(`${BASE}/board/new`, { waitUntil: 'domcontentloaded' });
  await S.page.waitForTimeout(2200);
  const box = S.page.locator('textarea, input[type="text"]').first();
  await box.fill(text);
  await S.page.waitForTimeout(400);
  // 本当の連打にする。Playwright の click を2回呼ぶと間が空いてしまい、
  // 1回目が終わってからの2回目＝ただの2連続投稿になる
  const btn = S.page.locator('text="投稿" >> visible=true').last();
  await btn.evaluate((el) => { el.click(); el.click(); el.click(); });
  await S.page.waitForTimeout(4000);

  await S.page.goto(`${BASE}/board`, { waitUntil: 'domcontentloaded' });
  await S.page.waitForTimeout(3000);
  const r = await S.step('二度押しの後の掲示板', 'S-2');
  const n = r.text.filter((t) => t.includes(text)).length;
  if (n > 1) throw new Error(`同じ投稿が ${n} 件できている`);
});

await S.finish();
writeFileSync(path.join(dir, 'edge.json'), JSON.stringify(log, null, 2));
await browser.close();
const ng = log.filter((l) => !l.ok);
console.log(`\n完了。${log.length} 段階のうち ${ng.length} 件で止まりました。`);
console.log(dir);
