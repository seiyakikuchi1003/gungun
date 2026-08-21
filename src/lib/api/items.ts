import { requireSupabase } from '@/lib/supabase';
import type { MockItem } from '@/data/mock';
import { ITEM_CARD_COLUMNS, toItem, relativeTime, DELETED_USER_NAME, type ItemCardRow, displayName } from './map';

/**
 * 商品（＝森のノード）の読み書き。
 *
 * ツリーの整合性（parent_id / root_id / depth）や肥料の増減は
 * すべて DB 側の RPC で確定する。ここは呼ぶだけ。
 */

export type ListingInput = {
  name: string;
  category: string;
  condition: string;
  description: string;
  /** アップロード済み画像のURL。1枚目がサムネイル */
  images: string[];
};

const cards = () => requireSupabase().from('item_cards').select(ITEM_CARD_COLUMNS);

function rows(data: unknown): MockItem[] {
  return ((data ?? []) as ItemCardRow[]).map(toItem);
}

// ── 取得 ───────────────────────────────────────────────────

/** ホーム「みんなの種」：まだ収穫されていない種 */
export async function fetchSeeds(limit = 60): Promise<MockItem[]> {
  const { data, error } = await cards()
    .is('parent_id', null)
    .eq('status', 'growing')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return rows(data);
}

/**
 * 森ぜんぶ（削除済みを除く全商品）。
 *
 * ツリーの親子をたどる処理（祖先・子・同じ木）を画面側で同期的に行うため、
 * まとめて読み込んでクライアントに持つ。件数が増えたらページングに切り替える。
 */
export async function fetchAllItems(limit = 500): Promise<MockItem[]> {
  const { data, error } = await cards().order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return rows(data);
}

/** 木1本ぶん（同じ root_id）。深さ順 */
export async function fetchTree(rootId: string): Promise<MockItem[]> {
  const { data, error } = await cards().eq('root_id', rootId).order('depth', { ascending: true });
  if (error) throw error;
  return rows(data);
}

export async function fetchItem(id: string): Promise<MockItem | null> {
  const { data, error } = await cards().eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toItem(data as unknown as ItemCardRow) : null;
}

/** 起点から指定商品までの一本道（収穫の輪＝これ） */
export async function fetchAncestors(itemId: string): Promise<MockItem[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_ancestors', { target_id: itemId });
  if (error) throw error;
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return [];
  const { data: full, error: e2 } = await cards().in('id', ids).order('depth', { ascending: true });
  if (e2) throw e2;
  return rows(full);
}

export async function fetchMyItems(userId: string): Promise<MockItem[]> {
  const { data, error } = await cards()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return rows(data);
}

/** 検索。商品名の部分一致（種だけでなく木の途中も対象） */
export async function searchItems(keyword: string, category?: string): Promise<MockItem[]> {
  let q = cards().eq('status', 'growing');
  if (keyword.trim()) q = q.ilike('name', `%${keyword.trim()}%`);
  if (category) q = q.eq('category', category);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(60);
  if (error) throw error;
  return rows(data);
}

// ── 書き込み（すべて RPC）────────────────────────────────────

/** 種を植える → 作成した商品の id */
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

/** 水やり可否（SPEC 3-2） */
export async function canWater(userId: string, targetId: string): Promise<boolean> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('can_water', { p_user_id: userId, p_target_id: targetId });
  if (error) throw error;
  return Boolean(data);
}

/** 水やり（＝自分の商品を対象の子として出品）→ 作成した商品の id */
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

export async function updateItem(itemId: string, input: ListingInput): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('update_item', {
    p_item_id: itemId,
    p_name: input.name,
    p_description: input.description,
    p_category: input.category,
    p_condition: input.condition,
    // 空配列を渡すと全消しになるので、変更なしのときは null にする
    p_images: input.images.length ? input.images : null,
  });
  if (error) throw error;
}

export async function deleteItem(itemId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('delete_item', { p_item_id: itemId });
  if (error) throw error;
}

/** 収穫 → harvest の id */
export async function harvest(rootId: string, targetId: string): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('harvest', { p_root_id: rootId, p_target_id: targetId });
  if (error) throw error;
  return data as string;
}

// ── 商品へのコメント ────────────────────────────────────────

export type ItemComment = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  createdAt: string;
};

export async function fetchItemComments(itemId: string): Promise<ItemComment[]> {
  const { data, error } = await requireSupabase()
    .from('item_comments')
    .select('id, user_id, body, created_at, profiles(nickname, avatar_url)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    authorName: displayName(r.profiles?.nickname),
    authorAvatar: r.profiles?.avatar_url ?? '',
    body: r.body,
    createdAt: relativeTime(r.created_at),
  }));
}

export async function addItemComment(
  itemId: string,
  userId: string,
  body: string
): Promise<void> {
  const { error } = await requireSupabase()
    .from('item_comments')
    .insert({ item_id: itemId, user_id: userId, body: body.trim() });
  if (error) throw error;
}

export async function deleteItemComment(commentId: string): Promise<void> {
  const { error } = await requireSupabase().from('item_comments').delete().eq('id', commentId);
  if (error) throw error;
}

/** その種がすでに収穫済みか */
export async function isHarvested(rootId: string): Promise<boolean> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from('harvests')
    .select('id', { count: 'exact', head: true })
    .eq('root_item_id', rootId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
