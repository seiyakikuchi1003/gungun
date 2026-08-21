#!/usr/bin/env node
/**
 * Claude Code の会話ログを Markdown に書き出す。
 *
 *   node scripts/export-chat-log.mjs                       # 一番新しいセッションを書き出す
 *   node scripts/export-chat-log.mjs --all                 # 全セッションぶん
 *   node scripts/export-chat-log.mjs --session <sessionId>  # セッション指定
 *   node scripts/export-chat-log.mjs --out docs/logs        # 出力先（既定 docs/logs）
 *
 * 出力先：docs/logs/<日付>-<sessionId の先頭8桁>.md
 *
 * ★ 生のログ（.jsonl）はコミットしないこと。
 *   - 176MB 級になる（スクリーンショットが base64 で入る）
 *   - API キー・DBパスワードがそのまま残っている
 *   このスクリプトは「読める部分だけ」を抜き、秘密情報を伏せ字にしてから書き出す。
 *
 * 何を残して何を落とすか
 *   残す：人の発言、こちらの回答テキスト、ツール名と一行の説明
 *   落とす：思考（thinking）、画像、ツールの入出力の中身、base64、署名
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(import.meta.dirname, '..');

// ── 引数 ────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, def = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const wantAll = argv.includes('--all');
const wantSession = arg('--session');
const outDir = path.resolve(ROOT, arg('--out', 'docs/logs'));

// ── ログの置き場所 ──────────────────────────────────────────
// プロジェクトのパスをスラッシュ→ハイフンに置き換えたディレクトリ名になる
function logDir() {
  const base = path.join(os.homedir(), '.claude', 'projects');
  if (!existsSync(base)) return null;
  const key = ROOT.replace(/\//g, '-');
  const exact = path.join(base, key);
  if (existsSync(exact)) return exact;
  // 末尾一致で探す（cwd が変わっている場合の保険）
  const found = readdirSync(base).find((d) => d.endsWith(key) || key.endsWith(d));
  return found ? path.join(base, found) : null;
}

// ── 伏せ字 ──────────────────────────────────────────────────
/**
 * 秘密情報を伏せる。GitHub に上げる前提なので、迷ったら伏せる側に倒す。
 * 「見つけたら伏せる」ではなく「その形なら伏せる」方式にして、
 * 新しい値が増えても自動で引っかかるようにしている。
 */
const REDACTIONS = [
  // Supabase の新形式キー（secret は絶対に、publishable も念のため伏せる）
  [/sb_secret_[A-Za-z0-9_-]{8,}/g, 'sb_secret_<秘匿>'],
  [/sb_publishable_[A-Za-z0-9_-]{8,}/g, 'sb_publishable_<秘匿>'],
  // JWT（旧形式の anon / service_role キー）。ヘッダーだけの断片も伏せる
  [/eyJ[A-Za-z0-9_.-]{15,}/g, '<JWT秘匿>'],
  // Postgres 接続文字列のパスワード部分
  [/(postgres(?:ql)?:\/\/[^:\s@]+:)[^@\s]+(@)/gi, '$1<パスワード秘匿>$2'],
  // 管理画面のパスワード（gungun- で始まる自動生成のもの）
  [/gungun-[A-Za-z0-9]{16,}/g, '<管理画面パスワード秘匿>'],
  // Cloudflare / GitHub / Expo のトークンらしきもの
  [/\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{16,}/g, '<GitHubトークン秘匿>'],
  [/\bCLOUDFLARE_API_TOKEN\s*=\s*\S+/g, 'CLOUDFLARE_API_TOKEN=<秘匿>'],
  // 素で書かれたトークン。Cloudflare の API トークン（40文字）が代入の形を取らずに
  // 会話に出てきて、GitHub の push protection に実際に止められた。
  // 32文字以上の英数字の塊はまとめて伏せ、下記の「秘密でないもの」だけ除外する。
  [/[A-Za-z0-9_-]{32,}/g, (m) => (isHarmlessToken(m) ? m : '<トークン秘匿>')],
  // base64 の塊（画像やビルド成果物が紛れた場合）
  [/[A-Za-z0-9+/]{200,}={0,2}/g, '<base64省略>'],
];

/**
 * 32文字以上の英数字の塊のうち、秘密ではないと分かっているもの。
 *  - 16進だけ … git のコミットハッシュ、ビルド成果物のハッシュ
 *  - mcp_ / toolu_ / msg_ / req_ … このツール自身が振る識別子
 *  - UUID … デモユーザーの id など
 */
function isHarmlessToken(t) {
  if (/^[0-9a-f]+$/i.test(t)) return true;
  if (/^(?:mcp|toolu|msg|req|wf|trig|env|session|run|call)_/.test(t)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return true;
  return false;
}

function redact(text) {
  let s = String(text ?? '');
  for (const [re, to] of REDACTIONS) s = s.replace(re, to);
  return s;
}

/**
 * 本文の中の見出し（# 〜 ######）を h5 まで下げる。
 * そのままだと日付（##）や発言（###）の見出しと混ざって、
 * 目次や折りたたみの構造が崩れる。
 */
function demoteHeadings(text) {
  return text.replace(/^(#{1,6})\s+/gm, (m, hashes) => '#'.repeat(Math.min(hashes.length + 4, 6)) + ' ');
}

// ── 本文の取り出し ──────────────────────────────────────────
const TOOL_LABEL = {
  Bash: 'コマンド実行',
  Read: 'ファイル読み取り',
  Write: 'ファイル作成',
  Edit: 'ファイル編集',
  Grep: '検索',
  Glob: 'ファイル探索',
  Artifact: 'プレビュー公開',
  Skill: 'スキル呼び出し',
  ToolSearch: 'ツール読み込み',
};

/** ツール呼び出しを1行に要約する（入出力の中身は残さない） */
function summarizeTool(block) {
  const name = block.name ?? 'tool';
  const label = TOOL_LABEL[name] ?? name;
  const inp = block.input ?? {};
  let detail =
    inp.description ??
    inp.file_path ??
    inp.pattern ??
    inp.skill ??
    inp.command ??
    inp.query ??
    '';
  detail = String(detail).split('\n')[0].slice(0, 110);
  return `- \`${label}\`${detail ? ` — ${redact(detail)}` : ''}`;
}

function textOf(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  const out = [];
  for (const b of content) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && b.text) out.push(b.text.trim());
  }
  return out.join('\n\n').trim();
}

function toolsOf(content) {
  if (!Array.isArray(content)) return [];
  return content.filter((b) => b && b.type === 'tool_use').map(summarizeTool);
}

function hasImage(content) {
  return Array.isArray(content) && content.some((b) => b && b.type === 'image');
}

/** システムが差し込む注意書きなど、会話として読む意味がないものを外す */
function isNoise(text) {
  if (!text) return true;
  const t = text.trim();
  return (
    t.startsWith('<system-reminder>') ||
    t.startsWith('<command-name>') ||
    t.startsWith('<local-command') ||
    t.startsWith('<task-notification>') ||
    t.startsWith('Caveat:') ||
    t.startsWith('[Request interrupted') ||
    /^Stop hook feedback:/.test(t)
  );
}

/** system-reminder ブロックだけを本文から取り除く（前後の本文は残す） */
function stripReminders(text) {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<task-notification>[\s\S]*?<\/task-notification>/g, '')
    .trim();
}

// ── 1セッションを Markdown に ───────────────────────────────
function convert(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const turns = [];
  let sessionId = path.basename(file, '.jsonl');
  let firstTs = null;
  let lastTs = null;
  let pendingTools = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d.sessionId) sessionId = d.sessionId;
    if (d.timestamp) {
      firstTs ??= d.timestamp;
      lastTs = d.timestamp;
    }
    if (d.type !== 'user' && d.type !== 'assistant') continue;

    const msg = d.message;
    if (!msg || typeof msg !== 'object') continue;
    const content = msg.content;

    if (d.type === 'user') {
      // ツール結果は user ロールで返ってくる。中身は残さない
      const isToolResult =
        Array.isArray(content) && content.some((b) => b && b.type === 'tool_result');
      if (isToolResult) continue;

      let text = stripReminders(textOf(content));
      const img = hasImage(content);
      if (isNoise(text) && !img) continue;
      if (!text && !img) continue;

      turns.push({
        role: 'user',
        ts: d.timestamp,
        text: demoteHeadings(redact(text)),
        images: img,
        tools: [],
      });
      pendingTools = [];
    } else {
      const text = textOf(content);
      const tools = toolsOf(content);
      pendingTools.push(...tools);
      if (!text) continue; // 思考だけ・ツールだけの発話はまとめて次の本文に付ける
      turns.push({
        role: 'assistant',
        ts: d.timestamp,
        text: demoteHeadings(redact(text)),
        images: false,
        tools: pendingTools.slice(),
      });
      pendingTools = [];
    }
  }

  return { sessionId, firstTs, lastTs, turns };
}

const JST = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
};

function renderDay(day, sessionId, turns) {
  const out = [];
  out.push(`# 作業ログ ${day}`);
  out.push('');
  out.push(`- **日付**：${day}（日本時間）`);
  out.push(`- **やりとり**：${turns.length} 件`);
  out.push(`- **セッション**：\`${sessionId}\``);
  out.push('');
  out.push('> このファイルは `node scripts/export-chat-log.mjs` で自動生成しています。');
  out.push('> 思考の過程・画像・ツールの入出力の中身は省き、APIキーやパスワードは伏せ字にしています。');
  out.push('> 直接編集しても次回の書き出しで上書きされます。');
  out.push('');
  out.push('---');
  out.push('');

  for (const t of turns) {
    const time = JST(t.ts).slice(11);
    if (t.role === 'user') {
      out.push(`### 🙋 菊池さん — ${time}`);
      out.push('');
      if (t.images) out.push('*（スクリーンショットあり）*');
      if (t.text) out.push(t.text);
      out.push('');
    } else {
      out.push(`### 🤖 Claude — ${time}`);
      out.push('');
      if (t.tools.length) {
        out.push('<details><summary>作業内容（' + t.tools.length + '件）</summary>');
        out.push('');
        // 同じツールの連続は件数でまとめる
        const counted = [];
        for (const line of t.tools) {
          const prev = counted[counted.length - 1];
          if (prev && prev.line === line) prev.n++;
          else counted.push({ line, n: 1 });
        }
        for (const c of counted) out.push(c.n > 1 ? `${c.line} ×${c.n}` : c.line);
        out.push('');
        out.push('</details>');
        out.push('');
      }
      out.push(t.text);
      out.push('');
    }
  }
  return out.join('\n');
}

// ── 実行 ────────────────────────────────────────────────────
const dir = logDir();
if (!dir) {
  console.error('会話ログの置き場所が見つかりません（~/.claude/projects 配下）。');
  process.exit(1);
}

let files = readdirSync(dir)
  .filter((f) => f.endsWith('.jsonl'))
  .map((f) => path.join(dir, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

if (wantSession) files = files.filter((f) => path.basename(f, '.jsonl') === wantSession);
else if (!wantAll) files = files.slice(0, 1);

if (!files.length) {
  console.error('対象のログがありません。');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// 日別に分けて書き出す。1ファイルが大きいと GitHub が中身を表示しなくなるため。
const index = new Map(); // day -> { turns, sessions:Set, kb }

for (const f of files) {
  const data = convert(f);
  if (!data.turns.length) {
    console.log(`・${path.basename(f)} → 中身なし。飛ばしました`);
    continue;
  }
  const byDay = new Map();
  for (const t of data.turns) {
    const day = JST(t.ts).slice(0, 10).replace(/\//g, '-');
    if (!day) continue;
    (byDay.get(day) ?? byDay.set(day, []).get(day)).push(t);
  }
  for (const [day, turns] of [...byDay].sort()) {
    const dest = path.join(outDir, `${day}.md`);
    writeFileSync(dest, renderDay(day, data.sessionId, turns));
    const kb = Math.round(statSync(dest).size / 1024);
    index.set(day, { turns: turns.length, kb });
    console.log(`✓ ${path.relative(ROOT, dest)}（${turns.length} やりとり / ${kb}KB）`);
  }
}

// ── 書き出したものを自己点検する ────────────────────────────
// 伏せ字の取りこぼしがあると GitHub の push protection に弾かれる。
// 「上げる前に気づく」ようにここで止める。
const SUSPICIOUS = [
  [/sb_secret_[A-Za-z0-9_-]{8,}/, 'Supabase secret キー'],
  [/sb_publishable_[A-Za-z0-9_-]{8,}/, 'Supabase publishable キー'],
  [/eyJ[A-Za-z0-9_.-]{15,}/, 'JWT'],
  [/[A-Za-z0-9_-]{32,}/, 'トークンらしき文字列'],
  [/postgres(?:ql)?:\/\/[^:\s@]+:(?!<)[^@\s]{6,}@/i, 'パスワード付きの接続文字列'],
];

let leaks = 0;
for (const [day] of index) {
  const file = path.join(outDir, `${day}.md`);
  const body = readFileSync(file, 'utf8');
  body.split('\n').forEach((line, i) => {
    for (const [re, label] of SUSPICIOUS) {
      const hit = line.match(re);
      if (!hit) continue;
      if (isHarmlessToken(hit[0])) continue; // ハッシュや識別子は秘密ではない
      console.error(`\x1b[31m✗ ${day}.md:${i + 1} に ${label} が残っています\x1b[0m`);
      leaks++;
    }
  });
}
if (leaks) {
  console.error(`\n\x1b[31m${leaks} 件の取りこぼしがあります。伏せ字の規則を足してから書き出し直してください。\x1b[0m`);
  console.error('（この状態で push すると GitHub の secret scanning に弾かれます）\n');
  process.exitCode = 1;
} else {
  console.log('\x1b[32m✓ 秘密情報の取りこぼしなし\x1b[0m');
}

// 一覧（README）
if (index.size) {
  const rows = [...index].sort().reverse();
  const total = rows.reduce((s, [, v]) => s + v.turns, 0);
  const md = [
    '# 作業ログ',
    '',
    'Claude Code とのやりとりを日ごとに Markdown で残しています。',
    '`node scripts/export-chat-log.mjs` で再生成できます（直接編集しても上書きされます）。',
    '',
    '- 思考の過程・画像・ツールの入出力の中身は省いています',
    '- **API キー・DBパスワード・管理画面のパスワードは伏せ字**にしています',
    '- 生のログ（`.jsonl`）はコミットしません（176MB 級・秘密情報がそのまま入っているため）',
    '',
    `全 ${rows.length} 日 / ${total} やりとり`,
    '',
    '| 日付 | やりとり | サイズ |',
    '|---|---|---|',
    ...rows.map(([day, v]) => `| [${day}](./${day}.md) | ${v.turns} | ${v.kb}KB |`),
    '',
  ].join('\n');
  writeFileSync(path.join(outDir, 'README.md'), md);
  console.log(`✓ ${path.relative(ROOT, path.join(outDir, 'README.md'))}`);
}
