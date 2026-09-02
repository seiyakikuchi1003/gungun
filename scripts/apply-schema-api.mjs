#!/usr/bin/env node
/**
 * Supabase の Management API 経由でマイグレーションを流す（npm run db:apply:api）。
 *
 *   node scripts/apply-schema-api.mjs <project-ref>            # 未適用のぶんを流す
 *   node scripts/apply-schema-api.mjs <project-ref> --seed     # デモデータも入れる
 *   node scripts/apply-schema-api.mjs <project-ref> --status   # 何が適用済みかだけ見る
 *
 * 通常の db:apply は DB のパスワード（SUPABASE_DB_URL）が要るが、
 * お客様のプロジェクトはパスワードを預からずに構築したい。
 * Management API の SQL 実行を使えば、アクセストークンだけで流せる。
 *
 * 適用済みのファイル名は _gungun_migrations に記録するので、何度実行しても安全。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations');
const SEED = path.join(ROOT, 'supabase', 'seed_demo.sql');

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const skip = (m) => console.log(`  \x1b[90m・${m}\x1b[0m`);
const ng = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);

const ref = process.argv[2];
const wantSeed = process.argv.includes('--seed');
const statusOnly = process.argv.includes('--status');
if (!ref || ref.startsWith('--')) {
  console.error('使い方: node scripts/apply-schema-api.mjs <project-ref> [--seed|--status]');
  process.exit(1);
}

// トークンは .env.local から読む
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv(path.join(ROOT, '.env.local'));
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN が設定されていません（.env.local）');
  process.exit(1);
}

async function run(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 400));
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

console.log(`\n接続先: ${ref}\n`);

await run(`create table if not exists public._gungun_migrations (
  name text primary key, applied_at timestamptz not null default now()
)`);
// 台帳は運用者しか触らない。RLS を入れて anon / authenticated の権限を落としておく
// （付け忘れると Supabase から "Table publicly accessible" の警告が飛ぶ）。
await run(`alter table public._gungun_migrations enable row level security`);
await run(`revoke all on public._gungun_migrations from anon, authenticated`);
// 昔の apply-schema.mjs は filename 列で作っていた。どちらから流しても同じ台帳を
// 読めるように、残っていれば name に改名する。
await run(`do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = '_gungun_migrations'
       and column_name  = 'filename'
  ) then
    alter table public._gungun_migrations rename column filename to name;
  end if;
end $$;`);
const done = new Set((await run('select name from public._gungun_migrations')).map((r) => r.name));

const files = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();

if (statusOnly) {
  console.log('\x1b[1m適用状況\x1b[0m');
  for (const f of files) (done.has(f) ? ok : skip)(`${f}${done.has(f) ? '' : '（未適用）'}`);
  console.log('');
  process.exit(0);
}

console.log('\x1b[1mマイグレーション\x1b[0m');
for (const f of files) {
  if (done.has(f)) {
    skip(`${f}（適用済み）`);
    continue;
  }
  const sql = readFileSync(path.join(MIG_DIR, f), 'utf8');
  try {
    await run(sql);
    await run(`insert into public._gungun_migrations (name) values ('${f}') on conflict do nothing`);
    ok(`${f} を適用しました`);
  } catch (e) {
    ng(`${f} で失敗: ${e.message}`);
    process.exit(1);
  }
}

if (wantSeed) {
  console.log('\n\x1b[1mデモデータ\x1b[0m');
  try {
    await run(readFileSync(SEED, 'utf8'));
    ok('デモユーザーと「森」を入れました');
  } catch (e) {
    ng(`デモデータで失敗: ${e.message}`);
    process.exit(1);
  }
}

const counts = await run(`select
  (select count(*) from profiles) as users,
  (select count(*) from items) as items,
  (select count(*) from app_settings) as settings`);
console.log('\n\x1b[1m中身\x1b[0m');
ok(`ユーザー ${counts[0].users} 人 / 商品 ${counts[0].items} 件 / 設定 ${counts[0].settings} 件`);
console.log('\n\x1b[32m\x1b[1m完了しました。\x1b[0m\n');
