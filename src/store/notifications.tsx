import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { notifications as seed, type Notif } from '@/data/mockSocial';

/**
 * 通知の既読状態を保持する（モック）。
 * 個別タップで既読、まとめて既読も可能。ホームのベルの赤ドットは未読数に連動。
 * ネイティブ化時は Supabase の notifications.read_at に置き換える。
 */
type NotificationsState = {
  list: Notif[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsState | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Notif[]>(() => seed.map((n) => ({ ...n })));

  const markRead = useCallback((id: string) => {
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);
  const markAllRead = useCallback(() => {
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const value = useMemo<NotificationsState>(
    () => ({ list, unreadCount: list.filter((n) => !n.read).length, markRead, markAllRead }),
    [list, markRead, markAllRead]
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
