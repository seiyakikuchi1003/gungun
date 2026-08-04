import { requireSupabase } from '@/lib/supabase';
import { DELETED_USER_NAME } from './map';
import type { MockItem } from '@/data/mock';
import { ITEM_CARD_COLUMNS, toItem, type ItemCardRow } from './map';

/** 商品のお気に入り・ブロック・通報。 */

// ── 商品のお気に入り ───────────────────────────────────────

export async function fetchMyItemLikes(userId: string): Promise<string[]> {
  const { data, error } = await requireSupabase()
    .from('item_likes')
    .select('item_id')
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as { item_id: string }[]).map((r) => r.item_id);
}

export async function toggleItemLike(itemId: string, userId: string, on: boolean): Promise<void> {
  const sb = requireSupabase();
  if (on) {
    const { error } = await sb.from('item_likes').upsert({ item_id: itemId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await sb
      .from('item_likes')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

// ── ブロック ───────────────────────────────────────────────

export type BlockedUser = { id: string; nickname: string; avatarUrl: string | null };

export async function fetchBlocks(userId: string): Promise<BlockedUser[]> {
  const { data, error } = await requireSupabase()
    .from('blocks')
    .select('blocked_id, profiles!blocks_blocked_id_fkey(id, nickname, avatar_url)')
    .eq('blocker_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.blocked_id,
    nickname: r.profiles?.nickname ?? DELETED_USER_NAME,
    avatarUrl: r.profiles?.avatar_url ?? null,
  }));
}

export async function setBlocked(
  blockerId: string,
  blockedId: string,
  on: boolean
): Promise<void> {
  const sb = requireSupabase();
  if (on) {
    const { error } = await sb.from('blocks').upsert({ blocker_id: blockerId, blocked_id: blockedId });
    if (error) throw error;
  } else {
    const { error } = await sb
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);
    if (error) throw error;
  }
}

// ── 通報 ───────────────────────────────────────────────────

export type ReportTarget = 'item' | 'board_post' | 'board_comment' | 'user';

export async function submitReport(
  reporterId: string,
  targetType: ReportTarget,
  targetId: string,
  reason: string
): Promise<void> {
  const { error } = await requireSupabase().from('reports').insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason: reason.trim() || null,
  });
  if (error) throw error;
}

// ── いいね一覧（マイページ）─────────────────────────────────
// 「いいねしたものを一覧で見たい」＝メルカリの「いいね一覧」に相当する導線。

/** いいねした商品。押した順（新しい順） */
export async function fetchLikedItems(userId: string): Promise<MockItem[]> {
  const sb = requireSupabase();
  const { data: likes, error } = await sb
    .from('item_likes')
    .select('item_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  const ids = ((likes ?? []) as { item_id: string }[]).map((r) => r.item_id);
  if (!ids.length) return [];

  // item_cards は削除済みを除くビューなので、消えた商品は自然に一覧から落ちる
  const { data, error: e2 } = await sb.from('item_cards').select(ITEM_CARD_COLUMNS).in('id', ids);
  if (e2) throw e2;

  const byId = new Map((data ?? []).map((r: any) => [r.id, toItem(r as ItemCardRow)]));
  // 押した順を保つ（in() は順序を保証しない）
  return ids.map((id) => byId.get(id)).filter((x): x is MockItem => Boolean(x));
}

/** いいねした投稿のID。押した順（新しい順） */
export async function fetchLikedPostIds(userId: string): Promise<string[]> {
  const { data, error } = await requireSupabase()
    .from('board_likes')
    .select('post_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as { post_id: string }[]).map((r) => r.post_id);
}

// ── 閲覧履歴（最近見た商品）────────────────────────────────

/** 商品を見たことを記録する（0011 の touch_item_view。同じ商品は1行・直近100件） */
export async function recordItemView(itemId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('touch_item_view', { p_item_id: itemId });
  if (error) throw error;
}

/** 最近見た商品。見た順（新しい順） */
export async function fetchViewHistory(userId: string, limit = 60): Promise<MockItem[]> {
  const sb = requireSupabase();
  const { data: views, error } = await sb
    .from('item_views')
    .select('item_id, viewed_at')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const ids = ((views ?? []) as { item_id: string }[]).map((r) => r.item_id);
  if (!ids.length) return [];

  const { data, error: e2 } = await sb.from('item_cards').select(ITEM_CARD_COLUMNS).in('id', ids);
  if (e2) throw e2;
  const byId = new Map((data ?? []).map((r: any) => [r.id, toItem(r as ItemCardRow)]));
  return ids.map((id) => byId.get(id)).filter((x): x is MockItem => Boolean(x));
}

/** 履歴を全部消す（プライバシー配慮。メルカリと同じく消せるようにする） */
export async function clearViewHistory(userId: string): Promise<void> {
  const { error } = await requireSupabase().from('item_views').delete().eq('user_id', userId);
  if (error) throw error;
}
