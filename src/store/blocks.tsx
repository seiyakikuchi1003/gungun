import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * ブロック中ユーザーの管理（モック）。
 * ブロックすると、その人の商品・投稿を一覧から隠す。マイページの
 * ブロックリストと同じ状態を参照する。
 *
 * ネイティブ化時は Supabase の `blocks` テーブル（blocker_id/blocked_id）に置き換える。
 */
type BlocksState = {
  blocked: string[];
  isBlocked: (userId: string) => boolean;
  block: (userId: string) => void;
  unblock: (userId: string) => void;
};

const BlocksContext = createContext<BlocksState | null>(null);

// デモの初期ブロック（従来 mypage/blocks が持っていた固定値を引き継ぐ）
const INITIAL = ['kenta', 'yu'];

export function BlocksProvider({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState<string[]>(INITIAL);

  const block = useCallback((userId: string) => {
    setBlocked((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  }, []);
  const unblock = useCallback((userId: string) => {
    setBlocked((prev) => prev.filter((id) => id !== userId));
  }, []);

  const value = useMemo<BlocksState>(
    () => ({ blocked, isBlocked: (id) => blocked.includes(id), block, unblock }),
    [blocked, block, unblock]
  );
  return <BlocksContext.Provider value={value}>{children}</BlocksContext.Provider>;
}

export function useBlocks(): BlocksState {
  const ctx = useContext(BlocksContext);
  if (!ctx) throw new Error('useBlocks must be used within BlocksProvider');
  return ctx;
}
