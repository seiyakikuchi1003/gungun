import { requireSupabase } from '@/lib/supabase';

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
    nickname: r.profiles?.nickname ?? '',
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
