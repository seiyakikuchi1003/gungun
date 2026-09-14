/**
 * 実データで、画面幅ごとの横溢れを見る（R-2）。
 *
 *   node scripts/qa/layout.mjs http://localhost:4680
 *
 * scripts/ui-audit/overflow-check.mjs と検出の考え方は同じだが、あちらは
 * モック版が前提（localStorage でログインを偽装する）なのに対し、こちらは
 * 実際にログインして本物のデータで見る。長い商品名やニックネームは
 * 実データにしか無いので、崩れが出るならこちら。
 *
 * 装飾は overflow:hidden の内側でわざと外に出しているため、
 * 切られている要素は数えない。文字だけを対象にする。
 */
import { launch, session, outDir } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:4680').replace(/\/$/, '');
const WIDTHS = [320, 375, 430];
const ROUTES = [
  ['ホーム', '/'],
  ['検索', '/search'],
  ['収穫', '/harvest'],
  ['取引', '/exchange'],
  ['掲示板', '/board'],
  ['通知', '/notifications'],
  ['マイページ', '/mypage'],
  ['プレミアム', '/premium'],
  ['肥料', '/fertilizer'],
  ['出品履歴', '/mypage/items'],
  ['お届け先', '/address'],
  ['タネを植える', '/plant/seed'],
];

/** 画面の外に出ている「文字」を拾う。ページ内で評価する */
const FIND = (vw) => {
  const clipped = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflow === 'hidden' || s.overflowX === 'hidden') return true;
    }
    return false;
  };
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      if (clipped(el)) continue;
      out.push({ text: own.slice(0, 30), left: Math.round(r.left), right: Math.round(r.right) });
    }
  }
  const d = document.documentElement;
  return { scrollW: d.scrollWidth, clientW: d.clientWidth, items: out.slice(0, 6), total: out.length };
};

const dir = outDir('layout');
console.log(`記録先: ${dir}\n`);
const browser = await launch();
const found = [];

for (const w of WIDTHS) {
  console.log(`===== 幅 ${w}px =====`);
  const s = await session(browser, {
    base: BASE, email: 'haru@example.com', password: 'password', label: `w${w}`, dir,
  });
  await s.page.setViewportSize({ width: w, height: 844 });
  await s.login();

  for (const [name, route] of ROUTES) {
    await s.page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1800);
    const r = await s.page.evaluate(FIND, w);
    const scrolls = r.scrollW > r.clientW + 1;
    const bad = scrolls || r.total > 0;
    if (bad) {
      found.push({ width: w, name, route, ...r });
      await s.page.screenshot({ path: path.join(dir, `${w}-${name}.png`), fullPage: true });
      console.log(`  ✗ ${name}${scrolls ? `  横スクロール ${r.scrollW}>${r.clientW}` : ''}${r.total ? `  はみ出し ${r.total}件: ${r.items.map((i) => i.text).join(' / ')}` : ''}`);
    } else {
      console.log(`  ✓ ${name}`);
    }
  }
  await s.finish();
}

writeFileSync(path.join(dir, 'layout.json'), JSON.stringify(found, null, 2));
await browser.close();
console.log(`\n完了。崩れ ${found.length} 件。`);
console.log(dir);
