#!/usr/bin/env node
/**
 * 旧サービスの名簿を legacy_users に取り込む（既存160名の移行）。
 *
 *   node scripts/import-legacy.mjs <CSVのパス>            … 中身の確認だけ（何も書き込まない）
 *   node scripts/import-legacy.mjs <CSVのパス> --apply    … 実際に取り込む
 *   node scripts/import-legacy.mjs --status               … 移行の進み具合を見る
 *
 * 【移行のしくみ】
 * パスワードは引き継げないので、旧ユーザーには「登録し直してもらう」。
 * ここで取り込んだメールアドレスと一致する人が新規登録すると、
 * handle_new_user トリガが legacy_users を見て
 *   ・旧サービスのニックネームを引き継ぐ
 *   ・legacy_users.profile_id と migrated_at を埋める
 * ので、誰がまだ移行できていないかが分かる。
 *
 * 【CSV の形】
 * 1行目は見出し。列の順番は問わない。使うのは次の3つ。
 *   email     … 必須
 *   nickname  … 任意（旧サービスでの表示名）
 *   id        … 任意（旧サービスのユーザーID。legacy_id になる。無ければメールを使う）
 * 余った列は raw にそのまま残すので、あとから参照できる。
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const ng = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`  \x1b[90m・${m}\x1b[0m`);

// ── 接続情報 ─────────────────────────────────────────────
function env(name) {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (m) return m[1].trim();
  }
  return process.env[name] ?? '';
}
const REF = env('SUPABASE_PROJECT_REF') || 'orjckynuqqeisqbhfmon';
const TOKEN = env('SUPABASE_ACCESS_TOKEN');
if (!TOKEN) {
  ng('SUPABASE_ACCESS_TOKEN が見つかりません（.env.local）');
  process.exit(1);
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (!r.ok || j.message) throw new Error(j.message ?? `HTTP ${r.status}`);
  return j;
}
const esc = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

// ── CSV を読む（引用符つきの値にも対応） ─────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const src = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** 見出しの表記ゆれを吸収する */
function pick(headers, candidates) {
  const norm = (s) => s.trim().toLowerCase().replace(/[\s_-]/g, '');
  return headers.findIndex((h) => candidates.some((c) => norm(h) === norm(c)));
}

// ── 進み具合 ─────────────────────────────────────────────
async function status() {
  const [r] = await sql(`
    select count(*) as total,
           count(*) filter (where migrated_at is not null) as migrated,
           count(*) filter (where invited_at is not null) as invited
      from legacy_users`);
  console.log('\n旧ユーザーの移行状況');
  info(`名簿に取り込み済み : ${r.total} 人`);
  info(`案内を送った       : ${r.invited} 人`);
  ok(`登録が完了した     : ${r.migrated} 人`);
  if (Number(r.total) > 0) {
    const rest = await sql(`
      select email, coalesce(nickname,'') as nickname from legacy_users
       where migrated_at is null order by email limit 10`);
    if (rest.length) {
      console.log('\n  まだ登録していない人（先頭10件）');
      rest.forEach((x) => info(`${x.email}${x.nickname ? ` / ${x.nickname}` : ''}`));
    }
  }
  console.log('');
}

// ── 取り込み ─────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--status')) return status();

  const file = process.argv[2];
  if (!file || !existsSync(file)) {
    console.log('使い方: node scripts/import-legacy.mjs <CSVのパス> [--apply]');
    console.log('        node scripts/import-legacy.mjs --status');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');

  const rows = parseCsv(readFileSync(file, 'utf8'));
  const headers = rows[0];
  const iEmail = pick(headers, ['email', 'mail', 'メールアドレス', 'メール']);
  const iNick = pick(headers, ['nickname', 'name', 'ニックネーム', '名前', '表示名']);
  const iId = pick(headers, ['id', 'legacy_id', 'user_id', 'ユーザーID']);

  if (iEmail < 0) {
    ng(`メールアドレスの列が見つかりません。見出し: ${headers.join(' / ')}`);
    process.exit(1);
  }

  const seen = new Set();
  const list = [];
  const bad = [];
  for (const r of rows.slice(1)) {
    const email = (r[iEmail] ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { bad.push(r[iEmail] ?? '(空)'); continue; }
    if (seen.has(email)) continue;          // 同じ人が2行あっても1件にする
    seen.add(email);
    const raw = Object.fromEntries(headers.map((h, i) => [h.trim(), (r[i] ?? '').trim()]));
    list.push({
      legacy_id: (iId >= 0 && r[iId]?.trim()) || email,
      email,
      nickname: iNick >= 0 ? (r[iNick] ?? '').trim() || null : null,
      raw,
    });
  }

  console.log(`\n${path.basename(file)} を読みました`);
  info(`使う列: メール=${headers[iEmail]}${iNick >= 0 ? ` / 名前=${headers[iNick]}` : ''}${iId >= 0 ? ` / ID=${headers[iId]}` : ''}`);
  ok(`取り込める行: ${list.length} 件`);
  if (bad.length) ng(`メールアドレスが不正で飛ばした行: ${bad.length} 件（例: ${bad.slice(0, 3).join(', ')}）`);
  console.log('\n  先頭3件');
  list.slice(0, 3).forEach((x) => info(`${x.email}${x.nickname ? ` / ${x.nickname}` : ''}`));

  if (!apply) {
    console.log('\n確認だけで終了しました。取り込むなら --apply を付けて実行してください。\n');
    return;
  }

  // 何度流しても増えないよう、メールをキーに更新する
  const chunk = 50;
  let done = 0;
  for (let i = 0; i < list.length; i += chunk) {
    const part = list.slice(i, i + chunk);
    const values = part
      .map((x) => `(${esc(x.legacy_id)}, ${esc(x.email)}, ${esc(x.nickname)}, ${esc(JSON.stringify(x.raw))}::jsonb)`)
      .join(',\n');
    await sql(`
      insert into legacy_users (legacy_id, email, nickname, raw)
      values ${values}
      on conflict (legacy_id) do update
        set email = excluded.email,
            nickname = coalesce(excluded.nickname, legacy_users.nickname),
            raw = excluded.raw`);
    done += part.length;
    info(`${done} / ${list.length} 件`);
  }
  ok(`取り込みました（${done} 件）`);

  // すでに新サービスに登録済みの人がいれば、その場で紐づけておく
  const linked = await sql(`
    update legacy_users l set profile_id = u.id, migrated_at = coalesce(l.migrated_at, now())
      from auth.users u
     where lower(u.email) = lower(l.email) and l.profile_id is null
    returning l.email`);
  if (linked.length) ok(`すでに登録済みだった人を紐づけました（${linked.length} 件）`);

  await status();
}

main().catch((e) => { ng(e.message); process.exit(1); });
