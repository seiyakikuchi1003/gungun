import { supabase, isSupabaseEnabled } from '@/lib/supabase';

/**
 * 検索ログと「人気のワード」（2026-08-21 指摘）。
 *
 * これまで「人気のキーワード」「人気のタグ」は定数を並べていただけで、
 * 実際に何が検索されているかとは無関係だった
 * （「ここは検索により入ってるものを上に上げていい。検索ボリュームが多いという意味で」）。
 * 実際に検索された語を貯めて、多い順に出す。
 *
 * ★ マイグレーション（0043）が本番に当たるまでは RPC が存在しない。
 *   そのときは黙って何もせず、呼び出し側は既定の並びに戻る。
 *   検索そのものは絶対に止めない。
 */

export type SearchScope = 'item' | 'board';

/** 検索された語を1件記録する。失敗しても呼び出し側には影響させない */
export async function logSearch(term: string, scope: SearchScope = 'item'): Promise<void> {
  if (!isSupabaseEnabled || !supabase) return;
  const t = term.trim();
  if (t.length < 2 || t.length > 30) return;
  try {
    await supabase.rpc('log_search', { p_term: t, p_scope: scope });
  } catch {
    // 記録できなくても検索は成立する
  }
}

/** よく検索されている語を多い順に。取れなければ空配列（呼び出し側が既定にフォールバック） */
export async function fetchPopularKeywords(scope: SearchScope = 'item', limit = 6): Promise<string[]> {
  if (!isSupabaseEnabled || !supabase) return [];
  try {
    const { data, error } = await supabase.rpc('popular_keywords', { p_scope: scope, p_limit: limit });
    if (error || !data) return [];
    return (data as { term: string }[]).map((r) => r.term).filter(Boolean);
  } catch {
    return [];
  }
}
