import { requireSupabase } from '@/lib/supabase';
import { relativeTime } from './map';
import type { NotificationType } from '@/types/db';

export type AppNotification = {
  id: string;
  type: NotificationType;
  body: string;
  relatedId: string | null;
  /** この通知を起こした人。運営・自動処理からの通知では null */
  actorId: string | null;
  actorName: string | null;
  actorAvatar: string | null;
  /** 関係する商品の写真。無ければ null（画面は種類の絵で代替） */
  imageUrl: string | null;
  read: boolean;
  /** 保存したもの。一覧の上に固定し、一括削除の対象から外す */
  saved: boolean;
  createdAt: string;
};

export async function fetchNotifications(userId: string, limit = 100): Promise<AppNotification[]> {
  const { data, error } = await requireSupabase()
    .from('notification_cards')
    .select('id, type, body, related_id, read_at, created_at, actor_id, actor_nickname, actor_avatar, image_url, saved_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    type: r.type,
    body: r.body,
    relatedId: r.related_id ?? null,
    actorId: r.actor_id ?? null,
    actorName: r.actor_nickname ?? null,
    actorAvatar: r.actor_avatar ?? null,
    imageUrl: r.image_url ?? null,
    saved: !!r.saved_at,
    read: Boolean(r.read_at),
    createdAt: relativeTime(r.created_at),
  }));
}

export async function unreadCount(userId: string): Promise<number> {
  const { count, error } = await requireSupabase()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** ids を渡さなければ全部既読にする */
export async function markRead(ids?: string[]): Promise<void> {
  const { error } = await requireSupabase().rpc('mark_notifications_read', {
    p_ids: ids && ids.length ? ids : null,
  });
  if (error) throw error;
}

/** 通知を1件消す（自分の通知だけ。RLS で守られている） */
export async function removeNotification(id: string): Promise<void> {
  const { error } = await requireSupabase().from('notifications').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 読み終わった通知をまとめて消す。
 * 保存したものは残す（うっかり大事なものまで消さないため）。
 */
export async function clearNotifications(userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .is('saved_at', null);
  if (error) throw error;
}

/** 保存の付け外し */
export async function setSaved(id: string, saved: boolean): Promise<void> {
  const { error } = await requireSupabase()
    .from('notifications')
    .update({ saved_at: saved ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}
