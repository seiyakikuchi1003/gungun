/**
 * 自動テスト用に dev のデータを整える。
 *
 *   node scripts/qa/reset-dev.mjs          # 状態を見るだけ
 *   node scripts/qa/reset-dev.mjs --apply  # 肥料の補充と QA データの掃除をする
 *
 * flow.mjs を繰り返すとデモユーザーの肥料が尽き（1回200）、水やりできなくなる。
 * また QA で作った出品が溜まって取引一覧が読みにくくなる。その2つを戻すだけ。
 *
 * ★ dev 以外には絶対に向けない。接続先を確かめてから実行する。
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const DEV_REF = 'bypjhlfcqzebmukwzthi';
const DEMO_IDS = "id::text like '00000000-0000-0000-0000-0000000000a_'";

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const url = env.SUPABASE_DB_URL;
if (!url) {
  console.error('.env.local に SUPABASE_DB_URL がありません');
  process.exit(1);
}
if (!url.includes(DEV_REF)) {
  console.error(`接続先が dev（${DEV_REF}）ではありません。中止します。`);
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
console.log(`接続先: ${DEV_REF}（dev）\n`);

const show = async () => {
  const { rows: users } = await db.query(
    `select nickname, fertilizer from profiles where ${DEMO_IDS} order by nickname`
  );
  console.table(users);
  const { rows: qa } = await db.query("select count(*)::int as n from items where name like 'QA%'");
  console.log(`QA で作った出品: ${qa[0].n} 件`);
};

await show();

if (!apply) {
  console.log('\n--apply を付けると、肥料を 20000 に補充し、QA の出品を消します。');
} else {
  await db.query(`update profiles set fertilizer = 20000 where ${DEMO_IDS}`);
  await db.query("delete from items where name like 'QA%'");
  console.log('\n補充と掃除をしました。\n');
  await show();
}

await db.end();
