import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useMe } from '@/store/me';
import * as api from '@/lib/api/social';

/**
 * ブロック中ユーザーの管理。
 * ブロックすると、その人の商品・投稿を一覧から隠す。
 *
 * 実DB接続時は `blocks` テーブル（blocker_id / blocked_id）と同期する。
 */
export type BlockedUser = api.BlockedUser;

type BlocksState = {
  blocked: string[];
  /** ブロックした相手の表示情報（マイページのブロックリスト用） */
  blockedUsers: BlockedUser[];
  isBlocked: (userId: string) => boolean;
  block: (userId: string) => void;
  unblock: (userId: string) => void;
  refresh: () => Promise<void>;
};

const BlocksContext = createContext<BlocksState | null>(null);

// モックの初期ブロック（従来 mypage/blocks が持っていた固定値を引き継ぐ）
const MOCK_INITIAL = ['kenta', 'yu'];

export function BlocksProvider({ children }: { children: React.ReactNode }) {
  const live = isSupabaseEnabled;
  const me = useMe();
  const [blocked, setBlocked] = useState<string[]>(live ? [] : MOCK_INITIAL);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  const refresh = useCallback(async () => {
    if (!live || !me.live) return;
    try {
      const list = await api.fetchBlocks(me.id);
      setBlockedUsers(list);
      setBlocked(list.map((u) => u.id));
    } catch {
      // 取れなくても画面は動かす（何も隠さないだけ）
    }
  }, [live, me.live, me.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const block = useCallback(
    (userId: string) => {
      setBlocked((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      if (live && me.live) api.setBlocked(me.id, userId, true).then(refresh).catch(() => {});
    },
    [live, me.live, me.id, refresh]
  );

  const unblock = useCallback(
    (userId: string) => {
      setBlocked((prev) => prev.filter((id) => id !== userId));
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
      if (live && me.live) api.setBlocked(me.id, userId, false).then(refresh).catch(() => {});
    },
    [live, me.live, me.id, refresh]
  );

  const value = useMemo<BlocksState>(
    () => ({
      blocked,
      blockedUsers,
      isBlocked: (id) => blocked.includes(id),
      block,
      unblock,
      refresh,
    }),
    [blocked, blockedUsers, block, unblock, refresh]
  );
  return <BlocksContext.Provider value={value}>{children}</BlocksContext.Provider>;
}

export function useBlocks(): BlocksState {
  const ctx = useContext(BlocksContext);
  if (!ctx) throw new Error('useBlocks must be used within BlocksProvider');
  return ctx;
}
