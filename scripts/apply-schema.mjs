#!/usr/bin/env node
/**
 * Supabase に SQL を流すスクリプト（SQL Editor へのコピペ不要）。
 *
 *   node scripts/apply-schema.mjs                # 未適用のマイグレーションだけ流す
 *   node scripts/apply-schema.mjs --seed         # デモデータも入れ直す
 *   node scripts/apply-schema.mjs --status       # 何が適用済みかだけ見る
 *
 * 接続情報は SUPABASE_DB_URL（Supabase ダッシュボード → Connect →
 * 「Session pooler」の URI）を環境変数か .env.local から読む。
 *
 * ★ apply_all.sql と違って「何度でも流せる」。
 *   適用済みのファイル名を public._gungun_migrations に記録して、
 *   2回目以降は飛ばすため。1ファイル = 1トランザクションなので、
 *   途中でエラーになってもそのファイルの変更は残らない。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations');
const SEED = path.join(ROOT, 'supabase', 'seed_demo.sql');

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const ng = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const skip = (m) => console.log(`  \x1b[90m・${m}\x1b[0m`);

const args = process.argv.slice(2);
const wantSeed = args.includes('--seed');
const statusOnly = args.includes('--status');

// ── 接続情報 ────────────────────────────────────────────────
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.join(ROOT, '.env.local'));
loadEnv(path.join(ROOT, '.env'));

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.log('\n\x1b[31mSUPABASE_DB_URL が設定されていません。\x1b[0m\n');
  console.log('Supabase ダッシュボード → 右上の \x1b[1mConnect\x1b[0m → \x1b[1mSession pooler\x1b[0m の');
  console.log('URI をコピーして、[YOUR-PASSWORD] を DB パスワードに置き換えてください。\n');
  console.log('  例）postgresql://postgres.xxxxxxxx:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres\n');
  console.log('プロジェクト直下の \x1b[1m.env.local\x1b[0m に1行書けば、次回からは聞かれません：\n');
  console.log('  SUPABASE_DB_URL=postgresql://...\n');
  console.log('（.env.local は .gitignore 済みです）\n');
  process.exit(1);
}

// 接続先を伏せ字で表示して、取り違えに気づけるようにする
try {
  const u = new URL(dbUrl);
  // pooler の user は postgres.<project-ref>。取り違えが一番怖いので ref を単独で出す。
  const ref = (u.username.match(/^postgres\.([a-z0-9]{20})$/) || [])[1];
  console.log(`\n接続先: ${u.hostname}:${u.port || 5432} / user=${u.username}`);
  if (ref) console.log(`\x1b[1mプロジェクト: ${ref}\x1b[0m  ← ここが意図した先か必ず確かめる`);
} catch {
  console.log('\n\x1b[31mSUPABASE_DB_URL の形式が正しくありません（postgresql://... の形）。\x1b[0m\n');
  process.exit(1);
}

// ── 接続（証明書の検証はまず有効のまま試す）──────────────────
// ローカルの Postgres（ローカルテスト用）は SSL 無しで繋ぐ。
const noSsl = /[?&]sslmode=disable/.test(dbUrl) || /^(localhost|127\.0\.0\.1|\/)/.test(new URL(dbUrl).hostname || '');

async function connect() {
  for (const ssl of noSsl ? [false] : [{ rejectUnauthorized: true }, { rejectUnauthorized: false }]) {
    const client = new pg.Client({ connectionString: dbUrl, ssl, application_name: 'gungun-apply-schema' });
    try {
      await client.connect();
      if (ssl && !ssl.rejectUnauthorized) {
        console.log('  \x1b[33m!\x1b[0m 証明書の検証を外して接続しました（Supabase の中間証明書が未配布の環境）');
      }
      return client;
    } catch (e) {
      await client.end().catch(() => {});
      const cert = /certificate|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(String(e.message));
      if (ssl.rejectUnauthorized && cert) continue; // 証明書の問題だけ再試行する
      console.log(`\n\x1b[31m接続できません: ${e.message}\x1b[0m`);
      if (/password/i.test(e.message)) console.log('→ URI の [YOUR-PASSWORD] を実際のパスワードに置き換えたか確認してください。');
      if (/ENOTFOUND|ETIMEDOUT/i.test(e.message)) console.log('→ ホスト名を確認してください（Connect ダイアログからコピーし直すのが確実です）。');
      process.exit(1);
    }
  }
}

const db = await connect();

try {
  // ── 適用台帳 ──────────────────────────────────────────────
  await db.query(`
    create table if not exists public._gungun_migrations (
      name        text primary key,
      applied_at  timestamptz not null default now()
    )
  `);
  // 昔の版は filename 列で作っていた。apply-schema-api.mjs は name で作るので、
  // 同じ台帳を両方のスクリプトから読めるように名前を揃える。
  await db.query(`
    do $$ begin
      if exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name   = '_gungun_migrations'
           and column_name  = 'filename'
      ) then
        alter table public._gungun_migrations rename column filename to name;
      end if;
    end $$;
  `);
  // 台帳は運用者しか触らない。RLS を入れて anon / authenticated の権限を落としておく
  // （付け忘れると Supabase から "Table publicly accessible" の警告が飛ぶ）。
  await db.query('alter table public._gungun_migrations enable row level security');
  await db.query('revoke all on public._gungun_migrations from anon, authenticated');
  const { rows: done } = await db.query('select name from public._gungun_migrations');
  const applied = new Set(done.map((r) => r.name));

  const files = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();

  // 台帳が空なのにテーブルがある＝以前 apply_all.sql を SQL Editor で流した状態。
  // そのまま流すと「already exists」で全部こけるので、既存ぶんを適用済みとして登録する。
  if (applied.size === 0) {
    const { rows } = await db.query(`select to_regclass('public.profiles') is not null as has_schema`);
    if (rows[0].has_schema) {
      // どこまで入っているかを実体から判定する（apply_all.sql は 0009 までを含む）
      const probes = [
        ['0007_item_comments.sql', "to_regclass('public.item_comments')"],
        ['0008_meeting_07_28.sql', "to_regclass('public.sapling_items')"],
        ['0009_purchases_push_legacy.sql', "to_regclass('public.purchases')"],
      ];
      const upto = ['0001_schema.sql', '0002_functions.sql', '0003_rls.sql', '0004_admin.sql', '0005_auth.sql', '0006_app.sql'];
      for (const [file, probe] of probes) {
        const { rows: r } = await db.query(`select ${probe} is not null as ok`);
        if (r[0].ok) upto.push(file);
      }
      for (const f of upto) {
        await db.query('insert into public._gungun_migrations (name) values ($1) on conflict do nothing', [f]);
        applied.add(f);
      }
      console.log(`  \x1b[33m!\x1b[0m 既にスキーマが入っていました。${upto.length} 件を「適用済み」として台帳に登録しました`);
    }
  }

  if (statusOnly) {
    console.log('\n\x1b[1m適用状況\x1b[0m');
    for (const f of files) (applied.has(f) ? ok : skip)(`${f}${applied.has(f) ? '' : '（未適用）'}`);
    console.log('');
    process.exit(0);
  }

  // ── マイグレーション ──────────────────────────────────────
  console.log('\n\x1b[1mマイグレーション\x1b[0m');
  let ran = 0;
  for (const f of files) {
    if (applied.has(f)) { skip(`${f}（適用済み）`); continue; }
    const sql = readFileSync(path.join(MIG_DIR, f), 'utf8');
    try {
      await db.query('begin');
      await db.query(sql);
      await db.query('insert into public._gungun_migrations (name) values ($1)', [f]);
      await db.query('commit');
      ok(`${f} を適用しました`);
      ran++;
    } catch (e) {
      await db.query('rollback').catch(() => {});
      ng(`${f} でエラー: ${e.message}`);
      if (e.position) console.log(`     （SQL の ${e.position} 文字目あたり）`);
      console.log('\n\x1b[31mこのファイルの変更は取り消しました。ここで止まります。\x1b[0m\n');
      process.exit(1);
    }
  }
  if (ran === 0) console.log('  すべて適用済みでした（変更なし）');

  // ── デモデータ ────────────────────────────────────────────
  // 何度流しても増えない（先に消してから入れ直す作り）。
  if (wantSeed || ran > 0) {
    console.log('\n\x1b[1mデモデータ\x1b[0m');
    try {
      await db.query('begin');
      await db.query(readFileSync(SEED, 'utf8'));
      await db.query('commit');
      ok('デモユーザー6人と「森」を入れ直しました');
    } catch (e) {
      await db.query('rollback').catch(() => {});
      ng(`デモデータでエラー: ${e.message}`);
      process.exit(1);
    }
  }

  // ── 結果の確認 ────────────────────────────────────────────
  const { rows: counts } = await db.query(`
    select
      (select count(*) from profiles)                        as users,
      (select count(*) from items)                           as items,
      (select count(*) from items where parent_id is null)    as seeds,
      (select count(*) from app_settings)                     as settings
  `);
  const c = counts[0];
  console.log('\n\x1b[1m中身\x1b[0m');
  ok(`ユーザー ${c.users} 人 / 商品 ${c.items} 件 / タネ ${c.seeds} 本 / 設定 ${c.settings} 件`);

  console.log('\n\x1b[32m\x1b[1mDB の準備ができました。\x1b[0m');
  console.log('次は  \x1b[1mnpm run check:supabase\x1b[0m  で、アプリ側から見えるかを確認してください。\n');
} finally {
  await db.end().catch(() => {});
}
