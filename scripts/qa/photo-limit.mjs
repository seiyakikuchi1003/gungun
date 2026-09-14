/**
 * 写真の上限が管理画面の設定に従うか（D-3・M-4）。
 *
 *   node scripts/qa/photo-limit.mjs http://localhost:4720
 *
 * dev の max_images_per_item を変え、出品画面の表示と「＋写真を追加」の
 * 出方が変わるかを見る。終わったら元に戻す。
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { launch, session, outDir } from './lib.mjs';

const BASE = (process.argv[2] || 'http://localhost:4720').replace(/\/$/, '');
const DEV_REF = 'bypjhlfcqzebmukwzthi';
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
if (!env.SUPABASE_DB_URL?.includes(DEV_REF)) { console.error('dev ではありません'); process.exit(1); }

const db = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const KEY = 'max_images_per_item';
const original = (await db.query('select value from app_settings where key=$1', [KEY])).rows[0]?.value;
const write = (v) => db.query('update app_settings set value = to_jsonb($1::int) where key=$2', [v, KEY]);
console.log(`いまの ${KEY}: ${original}`);

const dir = outDir('photo-limit');
const browser = await launch();
let ok = false;
try {
  for (const v of [3, 9]) {
    await write(v);
    const s = await session(browser, { base: BASE, email: 'haru@example.com', password: 'password', label: `n${v}`, dir });
    await s.login();
    await s.page.goto(`${BASE}/plant/seed`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(3000);
    const r = await s.step(`上限${v}のとき`);
    // RN Web は「最大」「3」「枚・…」と別の要素に分かれる。つなげて見る
    const joined = r.text.join('');
    const m = joined.match(/最大(\d+)枚/);
    console.log(`  ${KEY}=${v} → 「最大${m?.[1]}枚」`);
    if (m?.[1] !== String(v)) throw new Error(`上限 ${v} が表示に出ていない（出ているのは ${m?.[1]}）`);
    await s.finish();
  }
  ok = true;
} catch (e) {
  console.log('  ✗', String(e).slice(0, 160));
} finally {
  await write(original);
  console.log(`  ${KEY} を ${original} に戻しました`);
  await db.end();
  await browser.close();
}
console.log(ok ? '\n✓ 上限が設定に従いました' : '\n✗ 従っていません');
process.exit(ok ? 0 : 1);
