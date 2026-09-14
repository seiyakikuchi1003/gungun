/**
 * 交換の輪に入らない機能を一通り触る。
 *
 *   node scripts/qa/features.mjs http://localhost:4670
 *
 * flow.mjs が「出品→水やり→収穫→発送→受取→評価」の一本道を通すのに対し、
 * こちらは編集・削除、通報・ブロック、掲示板、肥料、マイページを見る。
 *
 * どの段階も、押せたことではなく「画面に何が出たか」で合否を決める。
 */
import { launch, session, outDir } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:4670').replace(/\/$/, '');
const PHOTO = path.resolve('assets/mikan.png');
const STAMP = new Date().toISOString().slice(11, 16).replace(':', '');
const SEED_NAME = `QA編集 ${STAMP}`;
const POST_TEXT = `QA投稿 ${STAMP} 自動テストの書き込みです`;

const dir = outDir('features');
console.log(`記録先: ${dir}\n`);

const browser = await launch();
const log = [];
const phase = async (name, fn) => {
  try {
    await fn();
    log.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    log.push({ name, ok: false, error: String(e).slice(0, 300) });
    console.log(`  ✗ ${name}\n     ${String(e).slice(0, 220)}`);
  }
};

let reportedUrl = null;
const A = await session(browser, { base: BASE, email: 'haru@example.com', password: 'password', label: 'A', dir });

/** ヘッダー右上の「…」。アイコンだけで文字が無いので位置で押す */
const tapMenu = async (s) => {
  await s.page.mouse.click(358, 26);
  await s.page.waitForTimeout(900);
};

async function addPhoto(s) {
  await s.tap('＋写真を追加').catch(async () => { await s.tap('写真を追加'); });
  await s.page.waitForTimeout(600);
  const chooser = s.page.waitForEvent('filechooser', { timeout: 10000 });
  await s.tap('ライブラリから選択');
  (await chooser).setFiles(PHOTO);
  await s.page.waitForTimeout(2500);
}

async function pickFirst(s, rowLabel) {
  const lines = () => s.visibleText();
  const before = new Set(await lines());
  let after = [];
  let target;
  for (let i = 0; i < 2 && !target; i += 1) {
    if (i) await s.page.waitForTimeout(1500);
    await s.tap(i === 0 ? rowLabel : '選択してください');
    await s.page.waitForTimeout(1200);
    after = await lines();
    target = after.find((t) => !before.has(t) && t.length > 1 && t.length < 30
      && !['キャンセル', '閉じる', '選択してください', rowLabel].includes(t));
  }
  if (!target) throw new Error(`${rowLabel} の選択肢が出てこない`);
  await s.tap(target);
  await s.page.waitForTimeout(900);
}

await A.login();

// ── F：出品の編集・削除 ────────────────────────────────
await phase('F 出品して編集する', async () => {
  await A.page.goto(`${BASE}/plant/seed`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2200);
  await addPhoto(A);
  await A.page.getByPlaceholder('商品名を入力してください').fill(SEED_NAME);
  await A.page.getByPlaceholder('状態や使用期間などを書きましょう').fill('編集のテストです。');
  await pickFirst(A, 'カテゴリー');
  await pickFirst(A, '商品の状態');
  await A.tap('タネを植える', { last: true });
  await A.page.waitForTimeout(4000);
  await A.tap('ホームに戻る').catch(() => {});
  await A.page.waitForTimeout(2000);

  // 自分の出品を開く
  await A.page.goto(`${BASE}/mypage/items`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2500);
  await A.step('出品履歴', 'O-3');
  await A.tap(SEED_NAME);
  await A.page.waitForTimeout(2500);
  await A.step('自分の出品の詳細');

  await tapMenu(A);
  const menu = await A.step('…メニュー', 'F-1・F-3・P-1');
  if (!menu.text.includes('出品を編集する')) throw new Error('編集のメニューが出ない');

  await A.tap('出品を編集する');
  await A.page.waitForTimeout(2500);
  await A.step('編集画面', 'F-1：水やり前は編集できる');
});

await phase('F 出品を削除する', async () => {
  await A.page.goto(`${BASE}/mypage/items`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2200);
  await A.tap(SEED_NAME);
  await A.page.waitForTimeout(2500);
  await tapMenu(A);
  await A.tap('出品を削除する');
  await A.page.waitForTimeout(1200);
  await A.step('削除の確認', '取り消せない旨が出るか');
  await A.tap('削除する');
  await A.page.waitForTimeout(3000);
  const after = await A.step('削除した後');
  if (after.text.includes(SEED_NAME)) throw new Error('削除したのにまだ出ている');
});

// ── P：通報・ブロック ──────────────────────────────────
await phase('P 他人の出品を通報する', async () => {
  await A.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2500);
  // 自分の出品だとメニューが編集・削除になる。通報が出るものに当たるまで試す
  const CANDIDATES = ['Nintendo Switch', 'AirPods Pro（第2世代）', '香水（未開封）',
    'ワイヤレススピーカー', 'スニーカー', 'サーモン', 'ねこ'];
  let m = null;
  for (const name of CANDIDATES) {
    await A.page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
    await A.page.waitForTimeout(1800);
    const box = A.page.locator('input').first();
    await box.fill(name);
    await box.press('Enter');
    await A.page.waitForTimeout(2200);
    try { await A.tap(name); } catch { continue; }
    await A.page.waitForTimeout(2200);
    if (!A.page.url().includes('/item/')) continue;
    await tapMenu(A);
    const seen = await A.step(`…メニュー（${name}）`);
    if (seen.text.some((t) => t.includes('通報'))) { m = seen; break; }
    await A.tap('キャンセル').catch(() => {});
    await A.page.waitForTimeout(600);
  }
  if (!m) throw new Error('通報できる（他人の）出品が見つからない');
  reportedUrl = A.page.url();
  await A.tap('この出品を通報する');
  await A.page.waitForTimeout(1500);
  await A.step('通報シート');
  await A.tap('スパム・宣伝');
  await A.page.waitForTimeout(600);
  await A.tap('通報する');
  await A.page.waitForTimeout(2500);
  const done = await A.step('通報の送信後', '受付が伝わるか');
  // 2回目以降は「すでに通報しています」が正しい（運営の一覧を埋めないための制限）
  const okText = done.text.some((t) => t.includes('受け付けました') || t.includes('すでに通報'));
  if (!okText) throw new Error(`受付の表示が出ない: ${done.text.slice(-3).join(' / ')}`);
  await A.tap('閉じる').catch(() => {});
  await A.page.waitForTimeout(1200);
});

await phase('P ブロックして一覧から消す', async () => {
  // 前の段階の画面に乗らず、対象をはっきりさせてから開く
  if (reportedUrl) {
    await A.page.goto(reportedUrl, { waitUntil: 'domcontentloaded' });
    await A.page.waitForTimeout(2500);
  }
  await tapMenu(A);
  const m = await A.step('…メニュー（ブロック前）');
  const blockRow = m.text.find((t) => t.includes('さんをブロックする'));
  if (!blockRow) throw new Error('ブロックのメニューが出ない');
  await A.tap(blockRow);
  await A.page.waitForTimeout(1200);
  await A.step('ブロックの確認');
  await A.tap('ブロックする');
  await A.page.waitForTimeout(3000);
  await A.step('ブロックした後');

  await A.page.goto(`${BASE}/mypage/blocks`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2500);
  const list = await A.step('ブロック一覧', 'O-6');
  if (!list.text.some((t) => t.includes('さん'))) throw new Error('ブロックしたのに一覧に出ない');

  // P-3：ブロックした相手の出品が一覧から消えるか
  await A.page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(1800);
  const box = A.page.locator('input').first();
  await box.fill('Nintendo Switch');
  await box.press('Enter');
  await A.page.waitForTimeout(2500);
  const found = await A.step('ブロック後に検索', 'P-3：相手の出品が消えるか');
  if (found.text.includes('Nintendo Switch')) {
    throw new Error('ブロックしたのに相手の出品が検索に出てくる');
  }

  // 次の実行のために戻しておく（解除も O-6 の確認になる）
  await A.page.goto(`${BASE}/mypage/blocks`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2200);
  await A.tap('解除');
  await A.page.waitForTimeout(2200);
  await A.step('ブロックを解除した', 'O-6');
});

// ── M：ログインボーナス・肥料 ──────────────────────────
await phase('M ログインボーナス', async () => {
  await A.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2500);
  const before = await A.step('ホーム（受け取る前）');
  if (before.text.includes('受け取る')) {
    await A.tap('受け取る');
    await A.page.waitForTimeout(2500);
    await A.step('ボーナスを受け取った', 'M-1・M-2');
  } else {
    await A.step('ボーナスは受け取り済み', '2回目は押せない＝M-1');
  }
});

await phase('M 肥料の画面', async () => {
  await A.page.goto(`${BASE}/fertilizer`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2500);
  const r = await A.step('肥料', 'M-3・N-1');
  if (!r.text.some((t) => /肥料/.test(t))) throw new Error('肥料の画面に見えない');
});

// ── K：掲示板 ─────────────────────────────────────────
await phase('K 掲示板に投稿する', async () => {
  await A.page.goto(`${BASE}/board`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2500);
  await A.tap('質問');
  await A.page.waitForTimeout(1200);
  await A.step('掲示板（質問で絞り込み）', 'K-4');
  await A.page.goto(`${BASE}/board/new?tag=question`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2200);
  const box = A.page.locator('textarea, input[type="text"]').first();
  await box.fill(POST_TEXT);
  await A.page.waitForTimeout(500);
  await A.step('投稿を書いた');
  await A.tap('投稿');
  await A.page.waitForTimeout(3500);
  const after = await A.step('投稿した後', 'K-1');
  if (!after.text.some((t) => t.includes(POST_TEXT.slice(0, 10)))) {
    throw new Error('投稿が一覧に出てこない');
  }
});

await phase('K 投稿履歴', async () => {
  await A.page.goto(`${BASE}/mypage/posts`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(2500);
  const r = await A.step('投稿履歴', 'K-5・O-4');
  if (!r.text.some((t) => t.includes(POST_TEXT.slice(0, 10)))) {
    throw new Error('投稿履歴に今の投稿が出てこない');
  }
});

// ── O：マイページの各画面 ──────────────────────────────
for (const [name, route, note] of [
  ['プロフィール編集', '/mypage/edit', 'O-1'],
  ['いいね一覧', '/mypage/likes', 'O-5'],
  ['利用規約', '/mypage/terms', 'O-7'],
  ['プライバシー', '/mypage/privacy', 'O-7'],
]) {
  await phase(`O ${name}`, async () => {
    await A.page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await A.page.waitForTimeout(2200);
    const r = await A.step(name, note);
    if (r.text.length < 3) throw new Error('中身が出ていない');
  });
}

await A.finish();
writeFileSync(path.join(dir, 'features.json'), JSON.stringify(log, null, 2));
await browser.close();
const ng = log.filter((l) => !l.ok);
console.log(`\n完了。${log.length} 段階のうち ${ng.length} 件で止まりました。`);
if (ng.length) console.log(ng.map((n) => `  ✗ ${n.name}`).join('\n'));
console.log(dir);
