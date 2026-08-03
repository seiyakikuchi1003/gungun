#!/usr/bin/env node
/**
 * 「押しても何も起きないボタン」を全画面から洗い出す。
 *
 * 見た目がボタン（角丸＋背景色＋十分な高さ、または明らかな操作ラベル）なのに
 * タップしても URL も画面の中身も変化しないものを検出する。
 *
 * 使い方（dist を http-server で配信しておくこと）:
 *   node scripts/audit-buttons.mjs [baseURL]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const BASE = process.argv[2] ?? 'http://127.0.0.1:8899';

const ROUTES = [
  '/(tabs)', '/(tabs)/board', '/(tabs)/harvest', '/(tabs)/premium', '/(tabs)/mypage',
  '/address', '/board/p1', '/board/new', '/exchange', '/exchange/t1', '/exchange/t1/rating',
  '/fertilizer', '/harvest/speaker', '/item/speaker', '/item/root/speaker',
  '/mypage/account', '/mypage/blocks', '/mypage/edit', '/mypage/items', '/mypage/posts',
  '/mypage/privacy', '/mypage/terms', '/notifications', '/plant/seed', '/search',
  '/tree/speaker', '/water/lv-bag', '/water/about',
];

/** 画面内の「ボタンらしき要素」を列挙する（ブラウザ側で実行） */
const LIST_BUTTONS = () => {
  const out = [];
  const seen = new Set();
  document.querySelectorAll('div,button,a').forEach((el, idx) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) return;
    // 画面内に完全に収まっているものだけ（横スクロール中の要素を誤って押さない）
    if (r.top < 0 || r.bottom > window.innerHeight) return;
    if (r.left < 0 || r.right > window.innerWidth) return;
    // 実際にその座標で最前面にあるか（他の要素に覆われていたら押しても届かない）
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!hit || !(el === hit || el.contains(hit))) return;

    const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
    // 子にもボタンらしき要素があるなら、外側は器なので飛ばす
    const hasBtnChild = [...el.children].some((c) => {
      const ccs = getComputedStyle(c);
      return parseFloat(ccs.borderRadius) >= 12 && ccs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    });
    const br = parseFloat(cs.borderRadius) || 0;
    const filled = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    const looksButton = (br >= 12 && filled && r.height >= 32 && !hasBtnChild) || el.tagName === 'BUTTON';
    if (!looksButton) return;
    if (text.length > 24) return;

    const key = `${text}|${Math.round(r.x)}|${Math.round(r.y)}`;
    if (seen.has(key)) return;
    seen.add(key);
    // 再描画をまたいでも同じ要素を掴めるよう印を付ける
    el.setAttribute('data-audit-id', 'b' + out.length);
    out.push({ id: 'b' + out.length, text: text || '(アイコンのみ)' });
  });
  return out;
};

/**
 * 画面の状態を要約（変化の検出に使う）。
 * モーダル（シート・ピッカー）は React Native Web が #root の外に描くことがあるため、
 * body 全体の文字と要素数を見る。
 */
const SNAPSHOT = () => {
  // 選択チップやラジオは「色だけ変わる」ので、文字と要素数だけでは変化を拾えない。
  // 画面内の背景色・枠線色もまとめて指紋にする。
  let paint = '';
  document.querySelectorAll('#root div,#root svg').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const cs = getComputedStyle(el);
    paint += `${cs.backgroundColor}${cs.borderColor}${cs.opacity};`;
  });
  return [
    location.pathname,
    document.body.innerText.replace(/\s+/g, ' ').slice(0, 1500),
    document.querySelectorAll('*').length,
    paint,
  ].join('||');
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.getByText('ログイン', { exact: false }).first().click();
await page.waitForTimeout(4500);

const go = async (route) => {
  await page.evaluate((r) => {
    history.pushState({}, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForTimeout(1800);
};

// 何を押しても変化しなかったものだけを最後にまとめて出す
const dead = [];

for (const route of ROUTES) {
  await go(route);
  const buttons = await page.evaluate(LIST_BUTTONS);

  for (const btn of buttons) {
    await go(route); // 毎回この画面に戻してから押す
    // 印を付け直す（画面を作り直しているため）
    await page.evaluate(LIST_BUTTONS);
    const target = page.locator(`[data-audit-id="${btn.id}"]`);
    if ((await target.count()) === 0) continue;

    const before = await page.evaluate(SNAPSHOT);
    try {
      await target.first().click({ timeout: 3000 });
    } catch {
      continue; // クリックできない（覆われている等）は別問題なのでここでは扱わない
    }
    await page.waitForTimeout(1200);
    const after = await page.evaluate(SNAPSHOT);
    if (before === after) dead.push({ route, text: btn.text });
  }
}

await browser.close();

if (dead.length === 0) {
  console.log('反応しないボタンは見つかりませんでした');
} else {
  const byRoute = {};
  dead.forEach((d) => { (byRoute[d.route] ??= []).push(d); });
  for (const [route, list] of Object.entries(byRoute)) {
    console.log(`\n■ ${route}`);
    list.forEach((d) => console.log(`   無反応: 「${d.text}」`));
  }
  console.log(`\n合計 ${dead.length} 件`);
}
