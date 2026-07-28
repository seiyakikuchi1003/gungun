#!/usr/bin/env node
/**
 * Supabase の接続確認スクリプト。
 *
 *   node scripts/check-supabase.mjs
 *
 * .env（EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY）を読んで、
 * テーブルが揃っているか・デモデータが入っているか・RPC が動くかを順に確かめる。
 * 開発者でなくても読める日本語で結果を出す。
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const ng = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

// ── .env を読む（dotenv を入れずに済ませる）───────────────
function loadEnv(path = '.env') {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env が無い場合は環境変数だけで動かす
  }
}
loadEnv();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('\n\x1b[31m.env が設定されていません。\x1b[0m');
  console.log('プロジェクト直下に .env を作り、次の2行を書いてください：\n');
  console.log('  EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co');
  console.log('  EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx\n');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

// 期待するテーブル（0001〜0004 で作られるもの）
const TABLES = [
  'profiles', 'addresses', 'items', 'item_images', 'harvests', 'exchanges',
  'messages', 'ratings', 'fertilizer_ledger', 'board_posts', 'board_comments',
  'board_likes', 'item_likes', 'blocks', 'notifications', 'wishlists',
  'reports', 'app_settings',
];

// 0006 / 0007 で追加したもの。どれか欠けていると実機でエラー画面になる
const VIEWS = ['item_cards', 'board_cards', 'profile_stats'];
const LATE_TABLES = ['item_comments', 'admin_audit_log'];
const RPCS = [
  ['can_claim_login_bonus', {}],
  ['my_profile', {}],
];

let failed = 0;

console.log(`\n接続先: ${url}`);

// ── 1. テーブルが揃っているか ───────────────────────────
head('1. テーブルの確認');
const missing = [];
for (const t of TABLES) {
  const { error } = await db.from(t).select('*', { count: 'exact', head: true });
  if (error) missing.push(`${t}（${error.message}）`);
}
if (missing.length === 0) {
  ok(`${TABLES.length} 個のテーブルがすべて存在します`);
} else {
  ng(`次のテーブルが読めません:\n     ${missing.join('\n     ')}`);
  console.log('     → SQL Editor で gungun-setup.sql を実行し直してください');
  failed++;
}

// ── 1-2. 追加ぶん（0006 / 0007）が入っているか ─────────────
head('1-2. 追加SQL（0006 / 0007）の確認');
{
  const lack = [];
  for (const v of [...VIEWS, ...LATE_TABLES]) {
    const { error } = await db.from(v).select('*', { count: 'exact', head: true });
    // admin_audit_log は一般ユーザーに公開していないので、権限エラーなら「ある」とみなす
    if (error && !/permission|row-level/i.test(error.message)) lack.push(`${v}（${error.message}）`);
  }
  for (const [fn, args] of RPCS) {
    const { error } = await db.rpc(fn, args);
    if (error && /does not exist|schema cache/i.test(error.message)) lack.push(`${fn}()`);
  }
  // 掲示板のタグ列（0007）
  const { error: tagErr } = await db.from('board_cards').select('tag').limit(1);
  if (tagErr && /tag/i.test(tagErr.message)) lack.push('board_posts.tag');

  if (lack.length === 0) {
    ok('0006 / 0007 の追加ぶんが適用されています');
  } else {
    ng(`次が見つかりません:\n     ${lack.join('\n     ')}`);
    console.log('     → SQL Editor で gungun-0006.sql → gungun-0007.sql を順に実行してください');
    console.log('       （毎回、入力欄を全消ししてから貼り付ける）');
    failed++;
  }
}

// ── 2. アプリ設定（金額・肥料量）─────────────────────────
head('2. アプリ設定の確認');
const { data: settings, error: sErr } = await db.from('app_settings').select('key, value').order('key');
if (sErr) {
  ng(`app_settings を読めません: ${sErr.message}`);
  failed++;
} else if (!settings?.length) {
  ng('app_settings が空です（既定値が入っていません）');
  failed++;
} else {
  ok(`${settings.length} 件の設定を読めました`);
  for (const s of settings) console.log(`     ${s.key} = ${JSON.stringify(s.value)}`);
}

// ── 3. デモデータ（スピーカーの木）──────────────────────
head('3. デモデータの確認');
const { count: users } = await db.from('profiles').select('*', { count: 'exact', head: true });
const { count: items } = await db.from('items').select('*', { count: 'exact', head: true });
const { data: seeds } = await db.from('items').select('id, name').is('parent_id', null);
if (!items) {
  ng('商品が1件もありません（seed.sql が流れていない可能性があります）');
  failed++;
} else {
  ok(`ユーザー ${users} 人 / 商品 ${items} 件 / タネ ${seeds?.length ?? 0} 本`);
  for (const s of seeds ?? []) console.log(`     タネ: ${s.name}`);
}

// ── 4. RPC（森のルール）が呼べるか ──────────────────────
head('4. サーバー側の処理（RPC）の確認');
const root = seeds?.[0];
if (!root) {
  ng('タネが無いため RPC を確認できません');
  failed++;
} else {
  // ツリーの葉を1つ拾って、そこから起点までの一本道を引けるか試す
  const { data: leaf } = await db
    .from('items').select('id, name, depth').eq('root_id', root.id)
    .order('depth', { ascending: false }).limit(1).single();

  // 引数名は 0002_functions.sql の定義どおり target_id（他の RPC は p_ 始まりなので注意）
  const { data: path, error: rErr } = await db.rpc('get_ancestors', { target_id: leaf?.id });
  if (rErr) {
    ng(`get_ancestors を呼べません: ${rErr.message}`);
    failed++;
  } else {
    ok(`get_ancestors が動作（「${leaf?.name}」までの一本道に ${path?.length ?? 0} 件）`);
  }
}

// ── 5. アクセス制限（RLS）が効いているか ────────────────
head('5. セキュリティ（RLS）の確認');
const { data: addrs, error: aErr } = await db.from('addresses').select('id');
if (aErr) {
  ok(`他人の住所は読めません（${aErr.message}）`);
} else if ((addrs?.length ?? 0) === 0) {
  ok('他人の住所は1件も読めません（未ログインのため正しい挙動です）');
} else {
  ng(`未ログインなのに住所が ${addrs.length} 件読めてしまいます。RLS を確認してください`);
  failed++;
}

// ── まとめ ───────────────────────────────────────────
console.log('');
if (failed === 0) {
  console.log('\x1b[32m\x1b[1m すべて正常です。アプリを実データに繋げられます。\x1b[0m\n');
} else {
  console.log(`\x1b[31m\x1b[1m ${failed} 件の問題が見つかりました。上のメッセージを確認してください。\x1b[0m\n`);
  process.exitCode = 1;
}
