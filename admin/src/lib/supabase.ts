import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 管理画面用の Supabase クライアント（サーバー専用）。
 *
 * service_role キーを使うため RLS を越えて全データを読み書きできる。
 * 必ずサーバーコンポーネント／サーバーアクションからのみ呼ぶこと。
 *
 * URL・キーとも NEXT_PUBLIC_ を付けない。理由は2つ：
 *  1. ブラウザに渡ると全データが漏れる
 *  2. NEXT_PUBLIC_ はビルド時に値が埋め込まれるため、
 *     デプロイ先で環境変数だけ差し替えても反映されない（引き継ぎ時に事故る）
 */
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** 接続情報が揃っているか（未設定なら画面に案内を出す） */
export const isConnected = Boolean(url && serviceKey);

export function admin(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase 未接続です。admin/.env.local に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 一覧取得。接続エラーで管理画面ごと落ちないよう、必ずここを通す。
 * （URL の打ち間違いやネットワーク断でも「エラー表示つきの空の表」になる）
 */
export async function rows<T = any>(
  build: (db: SupabaseClient) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<{ data: T[]; error?: string }> {
  try {
    const { data, error } = await build(admin());
    if (error) return { data: [], error: `データを取得できませんでした（${error.message}）` };
    return { data: (data ?? []) as T[] };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { data: [], error: `Supabase に接続できませんでした（${detail}）` };
  }
}

/** 件数だけ取りたいとき（失敗しても画面を落とさない） */
export async function countOf(table: string, filter?: (q: any) => any): Promise<number> {
  try {
    let q = admin().from(table).select('*', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
