import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { notifications as seed, type Notif } from '@/data/mockSocial';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useMe } from '@/store/me';
import * as api from '@/lib/api/notifications';

/**
 * 通知。実DB接続時は `notifications` テーブルを読み、既読は read_at に書く。
 *
 * 画面は従来の Notif 型のまま使えるよう詰め替える。
 * DB の body は完成した文（「〜に水やりがありました」）なので、
 * モックのように「{actor}さん」を前置しない（actorId を空にして判別させる）。
 */
type NotificationsState = {
  list: Notif[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsState | null>(null);

function toNotif(n: api.AppNotification): Notif {
  return {
    id: n.id,
    type: n.type,
    body: n.body,
    createdAt: n.createdAt,
    read: n.read,
    today: /分前|時間前|たった今/.test(n.createdAt),
    // body は主語を含む完成文なので名前は前置しないが、
    // アイコンを出すために「誰が起こしたか」は渡す（2026-08-12）
    actorId: n.actorId ?? undefined,
    actorName: n.actorName ?? undefined,
    actorAvatar: n.actorAvatar ?? undefined,
    imageUrl: n.imageUrl ?? undefined,
    // 通知タップで該当ページへ飛べるように、対象IDを画面まで引き回す
    relatedId: n.relatedId ?? undefined,
  };
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const live = isSupabaseEnabled;
  const me = useMe();
  const [list, setList] = useState<Notif[]>(() => (live ? [] : seed.map((n) => ({ ...n }))));

  const refresh = useCallback(async () => {
    if (!live || !me.live) return;
    try {
      setList((await api.fetchNotifications(me.id)).map(toNotif));
    } catch {
      // 取れなくても画面は動かす（0件表示になるだけ）
    }
  }, [live, me.live, me.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markRead = useCallback(
    (id: string) => {
      setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      if (live && me.live) api.markRead([id]).catch(() => {});
    },
    [live, me.live]
  );

  const markAllRead = useCallback(() => {
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
    if (live && me.live) api.markRead().catch(() => {});
  }, [live, me.live]);

  const value = useMemo<NotificationsState>(
    () => ({
      list,
      unreadCount: list.filter((n) => !n.read).length,
      markRead,
      markAllRead,
      refresh,
    }),
    [list, markRead, markAllRead, refresh]
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
