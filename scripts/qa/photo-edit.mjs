/**
 * 写真の切り抜き（D-2・G-3）と、商品写真の見え方（E-1）。
 *
 *   node scripts/qa/photo-edit.mjs http://localhost:4720
 */
import { launch, session, outDir } from './lib.mjs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:4720').replace(/\/$/, '');
const PHOTO = path.resolve('assets/mikan.png');
const dir = outDir('photo-edit');
const browser = await launch();
const log = [];
const phase = async (name, fn) => {
  try { await fn(); log.push({ name, ok: true }); console.log(`  ✓ ${name}`); }
  catch (e) { log.push({ name, ok: false }); console.log(`  ✗ ${name}\n     ${String(e).slice(0, 200)}`); }
};

const s = await session(browser, { base: BASE, email: 'haru@example.com', password: 'password', label: 'P', dir });
await s.login();

const addPhoto = async () => {
  await s.tap('＋写真を追加').catch(async () => { await s.tap('写真を追加'); });
  await s.page.waitForTimeout(600);
  const chooser = s.page.waitForEvent('filechooser', { timeout: 10000 });
  await s.tap('ライブラリから選択');
  (await chooser).setFiles(PHOTO);
  await s.page.waitForTimeout(2500);
};

await phase('D-2 出品：追加した写真を切り抜ける', async () => {
  await s.page.goto(`${BASE}/plant/seed`, { waitUntil: 'domcontentloaded' });
  await s.page.waitForTimeout(2500);
  await addPhoto();
  // 写真が描かれるまで待つ。描かれる前に押すと「切り抜く」の帯に当たらない
  await s.page.waitForTimeout(2500);
  const r = await s.step('写真を追加した');
  if (!r.text.includes('切り抜く')) throw new Error('「切り抜く」の導線が出ていない');
  await s.tap('切り抜く');
  await s.page.waitForTimeout(3500);
  const c = await s.step('切り抜き画面');
  if (!s.page.url().includes('/crop')) throw new Error('切り抜き画面へ行かない');
  const t = c.text.join(' ');
  if (!/回転|回す/.test(t)) throw new Error(`回転の操作が見当たらない: ${c.text.slice(0, 10).join(' / ')}`);
});

await phase('G-3 水やり：出す写真も切り抜ける', async () => {
  await s.page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
  await s.page.waitForTimeout(1800);
  const box = s.page.locator('input').first();
  await box.fill('Nintendo Switch');
  await box.press('Enter');
  await s.page.waitForTimeout(2200);
  await s.tap('Nintendo Switch');
  await s.page.waitForTimeout(2500);
  await s.tap('この商品に水やりする');
  await s.page.waitForTimeout(2500);
  await s.tap('閉じる').catch(() => {});
  await addPhoto();
  const r = await s.step('水やりに写真を追加した');
  if (!r.text.includes('切り抜く')) throw new Error('「切り抜く」の導線が出ていない');
});

await phase('E-1 商品写真をカルーセルで見て拡大できる', async () => {
  await s.page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
  await s.page.waitForTimeout(1800);
  const box = s.page.locator('input').first();
  await box.fill('香水（未開封）');
  await box.press('Enter');
  await s.page.waitForTimeout(2200);
  await s.tap('香水（未開封）');
  await s.page.waitForTimeout(3000);
  const before = await s.step('商品詳細（写真が複数）');
  // 写真をタップして拡大が出るか
  await s.page.mouse.click(195, 190);
  await s.page.waitForTimeout(2000);
  const after = await s.step('写真をタップした後', 'E-1');
  const grew = await s.page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].map((i) => i.getBoundingClientRect().width);
    return Math.max(0, ...imgs);
  });
  if (grew < 300) throw new Error(`拡大されていない（最大の写真幅 ${grew}px）`);
});

await s.finish();
await browser.close();
const ng = log.filter((l) => !l.ok);
console.log(`\n完了。${log.length} 段階のうち ${ng.length} 件で止まりました。`);
console.log(dir);
