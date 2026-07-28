import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * いいねの状態を画面をまたいで保持する（モック）。
 * item / board post などを一意なキー（例: "item:speaker", "post:p1"）で管理する。
 * ネイティブ化時は Supabase の item_likes / board_likes に置き換える。
 */
type LikesState = {
  /** fallback = まだ操作されていないときの初期値（デモで最初からいいね済みの投稿など） */
  isLiked: (key: string, fallback?: boolean) => boolean;
  toggle: (key: string, fallback?: boolean) => boolean; // 変更後の状態を返す
};

const LikesContext = createContext<LikesState | null>(null);

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string, fallback = false) => {
    let next = false;
    setLiked((prev) => {
      const cur = key in prev ? prev[key] : fallback;
      next = !cur;
      return { ...prev, [key]: next };
    });
    return next;
  }, []);

  const value = useMemo<LikesState>(
    () => ({ isLiked: (key, fallback = false) => (key in liked ? liked[key] : fallback), toggle }),
    [liked, toggle]
  );
  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export function useLikes(): LikesState {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error('useLikes must be used within LikesProvider');
  return ctx;
}
