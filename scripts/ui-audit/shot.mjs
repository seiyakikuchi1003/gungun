import { chromium } from 'playwright-core';

/** 指定倍率で文字を膨らませた画面を撮る（目視確認用） */
const BASE = process.argv[2];
const SCALE = Number(process.argv[3] || 1);
const OUT = process.argv[4];
const WIDTH = Number(process.argv[5] || 320);

const ROUTES = [
  ['home', '/'],
  ['harvest', '/harvest'],
  ['exchange', '/exchange'],
  ['mypage', '/mypage'],
  ['premium', '/premium'],
  ['board', '/board'],
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: 800 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.setItem('gungun.mock.authed', '1'));

for (const [name, route] of ROUTES) {
  await page.goto(BASE.replace(/\/$/, '') + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (SCALE !== 1) {
    // 端末で文字サイズを上げたときと同じ状態を作る。
    // RN では fontSize が倍率ぶん大きくなり、lineHeight は lh() で追従する。
    // Web の PixelRatio.getFontScale() は常に 1 なので、ここで両方を膨らませる。
    await page.evaluate((s) => {
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        if (fs > 0) el.style.setProperty('font-size', `${fs * s}px`, 'important');
        const lh = parseFloat(cs.lineHeight);
        if (lh > 0) el.style.setProperty('line-height', `${lh * s}px`, 'important');
      }
    }, SCALE);
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`撮影: ${name}`);
}
await browser.close();
