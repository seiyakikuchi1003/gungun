#!/usr/bin/env node
/**
 * ログイン機能の通し確認。
 *
 *   node scripts/check-auth.mjs
 *
 * テスト用のアカウントを1つ作り、
 *   登録 → プロフィール自動作成 → ログアウト → ログイン → 退会
 * まで実際に実行して確かめる。最後にそのアカウントは消すので、
 * 何度実行してもデータは増えない。
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const ng = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

function loadEnv(path = '.env') {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('\n\x1b[31m.env が設定されていません。\x1b[0m 先に npm run check:supabase を実行してください。\n');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// 使い捨てのテストアカウント
const stamp = Date.now().toString(36);
const email = `gungun.test.${stamp}@gmail.com`;
const password = `Test-${stamp}-Pw`;
const nickname = `テスト${stamp.slice(-4)}`;

let failed = 0;
let userId = null;

console.log(`\n接続先: ${url}`);
console.log(`テスト用アカウント: ${email}`);

// ── 1. 新規登録 ─────────────────────────────────────────
head('1. 新規登録');
{
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  if (error) {
    ng(`登録できません: ${error.message}`);
    if (/signups? not allowed|disabled/i.test(error.message))
      console.log('     → Authentication → Sign In / Providers → Email で登録を許可してください');
    console.log('');
    process.exit(1);
  }
  userId = data.user?.id ?? null;
  if (!data.session) {
    ng('セッションが返りませんでした（メール確認が有効なままです）');
    console.log('     → Authentication → Sign In / Providers → Email の「Confirm email」を OFF にしてください');
    console.log('     （本番で ON に戻す場合はメールテンプレートに {{ .Token }} を入れる）');
    failed++;
  } else {
    ok('登録と同時にログイン状態になりました');
  }
}

// ── 2. プロフィールが自動で作られたか（handle_new_user トリガ）──
head('2. プロフィールの自動作成');
{
  // トリガは同一トランザクション内で走るが、レプリカ差でごく稀に遅れるため数回試す
  let row = null;
  for (let i = 0; i < 5 && !row; i++) {
    const { data } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
    row = data;
    if (!row) await new Promise((r) => setTimeout(r, 400));
  }
  if (!row) {
    ng('profiles に行が作られていません');
    console.log('     → 0005_auth.sql（handle_new_user トリガ）が適用されていない可能性があります');
    failed++;
  } else if (row.nickname !== nickname) {
    ng(`ニックネームが違います（期待: ${nickname} / 実際: ${row.nickname}）`);
    failed++;
  } else {
    ok(`profiles に「${row.nickname}」が作られました（肥料 ${row.fertilizer}）`);
  }
}

// ── 3. my_profile RPC ───────────────────────────────────
head('3. 自分のプロフィールを引く RPC');
{
  const { data, error } = await db.rpc('my_profile');
  if (error) {
    ng(`my_profile を呼べません: ${error.message}`);
    failed++;
  } else {
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.id === userId) ok('my_profile が自分の行を返しました');
    else { ng('my_profile が自分の行を返しません'); failed++; }
  }
}

// ── 4. ログアウトとログイン ──────────────────────────────
head('4. ログアウト → ログイン');
{
  await db.auth.signOut();
  const { data: after } = await db.auth.getSession();
  if (after.session) { ng('ログアウトできていません'); failed++; }
  else ok('ログアウトできました');

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) { ng(`ログインできません: ${error.message}`); failed++; }
  else ok('同じメールとパスワードでログインできました');
}

// ── 5. 間違ったパスワードは弾かれるか ────────────────────
head('5. 間違ったパスワードの拒否');
{
  const tmp = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await tmp.auth.signInWithPassword({ email, password: 'wrong-password-xyz' });
  if (error) ok(`正しく拒否されました（${error.message}）`);
  else { ng('間違ったパスワードでログインできてしまいました'); failed++; }
}

// ── 6. 退会（後片付けも兼ねる）───────────────────────────
head('6. 退会');
{
  const { error } = await db.rpc('delete_own_account');
  if (error) {
    ng(`退会できません: ${error.message}`);
    console.log(`     → テスト用アカウント ${email} が残っています。管理画面から削除してください`);
    failed++;
  } else {
    await db.auth.signOut();
    const { data } = await db.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (data) { ng('退会後も profiles に行が残っています'); failed++; }
    else ok('アカウントとプロフィールが削除されました');
  }
}

console.log('');
if (failed === 0) {
  console.log('\x1b[32m\x1b[1m ログイン機能はすべて正常に動作しています。\x1b[0m\n');
} else {
  console.log(`\x1b[31m\x1b[1m ${failed} 件の問題が見つかりました。\x1b[0m\n`);
  process.exitCode = 1;
}
