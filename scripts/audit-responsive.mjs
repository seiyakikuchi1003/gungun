#!/usr/bin/env node
/**
 * 全画面のレスポンシブ崩れを自動で洗い出す。
 *
 * 崩れの型を2つ検出する：
 *  1. 横はみ出し … 要素の右端が画面幅を超えている（横スクロールが出る）
 *  2. 縦積み     … 幅が極端に狭い箱に日本語が入り、1文字ずつ改行されている
 *
 * 使い方（dist を http-server で配信しておくこと）:
 *   node scripts/audit-responsive.mjs [baseURL] [--shots]
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const BASE = process.argv[2] ?? 'http://127.0.0.1:8899';
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = '/tmp/audit-shots';

// iPhone SE(320) が最小、次いで一般的な iPhone 幅、最後にタブレット寄り
const WIDTHS = [320, 375, 414, 768];

const ROUTES = [
  '/(tabs)',
  '/(tabs)/board',
  '/(tabs)/harvest',
  '/(tabs)/premium',
  '/(tabs)/mypage',
  '/address',
  '/board/p1',
  '/board/new',
  '/exchange',
  '/exchange/t1',
  '/exchange/t1/rating',
  '/fertilizer',
  '/harvest/speaker',
  '/item/speaker',
  '/item/edit/speaker',
  '/item/root/speaker',
  '/mypage/account',
  '/mypage/blocks',
  '/mypage/edit',
  '/mypage/items',
  '/mypage/posts',
  '/mypage/privacy',
  '/mypage/terms',
  '/notifications',
  '/plant/seed',
  '/search',
  '/tree/speaker',
  '/water/lv-bag',
  '/water/about',
];

/** ページ内の崩れを集める。ブラウザ側で実行される */
const COLLECT = () => {
  const vw = window.innerWidth;
  const out = { overflow: [], squeezed: [], scrollWidth: document.documentElement.scrollWidth };

  const label = (el) => {
    const t = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return t || `<${el.tagName.toLowerCase()}>`;
  };

  /**
   * 祖先に「横スクロールできる箱」や「はみ出しを切る箱」があれば、
   * 画面外に出ていても意図した設計なので崩れではない。
   *  - overflow-x: auto/scroll → カルーセル（指で横に送る前提）
   *  - overflow: hidden        → 装飾のはみ出しを切っている
   */
  const isIntentional = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowX)) return true;
      if (cs.overflow === 'hidden' || cs.overflowX === 'hidden') return true;
      p = p.parentElement;
    }
    return false;
  };

  document.querySelectorAll('*').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    // 1) 横はみ出し（2px はスクロールバー等の誤差として許容）
    if (r.right > vw + 2 && !isIntentional(el)) {
      out.overflow.push({ label: label(el), right: Math.round(r.right), width: Math.round(r.width) });
    }

    // 2) 縦積み：文字が入っているのに箱が異常に狭い
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('');
    if (own.length >= 3 && r.width > 0 && r.width < 26 && r.height > 34) {
      out.squeezed.push({ label: own.slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) });
    }
  });

  // 重複を潰す
  const uniq = (arr, key) => {
    const seen = new Set();
    return arr.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
  };
  out.overflow = uniq(out.overflow, (x) => x.label + x.right).slice(0, 6);
  out.squeezed = uniq(out.squeezed, (x) => x.label).slice(0, 6);
  return out;
};

const browser = await chromium.launch();
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

let problems = 0;
const report = [];

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  // モックのログイン（デモの認証情報が最初から入っている）
  try {
    await page.getByText('ログイン', { exact: false }).first().click({ timeout: 5000 });
    await page.waitForTimeout(4000);
  } catch {}

  for (const route of ROUTES) {
    try {
      await page.evaluate((r) => {
        history.pushState({}, '', r);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, route);
      await page.waitForTimeout(1400);

      const res = await page.evaluate(COLLECT);
      const bad = res.overflow.length > 0 || res.squeezed.length > 0 || res.scrollWidth > width + 2;
      if (bad) {
        problems++;
        report.push({ width, route, ...res });
        if (SHOTS) {
          const safe = route.replace(/[^a-z0-9]/gi, '_');
          await page.screenshot({ path: `${SHOT_DIR}/${width}${safe}.png` });
        }
      }
    } catch (e) {
      report.push({ width, route, error: String(e).slice(0, 120) });
    }
  }
  await page.close();
}

await browser.close();

if (report.length === 0) {
  console.log('崩れは検出されませんでした（全ルート × 全幅）');
} else {
  for (const r of report) {
    console.log(`\n■ ${r.width}px  ${r.route}`);
    if (r.error) { console.log(`   ERROR ${r.error}`); continue; }
    if (r.scrollWidth > r.width + 2) console.log(`   横スクロール発生: scrollWidth=${r.scrollWidth}`);
    r.overflow?.forEach((o) => console.log(`   はみ出し right=${o.right} w=${o.width} 「${o.label}」`));
    r.squeezed?.forEach((s) => console.log(`   縦積み w=${s.w} h=${s.h} 「${s.label}」`));
  }
  console.log(`\n合計 ${problems} 件の画面で崩れを検出`);
}
