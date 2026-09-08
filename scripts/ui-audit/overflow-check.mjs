import { chromium } from 'playwright-core';

/**
 * 画面幅ごとの崩れ検査（2026-08-21 指摘：どの端末幅でも崩れないか）。
 *
 * 各画面を狭い端末幅から順に開き、
 *   1. 横スクロールが出ていないか
 *   2. 画面の外にはみ出している「文字」が無いか
 * を見る。
 *
 * 装飾（葉のSVGなど）は overflow:hidden の内側でわざと外に出しているので、
 * 切られている要素は数えない。文字だけを対象にすることで、
 * 「読めなくなっている」ものに絞る。
 *
 * ※ これは明らかな崩れを拾うためのふるい。
 *   端末の文字サイズ（Dynamic Type）は Web では再現できないので、
 *   最終的な確認は実機で行う必要がある。
 */

const BASE = process.argv[2];
const WIDTHS = [320, 375, 430];

// モックのログインを通してから回る画面
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
  ['住所', '/address'],
  ['利用規約', '/mypage/terms'],
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

const CHECK = (vw) => {
  const clipped = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflow === 'hidden' || s.overflowX === 'hidden') return true;
    }
    return false;
  };
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    // 文字を直接持つ要素だけを見る（装飾の図形は対象外）
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('');
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      if (clipped(el)) continue;
      out.push({ text: own.slice(0, 30), l: Math.round(r.left), r: Math.round(r.right) });
    }
  }
  const d = document.documentElement;
  return { scrollW: d.scrollWidth, clientW: d.clientWidth, items: out.slice(0, 5), total: out.length };
};

let ngTotal = 0;
for (const w of WIDTHS) {
  console.log(`\n===== 幅 ${w}px =====`);
  const ctx = await browser.newContext({
    viewport: { width: w, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  // モックの認証フラグを立てて、ログイン画面を飛ばす
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('gungun.mock.authed', '1'));

  for (const [name, route] of ROUTES) {
    try {
      await page.goto(BASE.replace(/\/$/, '') + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const res = await page.evaluate(CHECK, w);
      const scrolls = res.scrollW > res.clientW + 1;
      const ng = scrolls || res.total > 0;
      if (ng) ngTotal++;
      console.log(
        `  ${ng ? 'NG' : 'OK'}  ${name.padEnd(12)} 横スクロール:${scrolls ? 'あり' : 'なし'}  はみ出す文字:${res.total}`
      );
      for (const i of res.items) console.log(`         "${i.text}"  ${i.l}..${i.r}`);
    } catch (e) {
      console.log(`  --  ${name.padEnd(12)} 開けず (${String(e.message).slice(0, 50)})`);
    }
  }
  await ctx.close();
}

await browser.close();
console.log(`\n問題のあった画面: ${ngTotal} 件`);
