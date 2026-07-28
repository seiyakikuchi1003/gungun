import { requireSupabase } from '@/lib/supabase';
import { relativeTime } from './map';
import type { NotificationType } from '@/types/db';

export type AppNotification = {
  id: string;
  type: NotificationType;
  body: string;
  relatedId: string | null;
  read: boolean;
  createdAt: string;
};

export async function fetchNotifications(userId: string, limit = 100): Promise<AppNotification[]> {
  const { data, error } = await requireSupabase()
    .from('notifications')
    .select('id, type, body, related_id, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    type: r.type,
    body: r.body,
    relatedId: r.related_id ?? null,
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
