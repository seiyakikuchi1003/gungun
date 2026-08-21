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
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e.trim()) return e;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; error_description?: unknown; details?: unknown };
    for (const v of [o.message, o.error_description, o.details]) {
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return fallback;
}
