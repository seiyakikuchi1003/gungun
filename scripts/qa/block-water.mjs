/**
 * ブロックした相手の商品に水やりできてしまわないか（G-9）。
 *
 *   node scripts/qa/block-water.mjs http://localhost:4740
 *
 * 一覧からは消える（P-3 で確認済み）が、URL を直接開いた場合はどうか。
 * 通知やブックマークから辿り着ける経路があるので、ここが閉じていないと
 * 「ブロックしたのに関わってしまう」ことになる。
 */
import { launch, session, outDir } from './lib.mjs';

const BASE = (process.argv[2] || 'http://localhost:4740').replace(/\/$/, '');
const dir = outDir('block-water');
const browser = await launch();

const s = await session(browser, { base: BASE, email: 'haru@example.com', password: 'password', label: 'B', dir });
await s.login();

// 他人の出品を開いて URL を控える
await s.page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
await s.page.waitForTimeout(1800);
const box = s.page.locator('input').first();
await box.fill('Nintendo Switch');
await box.press('Enter');
await s.page.waitForTimeout(2200);
await s.tap('Nintendo Switch');
await s.page.waitForTimeout(2500);
const url = s.page.url();
const before = await s.step('ブロック前');
const canWaterBefore = before.text.some((t) => t.includes('この商品に水やりする'));
console.log(`  ブロック前に水やりできる: ${canWaterBefore}`);

// ブロックする
await s.page.mouse.click(358, 26);
await s.page.waitForTimeout(900);
const menu = await s.visibleText();
const row = menu.find((t) => t.includes('さんをブロックする'));
if (!row) { console.log('  ✗ ブロックのメニューが出ない'); process.exit(1); }
await s.tap(row);
await s.page.waitForTimeout(1200);
await s.tap('ブロックする');
await s.page.waitForTimeout(3000);

// URL を直接開き直す
await s.page.goto(url, { waitUntil: 'domcontentloaded' });
await s.page.waitForTimeout(3000);
const after = await s.step('ブロック後に直接URLを開く', 'G-9');
const canWaterAfter = after.text.some((t) => t.includes('この商品に水やりする'));
console.log(`  ブロック後に水やりできる: ${canWaterAfter}`);
console.log(`  画面の文言: ${after.text.filter((t) => /水やり|ブロック/.test(t)).slice(0, 3).join(' / ')}`);

// 後始末
await s.page.goto(`${BASE}/mypage/blocks`, { waitUntil: 'domcontentloaded' });
await s.page.waitForTimeout(2200);
await s.tap('解除').catch(() => {});
await s.page.waitForTimeout(2000);
await s.finish();
await browser.close();

console.log(canWaterAfter
  ? '\n✗ ブロックした相手の商品に、URL から入れば水やりできてしまう（G-9 未実装）'
  : '\n✓ ブロックした相手には水やりできない（G-9）');
process.exit(canWaterAfter ? 1 : 0);
