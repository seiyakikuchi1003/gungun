import { chromium } from 'playwright-core';

/**
 * 文字サイズを大きくしたときの崩れ検査（2026-08-21 指摘）。
 *
 * iOS の「文字サイズを大きく」は Web では再現できないので、
 * ページ内の全要素の font-size を倍率ぶん引き上げて近似する。
 * 枠（固定の height / width）はそのままに文字だけ大きくなるので、
 * 実機で起きる崩れ方と同じ形になる。
 *
 * 見るのは2つ。
 *   1. 文字が親の枠から縦にはみ出していないか（＝枠が伸びていない）
 *   2. 文字が画面の外に出ていないか（＝横に溢れている）
 *
 * ※ 近似なので、これが通っても実機での確認は要る。
 *   逆にここで出るものは実機でもほぼ確実に崩れている。
 */

const BASE = process.argv[2];
const SCALE = Number(process.argv[3] || 1.3);
const WIDTHS = [320, 375];

const ROUTES = [
  ['ホーム', '/'],
  ['掲示板', '/board'],
  ['収穫', '/harvest'],
  ['プレミアム', '/premium'],
  ['取引', '/exchange'],
  ['マイページ', '/mypage'],
  ['検索', '/search'],
  ['通知', '/notifications'],
  ['タネを植える', '/plant/seed'],
  ['肥料チャージ', '/fertilizer'],
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

const BLOAT = (scale) => {
  for (const el of document.querySelectorAll('*')) {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs > 0) el.style.setProperty('font-size', `${fs * scale}px`, 'important');
  }
};

const CHECK = (vw) => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('');
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // 1) 画面の外に出た文字
    if (r.right > vw + 1 || r.left < -1) {
      out.push({ kind: '画面外', text: own.slice(0, 26), detail: `${Math.round(r.left)}..${Math.round(r.right)}` });
      continue;
    }
    // 2) 親の枠から縦にはみ出した文字（枠が伸びていない）
    const p = el.parentElement;
    if (!p) continue;
    const ps = getComputedStyle(p);
    if (ps.overflow === 'visible' && ps.overflowY === 'visible') continue;
    const pr = p.getBoundingClientRect();
    if (r.bottom > pr.bottom + 2 || r.top < pr.top - 2) {
      out.push({
        kind: '枠から縦にはみ出し',
        text: own.slice(0, 26),
        detail: `文字${Math.round(r.height)}px / 枠${Math.round(pr.height)}px`,
      });
    }
  }
  const d = document.documentElement;
  return { scrolls: d.scrollWidth > d.clientWidth + 1, items: out.slice(0, 6), total: out.length };
};

let ng = 0;
console.log(`文字サイズ ${SCALE} 倍で検査\n`);
for (const w of WIDTHS) {
  console.log(`===== 幅 ${w}px =====`);
  const ctx = await browser.newContext({
    viewport: { width: w, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('gungun.mock.authed', '1'));

  for (const [name, route] of ROUTES) {
    try {
      await page.goto(BASE.replace(/\/$/, '') + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.evaluate(BLOAT, SCALE);
      await page.waitForTimeout(400);
      const res = await page.evaluate(CHECK, w);
      const bad = res.scrolls || res.total > 0;
      if (bad) ng++;
      console.log(
        `  ${bad ? 'NG' : 'OK'}  ${name.padEnd(12)} 横スクロール:${res.scrolls ? 'あり' : 'なし'}  崩れ:${res.total}`
      );
      for (const i of res.items) console.log(`         [${i.kind}] "${i.text}"  ${i.detail}`);
    } catch (e) {
      console.log(`  --  ${name.padEnd(12)} 開けず`);
    }
  }
  await ctx.close();
  console.log('');
}
await browser.close();
console.log(`問題のあった画面: ${ng} 件`);
