/**
 * 2アカウントで交換の輪をひと回りする。
 *
 *   node scripts/qa/flow.mjs http://localhost:54799
 *
 * A（haru）がタネを植え、B（metan）が水やりし、A が収穫して、
 * 双方が発送・受け取り・評価まで進む。実データ（dev）でしか意味がない。
 *
 * 途中で止まっても、そこまでの記録は残す。どこで止まったかが成果物。
 */
import { launch, session, outDir } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:54799').replace(/\/$/, '');
const PHOTO = path.resolve('assets/mikan.png');
const STAMP = new Date().toISOString().slice(11, 16).replace(':', '');
const SEED_NAME = `QAタネ ${STAMP}`;
const WATER_NAME = `QA水やり ${STAMP}`;

const dir = outDir('flow');
console.log(`記録先: ${dir}\n出品名: ${SEED_NAME} / ${WATER_NAME}\n`);

const browser = await launch();
const log = [];
const phase = async (name, fn) => {
  try {
    await fn();
    log.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    log.push({ name, ok: false, error: String(e).slice(0, 300) });
    console.log(`  ✗ ${name}\n     ${String(e).slice(0, 200)}`);
    throw Object.assign(new Error(name), { stopped: true });
  }
};

/** 写真を1枚入れる（Web ではカメラもライブラリも file input に落ちる） */
async function addPhoto(s) {
  await s.tap('＋写真を追加').catch(async () => { await s.tap('写真を追加'); });
  await s.page.waitForTimeout(600);
  const chooser = s.page.waitForEvent('filechooser', { timeout: 10000 });
  await s.tap('ライブラリから選択');
  const fc = await chooser;
  await fc.setFiles(PHOTO);
  await s.page.waitForTimeout(2500);
}

/**
 * SelectRow を開いて、出てきた選択肢の1つ目を選ぶ。
 *
 * ピッカーの選択肢だけを見分ける確かな手がかりが DOM に無いので、
 * 「開く前には無くて、開いた後にある行」を選択肢とみなす。
 */
async function pickFirst(s, rowLabel) {
  // innerText は display:none の中身まで拾ってしまい、開いていないピッカーの
  // 選択肢まで「見えている」ことになる。表示中の文字だけを見る。
  const lines = () => s.visibleText();
  // 直前のシートが閉じ切る前に押すと開かないことがあるので、間を置いて一度やり直す
  const before = new Set(await lines());
  let after = [];
  let target;
  // 出品画面は行そのものが押せるが、水やり画面は見出しの下の箱を押す作りになっている。
  // 同じ入力なのに画面ごとに部品が違うので、両方を試す。
  for (let i = 0; i < 2 && !target; i += 1) {
    if (i) await s.page.waitForTimeout(1500);
    await s.tap(i === 0 ? rowLabel : '選択してください');
    await s.page.waitForTimeout(1200);
    after = await lines();
    target = after.find((t) => !before.has(t) && t.length > 1 && t.length < 30 && !['キャンセル','閉じる','選択してください',rowLabel].includes(t));
  }
  if (!target) throw new Error(`${rowLabel} の選択肢が出てこない（開いた後の行: ${after.slice(-8).join(' / ')}）`);
  await s.step(`${rowLabel}のピッカー`, `選ぼうとしている: ${target}`);
  await s.tap(target);
  await s.page.waitForTimeout(900);

  // 本当に入ったかを確かめる。入っていなければここで止める
  const now = await lines();
  if (!now.includes(target)) throw new Error(`${rowLabel} に「${target}」が入らなかった`);
  return target;
}

/** プレミアム案内が出ていたら閉じる */
async function dismissNudge(s) {
  try {
    await s.page.locator('text="閉じる"').first().click({ timeout: 2500 });
    await s.page.waitForTimeout(600);
  } catch { /* 出ていなければ何もしない */ }
}

const A = await session(browser, { base: BASE, email: 'haru@example.com', password: 'password', label: 'A-haru', dir });
const B = await session(browser, { base: BASE, email: 'metan@example.com', password: 'password', label: 'B-metan', dir });

try {
  await phase('A ログイン', async () => { await A.login(); await A.step('Aホーム'); });
  await phase('B ログイン', async () => { await B.login(); await B.step('Bホーム'); });

  // ── A：タネを植える ──────────────────────────────
  await phase('A タネを植える', async () => {
    await A.page.goto(`${BASE}/plant/seed`, { waitUntil: 'domcontentloaded' });
    await A.page.waitForTimeout(2200);
    await A.step('出品画面を開いた直後', 'プレミアム案内が出るか');
    await dismissNudge(A);
    await addPhoto(A);
    await A.step('写真を追加した');
    await A.page.getByPlaceholder('商品名を入力してください').fill(SEED_NAME);
    await A.page.getByPlaceholder('状態や使用期間などを書きましょう').fill('自動テストで作った出品です。');
    const cat = await pickFirst(A, 'カテゴリー');
    const con = await pickFirst(A, '商品の状態');
    await A.step('入力を終えた', `カテゴリー=${cat} / 状態=${con}`);
    await A.tap('タネを植える', { last: true });
    await A.page.waitForTimeout(4000);
    await A.step('出品した直後');
  });

  // ── B：A のタネに水やり ──────────────────────────
  await phase('B タネを探す', async () => {
    await B.page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
    await B.page.waitForTimeout(1800);
    const box = B.page.locator('input').first();
    await box.fill(SEED_NAME);
    await box.press('Enter');
    await B.page.waitForTimeout(2500);
    await B.step('検索した', SEED_NAME);
    await B.tap(SEED_NAME);
    await B.page.waitForTimeout(2500);
    await B.step('商品詳細');
  });

  await phase('B 水やりする', async () => {
    await B.tap('この商品に水やりする');
    await B.page.waitForTimeout(2500);
    await B.step('水やり画面を開いた直後');
    await dismissNudge(B);
    await B.step('プレミアム案内を閉じた後');
    await addPhoto(B);
    await B.step('水やりの写真を追加した');
    await B.page.getByPlaceholder('入力してください（20文字以内）').fill(WATER_NAME);
    await B.page.getByPlaceholder('商品の説明を入力してください（200文字以内）').fill('自動テストの水やりです。');
    await pickFirst(B, 'カテゴリー');
    await pickFirst(B, '商品の状態');
    await B.step('水やりの入力を終えた');
    await B.tap('水やりする', { last: true });
    await B.page.waitForTimeout(4000);
    await B.step('水やりした直後');
  });

  // ── A：通知と収穫 ────────────────────────────────
  await phase('A 通知を見る', async () => {
    await A.page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await A.page.waitForTimeout(2500);
    await A.step('通知一覧', '水やりの通知が名前つきで届くか');
  });

  await phase('A 収穫する', async () => {
    await A.page.goto(`${BASE}/harvest`, { waitUntil: 'domcontentloaded' });
    await A.page.waitForTimeout(2200);
    await A.step('収穫タブ');
    await A.tap(SEED_NAME);
    await A.page.waitForTimeout(2500);
    await A.step('タネの詳細（集まった商品）');
    // 商品名を押すと詳細へ飛んでしまう。収穫ボタンは行の中にある
    await A.tap('収穫する');
    await A.page.waitForTimeout(2000);
    await A.step('収穫を押した直後', '確認が挟まるか');
    // 確認シートの実行ボタン。文言が変わっても拾えるよう前方一致で探す
    const go = A.page.locator('text=/^収穫する（/ >> visible=true').first();
    await go.waitFor({ state: 'visible', timeout: 8000 });
    await go.click();
    await A.page.waitForTimeout(5000);
    const res = await A.step('収穫した直後');

    // 例外が出なくても成立していないことがある。画面で結果を確かめる
    const stillOffering = res.text.includes('収穫する');
    if (stillOffering) throw new Error('収穫を押したのに、まだ収穫できる状態のまま（成立していない）');
  });

  // ── 取引 ────────────────────────────────────────
  await phase('A 取引を見る', async () => {
    await A.page.goto(`${BASE}/exchange`, { waitUntil: 'domcontentloaded' });
    await A.page.waitForTimeout(2500);
    await A.step('取引一覧');
  });
  await phase('B 取引を見る', async () => {
    await B.page.goto(`${BASE}/exchange`, { waitUntil: 'domcontentloaded' });
    await B.page.waitForTimeout(2500);
    await B.step('取引一覧');
  });

  // ── 発送 → 受け取り → 評価 ──────────────────────
  // 過去の実行ぶんの取引が一覧に残っているので、今回の商品名で必ず絞る
  const ship = async (s, who, itemName) => {
    await s.page.goto(`${BASE}/exchange`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(2200);
    await s.tap('送る');
    await s.page.waitForTimeout(1500);
    await s.step(`${who} 送るタブ`);
    await s.tap(itemName);
    await s.page.waitForTimeout(2500);
    const d = await s.step(`${who} 取引詳細`);
    if (!d.text.includes(itemName)) throw new Error(`${who}: ${itemName} の取引詳細が開けていない`);
    await s.tap('発送完了を報告する');
    await s.page.waitForTimeout(2000);
    await s.step(`${who} 発送を押した`, '発送前チェックが6項目');
    // 6項目すべてにチェックを入れないと報告ボタンが押せない
    for (const q of [
      'しっかり梱包しましたか？',
      '出品時の状態と変わっていませんか？',
      '送料は発払いになっていますか？',
      '食品の場合、以下の条件を満たしていますか？',
      '宛先の記載ミスはありませんか？',
      '発送通知を忘れずに！',
    ]) {
      await s.tap(q).catch(() => { throw new Error(`発送前チェック「${q}」を押せない`); });
    }
    await s.step(`${who} チェックを全部入れた`);
    // 追跡番号の欄はチェックリストの下にある。テストでは「その他・追跡なし」を選ぶ
    await s.tap('その他・追跡なし');
    await s.step(`${who} 配送方法を選んだ`);
    await s.tap('発送完了を報告');
    await s.page.waitForTimeout(2500);
    const after = await s.step(`${who} 発送の報告後`);
    if (after.text.includes('発送完了を報告する')) throw new Error(`${who}: 発送の報告が終わっていない`);
  };

  await phase('A 発送する', () => ship(A, 'A', SEED_NAME));
  await phase('B 発送する', () => ship(B, 'B', WATER_NAME));

  /** 星は文字を持たないので、5つ並んだ入れ物の5番目を座標で押す */
  const tapFifthStar = async (s) => {
    // 星はアイコンフォントの文字。同じ大きさの入れ物が横に5つ並ぶ行を探す
    const box = await s.page.evaluate(() => {
      for (const el of document.querySelectorAll('div')) {
        const kids = [...el.children];
        if (kids.length !== 5) continue;
        const rs = kids.map((k) => k.getBoundingClientRect());
        if (!rs.every((r) => r.width >= 20 && r.width <= 80 && r.height >= 20)) continue;
        if (Math.abs(rs[0].y - rs[4].y) > 6) continue;
        if (rs[4].x <= rs[0].x) continue;
        const r = rs[4];
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    });
    if (!box) throw new Error('星が見つからない');
    await s.page.mouse.click(box.x, box.y);
    await s.page.waitForTimeout(600);
  };

  const receiveAndRate = async (s, who, itemName) => {
    await s.page.goto(`${BASE}/exchange`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(2200);
    await s.tap('受け取る');
    await s.page.waitForTimeout(1500);
    await s.tap(itemName);
    await s.page.waitForTimeout(2500);
    await s.step(`${who} 受け取る取引の詳細`);
    await s.tapRe(/受け取り(完了)?を報告/, { last: true });
    await s.page.waitForTimeout(1500);
    await s.step(`${who} 受け取りの確認`);
    await s.tap('受け取りを報告');
    await s.page.waitForTimeout(3500);
    const after = await s.step(`${who} 受け取り報告のあと`, '評価に進むか');

    // 評価へ
    if (!s.page.url().includes('/rating')) await s.tapRe(/評価/, { last: true }).catch(() => {});
    await s.page.waitForTimeout(2500);
    await s.step(`${who} 評価画面`);
    await tapFifthStar(s);
    await s.tap('評価を送信する');
    await s.page.waitForTimeout(3500);
    await s.step(`${who} 評価を送った`);
  };

  // 相手が送った商品を受け取る：A は QA水やり、B は QAタネ
  await phase('A 受け取って評価', () => receiveAndRate(A, 'A', WATER_NAME));
  await phase('B 受け取って評価', () => receiveAndRate(B, 'B', SEED_NAME));
} catch (e) {
  if (!e.stopped) console.log('想定外の停止:', String(e).slice(0, 300));
}

await A.finish();
await B.finish();
writeFileSync(path.join(dir, 'flow.json'), JSON.stringify(log, null, 2));
await browser.close();
const ng = log.filter((l) => !l.ok);
console.log(`\n完了。${log.length} 段階のうち ${ng.length} 件で止まりました。`);
console.log(dir);
