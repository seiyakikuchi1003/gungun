/**
 * 例外から「人に見せる文言」を取り出す。
 *
 * 【なぜ要るか】
 * Supabase（PostgREST）が返すエラーは Error のインスタンスではなく
 * `{ message, details, hint, code }` のただのオブジェクト。
 * そのため `e instanceof Error ? e.message : '…'` と書くと必ず else に落ち、
 * RPC が返した本当の理由（例：「先にご自身の発送を完了してください」）が捨てられ、
 * 画面には「受け取りを記録できませんでした」しか出なかった（2026-08-13 項目5）。
 *
 * DB の raise exception の文言はそのままユーザーに見せる前提で書いているので、
 * ここで拾って表に出す。
 */
/**
 * DB が自分で出す英語のエラーを、人に読める言葉に置き換える。
 *
 * raise exception の文言は日本語で書いてあるのでそのまま出してよいが、
 * 一意制約などは Postgres が英語で返す。実際に、同じ出品を二度通報すると
 * 画面に `duplicate key value violates unique constraint "reports_open_unique"`
 * がそのまま出ていた（2026-09-14）。
 */
const BY_CONSTRAINT: Record<string, string> = {
  // 同じ相手・同じ対象への通報は、運営が片付けるまで1件だけ受け付ける
  reports_open_unique: 'この出品はすでに通報しています。運営が順番に確認しています。',
};

/** 英語のまま出してはいけない、DB 内部のエラーの見分け */
const DB_INTERNAL =
  /duplicate key value|violates (unique|foreign key|check) constraint|null value in column|invalid input syntax/i;

function humanize(message: string, fallback: string): string {
  const named = message.match(/constraint "([^"]+)"/);
  if (named && BY_CONSTRAINT[named[1]]) return BY_CONSTRAINT[named[1]];
  if (DB_INTERNAL.test(message)) return fallback;
  return message;
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return humanize(e.message, fallback);
  if (typeof e === 'string' && e.trim()) return humanize(e, fallback);
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; error_description?: unknown; details?: unknown };
    for (const v of [o.message, o.error_description, o.details]) {
      if (typeof v === 'string' && v.trim()) return humanize(v, fallback);
    }
  }
  return fallback;
}
