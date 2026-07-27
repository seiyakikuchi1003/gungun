import { requireSupabase } from '@/lib/supabase';
import type { Item, ListingInput } from '@/types/db';

/**
 * ぐんぐん バックエンドAPI（Supabase RPC 薄いラッパ）。
 * DB側の関数（supabase/migrations/0002_functions.sql）と1対1で対応する。
 * ツリーの親子付け・肥料消費・通知は全てDB関数側で完結する（アプリは呼ぶだけ）。
 *
 * ★現状はモック（src/store/tree.tsx）が本番。ここは Supabase 接続後に
 *   store から差し替えて使う想定の“接続層”。isSupabaseEnabled が false の間は呼ばれない。
 */

/** 種を植える（出品）→ 作成した item の id */
export async function plantSeed(userId: string, input: ListingInput): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('plant_seed', {
    p_user_id: userId,
    p_name: input.name,
    p_description: input.description,
    p_category: input.category,
    p_condition: input.condition,
    p_images: input.images,
  });
  if (error) throw error;
  return data as string;
}

/** 水やり可否（SPEC 3-2 can_water） */
export async function canWater(userId: string, targetId: string): Promise<boolean> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('can_water', {
    p_user_id: userId,
    p_target_id: targetId,
  });
  if (error) throw error;
  return Boolean(data);
}

/** 水やり（＝自分の商品を対象の子として出品）→ 作成した item の id */
export async function water(
  userId: string,
  targetId: string,
  input: ListingInput
): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('water', {
    p_user_id: userId,
    p_target_id: targetId,
    p_name: input.name,
    p_description: input.description,
    p_category: input.category,
    p_condition: input.condition,
    p_images: input.images,
  });
  if (error) throw error;
  return data as string;
}

/** 収穫（玉突き交換の生成）→ harvest の id */
export async function harvest(rootId: string, targetId: string): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('harvest', {
    p_root_id: rootId,
    p_target_id: targetId,
  });
  if (error) throw error;
  return data as string;
}

/** 木（森）の1本を取得：root_id が同じ item をまとめて返す */
export async function fetchTree(rootId: string): Promise<Item[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('items')
    .select('*')
    .eq('root_id', rootId)
    .neq('status', 'deleted')
    .order('depth', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Item[];
}

/** 種（parent_id=null, growing）の一覧：ホーム「みんなの種」用 */
export async function fetchSeeds(): Promise<Item[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('items')
    .select('*')
    .is('parent_id', null)
    .eq('status', 'growing')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Item[];
}
