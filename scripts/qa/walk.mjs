/**
 * 全画面を一周して、スクリーンショットと画面の文字を残す。
 *
 *   CHROME_PATH=... node scripts/qa/walk.mjs http://localhost:4600
 *
 * 合否の判定はここではしない。「何が出ているか」を漏れなく残すのが役目で、
 * 戸惑う箇所の洗い出しは、出てきた記録を人（と Claude）が見て行う。
 */
import { launch, session, outDir } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:4600').replace(/\/$/, '');
const EMAIL = process.argv[3] || 'haru@example.com';
const PASSWORD = process.argv[4] || 'password';

/** 画面の一覧。[記録名, パス, 覚え書き] */
const ROUTES = [
  ['ホーム', '/', '入ってすぐ見える画面'],
  ['検索', '/search', ''],
  ['収穫', '/harvest', 'あなたの畑'],
  ['取引', '/exchange', '受け取る／送る'],
  ['掲示板', '/board', ''],
  ['掲示板_新規投稿', '/board/new', 'カテゴリの初期値に注意'],
  ['通知', '/notifications', ''],
  ['マイページ', '/mypage', ''],
  ['プロフィール編集', '/mypage/edit', ''],
  ['お届け先', '/address', '郵便番号からの自動入力'],
  ['出品履歴', '/mypage/items', ''],
  ['投稿履歴', '/mypage/posts', ''],
  ['いいね一覧', '/mypage/likes', ''],
  ['ブロック一覧', '/mypage/blocks', ''],
  ['アカウント', '/mypage/account', '退会の導線'],
  ['利用規約', '/mypage/terms', ''],
  ['プライバシー', '/mypage/privacy', ''],
  ['タネを植える', '/plant/seed', '出品フォーム'],
  ['肥料', '/fertilizer', 'チャージ'],
  ['プレミアム', '/premium', ''],
  ['水やりとは', '/water/about', '説明ページ'],
];

const browser = await launch();
const dir = outDir('walk');
console.log(`記録先: ${dir}`);

const s = await session(browser, { base: BASE, email: EMAIL, password: PASSWORD, label: 'A', dir });

const notes = [];
const guard = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    notes.push({ name, error: String(e).slice(0, 200) });
    console.log(`  ✗ ${name}: ${String(e).slice(0, 120)}`);
  }
};

await guard('ログイン画面', async () => {
  await s.page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await s.page.waitForTimeout(2500);
  await s.step('ログイン画面', '初見の第一画面');
});

await guard('ログイン', () => s.login());

for (const [name, route, note] of ROUTES) {
  await guard(name, async () => {
    await s.page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1600);
    await s.step(name, note);
  });
}

// ── ホームの並び替え（4つとも基準が書いてあるか）────────────
for (const sort of ['おすすめ', '新着順', '水やりが多い順', '人気順']) {
  await guard(`並び替え_${sort}`, async () => {
    await s.page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1500);
    await s.tap(sort);
    await s.step(`並び替え_${sort}`, '選んだ基準が画面に書いてあるか');
  });
}

// ── 商品詳細から木・水やりへ ────────────────────────────
await guard('商品詳細', async () => {
  await s.page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await s.page.waitForTimeout(1800);
  const card = s.page.locator('[role="button"], [tabindex]').nth(8);
  await card.click();
  await s.page.waitForTimeout(1800);
  await s.step('商品詳細', 'ホームのカードから');
});

await s.finish();
writeFileSync(path.join(dir, 'notes.json'), JSON.stringify(notes, null, 2));
await browser.close();
console.log(`\n完了。${s.steps.length} 手順を記録しました。失敗 ${notes.length} 件。`);
console.log(dir);
