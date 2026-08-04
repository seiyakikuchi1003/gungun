import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useMe } from '@/store/me';
import * as social from '@/lib/api/social';
import * as board from '@/lib/api/board';

/**
 * いいねの状態を画面をまたいで保持する。
 *
 * キーは `item:<id>` / `post:<id>` の形。前者は item_likes、後者は board_likes に対応する。
 * 実DB接続時は起動時に自分のいいねを読み込み、タップのたびに DB へ反映する
 * （画面はすぐ切り替わり、DB 反映は裏で行う＝楽観的更新）。
 */
type LikesState = {
  /** fallback = まだ操作されていないときの初期値 */
  isLiked: (key: string, fallback?: boolean) => boolean;
  toggle: (key: string, fallback?: boolean) => boolean; // 変更後の状態を返す
  refresh: () => Promise<void>;
};

const LikesContext = createContext<LikesState | null>(null);

export const itemKey = (id: string) => `item:${id}`;
export const postKey = (id: string) => `post:${id}`;

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const live = isSupabaseEnabled;
  const me = useMe();
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    if (!live || !me.live) return;
    try {
      // 投稿一覧を丸ごと取る必要はない。board_likes / item_likes だけを引く
      const [items, posts] = await Promise.all([
        social.fetchMyItemLikes(me.id),
        board.myLikedPostIds(me.id),
      ]);
      const next: Record<string, boolean> = {};
      items.forEach((id) => { next[itemKey(id)] = true; });
      posts.forEach((id) => { next[postKey(id)] = true; });
      setLiked(next);
    } catch {
      // 取れなくても画面は動かす（未いいね扱いになるだけ）
    }
  }, [live, me.live, me.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    (key: string, fallback = false) => {
      let next = false;
      setLiked((prev) => {
        const cur = key in prev ? prev[key] : fallback;
        next = !cur;
        return { ...prev, [key]: next };
      });

      if (live && me.live) {
        const [kind, id] = key.split(':');
        const p =
          kind === 'item'
            ? social.toggleItemLike(id, me.id, next)
            : board.togglePostLike(id, me.id, next);
        // 失敗したら見た目を元に戻す
        p.catch(() => setLiked((prev) => ({ ...prev, [key]: !next })));
      }
      return next;
    },
    [live, me.live, me.id]
  );

  const value = useMemo<LikesState>(
    () => ({
      isLiked: (key, fallback = false) => (key in liked ? liked[key] : fallback),
      toggle,
      refresh,
    }),
    [liked, toggle, refresh]
  );
  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export function useLikes(): LikesState {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error('useLikes must be used within LikesProvider');
  return ctx;
}
