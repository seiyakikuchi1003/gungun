/**
 * ホームの「おすすめ」でプレミアム会員の出品が先に出るか（B-2）。
 *
 *   node scripts/qa/recommend.mjs http://localhost:4710
 *
 * dev の profiles.is_premium を一時的に立てて、その人の出品が
 * 先頭に来るかを見る。終わったら必ず元に戻す。
 *
 * 「おすすめ」はプレミアムを先に、その中では水やりが多い順。
 * 水やり数の多い出品が先頭に来るだけでは確かめたことにならないので、
 * **水やり数が 0 の人**をプレミアムにして、それでも先に出るかを見る。
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { launch, session, outDir } from './lib.mjs';

const BASE = (process.argv[2] || 'http://localhost:4710').replace(/\/$/, '');
const DEV_REF = 'bypjhlfcqzebmukwzthi';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
if (!env.SUPABASE_DB_URL?.includes(DEV_REF)) {
  console.error(`接続先が dev（${DEV_REF}）ではありません。中止します。`);
  process.exit(1);
}

const db = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

// 水やりが0で、種を出している人を選ぶ（並びの効果を見分けるため）
// items に水やり数の列は無い。ぶら下がっている子の数がそれにあたる
// ホームのカードには商品名が出ない。写真の並び順で見分けるので画像URLも取る
const { rows } = await db.query(`
  select p.id, p.nickname, i.name as item_name,
         (select url from item_images im where im.item_id = i.id order by im.sort_order limit 1) as image_url
  from items i join profiles p on p.id = i.user_id
  where i.parent_id is null and i.status = 'growing' and p.nickname <> 'はる'
    and not exists (select 1 from items c where c.parent_id = i.id)
    and exists (select 1 from item_images im where im.item_id = i.id)
  order by i.created_at desc
  limit 1
`);
if (!rows.length) { console.error('条件に合う出品が見つかりません'); process.exit(1); }
const target = rows[0];
console.log(`プレミアムにする人: ${target.nickname}（出品「${target.item_name}」水やり 0）\n`);

const dir = outDir('recommend');
const browser = await launch();
let ok = false;

const names = async (s) => {
  // おすすめの並びで、先頭に出ている商品名を拾う
  await s.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await s.page.waitForTimeout(3500);
  await s.tap('おすすめ').catch(() => {});
  await s.page.waitForTimeout(2500);
  // 画面に出ている写真を上から順に。カードの並び＝おすすめの並び
  return s.page.evaluate(() => {
    const out = [];
    for (const img of document.querySelectorAll('img')) {
      const r = img.getBoundingClientRect();
      if (r.width < 40) continue;
      out.push({ src: img.src, y: Math.round(r.top), x: Math.round(r.left) });
    }
    return out.sort((a, b) => a.y - b.y || a.x - b.x).map((x) => x.src);
  });
};

try {
  const s = await session(browser, { base: BASE, email: 'haru@example.com', password: 'password', label: 'R', dir });
  await s.login();

  await db.query('update profiles set is_premium = false where is_premium = true');
  const before = await names(s);
  await s.step('プレミアムにする前');
  const posBefore = before.findIndex((u) => u.includes(target.image_url.split('/').pop()));

  await db.query('update profiles set is_premium = true where id = $1', [target.id]);
  console.log(`  ${target.nickname} をプレミアムにした`);

  const after = await names(s);
  await s.step('プレミアムにした後', 'B-2');
  const posAfter = after.findIndex((u) => u.includes(target.image_url.split('/').pop()));

  console.log(`  「${target.item_name}」の位置: ${posBefore} → ${posAfter}`);
  ok = posAfter >= 0 && (posBefore < 0 || posAfter < posBefore);
  await s.finish();
} finally {
  await db.query('update profiles set is_premium = false');
  console.log('  プレミアムを元に戻しました');
  await db.end();
  await browser.close();
}

console.log(ok ? '\n✓ プレミアム会員の出品が先に出ました（B-2）' : '\n✗ 先に出ていません');
console.log(dir);
process.exit(ok ? 0 : 1);
