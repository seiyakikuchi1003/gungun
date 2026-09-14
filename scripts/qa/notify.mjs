/**
 * 通知が「相手に」届くかを2アカウントで確かめる（E-6・E-7・K-2・L-2）。
 *
 *   node scripts/qa/notify.mjs http://localhost:4680
 *
 * 通知は自分の画面では作れない。B が A の商品にコメント／いいねし、
 * A の通知一覧に相手の名前つきで出るかを見る。
 */
import { launch, session, outDir } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:4680').replace(/\/$/, '');
const PHOTO = path.resolve('assets/mikan.png');
const STAMP = new Date().toISOString().slice(11, 16).replace(':', '');
const ITEM = `QA通知 ${STAMP}`;
const COMMENT = `QAコメント ${STAMP}`;

const dir = outDir('notify');
console.log(`記録先: ${dir}\n`);
const browser = await launch();
const log = [];
const phase = async (name, fn) => {
  try { await fn(); log.push({ name, ok: true }); console.log(`  ✓ ${name}`); }
  catch (e) { log.push({ name, ok: false, error: String(e).slice(0, 300) }); console.log(`  ✗ ${name}\n     ${String(e).slice(0, 200)}`); }
};

const A = await session(browser, { base: BASE, email: 'haru@example.com', password: 'password', label: 'A', dir });
const B = await session(browser, { base: BASE, email: 'metan@example.com', password: 'password', label: 'B', dir });
await A.login();
await B.login();

async function pickFirst(s, rowLabel) {
  const lines = () => s.visibleText();
  const before = new Set(await lines());
  let target;
  for (let i = 0; i < 2 && !target; i += 1) {
    if (i) await s.page.waitForTimeout(1500);
    await s.tap(i === 0 ? rowLabel : '選択してください');
    await s.page.waitForTimeout(1200);
    const after = await lines();
    target = after.find((t) => !before.has(t) && t.length > 1 && t.length < 30
      && !['キャンセル', '閉じる', '選択してください', rowLabel].includes(t));
  }
  if (!target) throw new Error(`${rowLabel} の選択肢が出てこない`);
  await s.tap(target);
  await s.page.waitForTimeout(900);
}

let itemUrl = null;

await phase('A が出品する', async () => {
  await A.page.goto(`${BASE}/plant/seed`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2200);
  await A.tap('＋写真を追加');
  await A.page.waitForTimeout(600);
  const chooser = A.page.waitForEvent('filechooser', { timeout: 10000 });
  await A.tap('ライブラリから選択');
  (await chooser).setFiles(PHOTO);
  await A.page.waitForTimeout(2500);
  await A.page.getByPlaceholder('商品名を入力してください').fill(ITEM);
  await A.page.getByPlaceholder('状態や使用期間などを書きましょう').fill('通知のテストです。');
  await pickFirst(A, 'カテゴリー');
  await pickFirst(A, '商品の状態');
  await A.tap('タネを植える', { last: true });
  await A.page.waitForTimeout(4000);
  await A.step('出品した');
});

await phase('B がコメントする（E-6）', async () => {
  await B.page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
  await B.page.waitForTimeout(1800);
  const search = B.page.locator('input').first();
  await search.fill(ITEM);
  await search.press('Enter');
  await B.page.waitForTimeout(2500);
  await B.tap(ITEM);
  await B.page.waitForTimeout(2500);
  itemUrl = B.page.url();
  const input = B.page.getByPlaceholder('コメントを書く…');
  await input.scrollIntoViewIfNeeded();
  // 下に固定された「水やりする」の帯に隠れるので、もう少し送る
  await B.page.mouse.wheel(0, 260);
  await B.page.waitForTimeout(800);
  await input.fill(COMMENT);
  await B.page.waitForTimeout(500);
  await B.step('コメントを書いた');
  // 送信ボタンはアイコンだけ。入力欄の次の兄弟がそれなので、DOM からたどる
  const box = await input.evaluate((el) => {
    const btn = el.nextElementSibling;
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!box) throw new Error('送信ボタンが見つからない');
  await B.page.mouse.click(box.x, box.y);
  await B.page.waitForTimeout(3000);
  const after = await B.step('コメントを送った');
  if (!after.text.some((t) => t.includes(COMMENT.slice(0, 8)))) throw new Error('コメントが出ていない');
});

await phase('B がいいねする（E-7）', async () => {
  await B.page.goto(itemUrl, { waitUntil: 'domcontentloaded' });
  await B.page.waitForTimeout(2500);
  // ハートは商品名の右。文字が無いので位置で押す
  await B.page.mouse.click(345, 379);
  await B.page.waitForTimeout(2500);
  await B.step('いいねした');
});

await phase('A の通知に届く', async () => {
  await A.page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(3000);
  const r = await A.step('Aの通知一覧', 'E-6・E-7');
  const t = r.text.join(' | ');
  const hasComment = /コメント/.test(t);
  const hasLike = /いいね/.test(t);
  const hasName = /めたん/.test(t);
  if (!hasComment) throw new Error(`コメントの通知が無い: ${r.text.slice(0, 12).join(' / ')}`);
  if (!hasLike) throw new Error('いいねの通知が無い');
  if (!hasName) throw new Error('通知に相手の名前が出ていない');
});

await A.finish();
await B.finish();
writeFileSync(path.join(dir, 'notify.json'), JSON.stringify(log, null, 2));
await browser.close();
const ng = log.filter((l) => !l.ok);
console.log(`\n完了。${log.length} 段階のうち ${ng.length} 件で止まりました。`);
console.log(dir);
