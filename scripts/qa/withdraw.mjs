/**
 * 退会（Q-1・Q-2）。
 *
 *   node scripts/qa/withdraw.mjs http://localhost:4700
 *
 * ★ 実際にアカウントを消す。使い捨てのデモユーザー（kenta）で行う。
 *   終わったら `npm run db:apply:seed` でデモデータを入れ直すこと。
 *
 * Q-2（退会しても相手の取引・評価の記録は残る）は、退会の前後で
 * 掲示板の投稿がどう見えるかで確かめる。相手側から完全に消えてしまうと、
 * 取引相手が過去のやり取りを追えなくなる。
 */
import { launch, session, outDir } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:4700').replace(/\/$/, '');
const dir = outDir('withdraw');
console.log(`記録先: ${dir}\n★ kenta のアカウントを実際に消します。\n`);

const browser = await launch();
const log = [];
const phase = async (name, fn) => {
  try { await fn(); log.push({ name, ok: true }); console.log(`  ✓ ${name}`); }
  catch (e) { log.push({ name, ok: false, error: String(e).slice(0, 300) }); console.log(`  ✗ ${name}\n     ${String(e).slice(0, 220)}`); }
};

const K = await session(browser, { base: BASE, email: 'kenta@example.com', password: 'password', label: 'K', dir });

await phase('退会する（Q-1）', async () => {
  await K.login();
  await K.page.goto(`${BASE}/mypage`, { waitUntil: 'domcontentloaded' });
  await K.page.waitForTimeout(2500);
  await K.tap('退会');
  await K.page.waitForTimeout(1500);
  const r1 = await K.step('退会：理由を聞かれる');
  if (!r1.text.some((t) => t.includes('退会の前に教えてください'))) throw new Error('理由の画面が出ない');

  await K.tap('使い方が分かりにくかった');
  await K.page.waitForTimeout(500);
  await K.tap('次へ');
  await K.page.waitForTimeout(1500);
  const r2 = await K.step('退会：最終確認', '消えるものの説明が出るか');
  if (!r2.text.some((t) => t.includes('元に戻せません'))) throw new Error('消えるものの説明が出ない');

  await K.tap('退会する');
  await K.page.waitForTimeout(5000);
  const r3 = await K.step('退会した後');
  // ログイン画面に戻っているはず
  const backToLogin = r3.text.some((t) => t.includes('ログイン')) || K.page.url().includes('login');
  if (!backToLogin) throw new Error('退会後にログイン画面へ戻らない');
});

await phase('退会したアカウントでは入れない', async () => {
  await K.page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await K.page.waitForTimeout(2500);
  await K.page.getByPlaceholder('メールアドレス').fill('kenta@example.com');
  await K.page.getByPlaceholder('パスワード').fill('password');
  await K.tap('ログイン');
  await K.page.waitForTimeout(4000);
  const r = await K.step('退会後にログインを試す');
  if (!r.text.some((t) => t.includes('ログイン'))) throw new Error('退会したのに入れてしまう');
});

await phase('相手からどう見えるか（Q-2）', async () => {
  const A = await session(browser, { base: BASE, email: 'haru@example.com', password: 'password', label: 'A', dir });
  await A.login();
  await A.page.goto(`${BASE}/board`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForTimeout(3000);
  const r = await A.step('退会者がいる状態の掲示板', 'Q-2：記録が壊れていないか');
  if (r.errors.length) throw new Error(`画面がエラーを出している: ${r.errors[0].text}`);
  await A.finish();
});

await K.finish();
writeFileSync(path.join(dir, 'withdraw.json'), JSON.stringify(log, null, 2));
await browser.close();
const ng = log.filter((l) => !l.ok);
console.log(`\n完了。${log.length} 段階のうち ${ng.length} 件で止まりました。`);
console.log('※ デモデータを戻す: npm run db:apply:seed');
console.log(dir);
