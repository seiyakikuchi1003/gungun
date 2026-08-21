import { useCallback, useEffect, useState } from 'react';
import { getItemComments } from '@/data/mockSocial';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useMe } from '@/store/me';
import * as api from '@/lib/api/items';
import { useUsers } from '@/store/users';

/**
 * 商品詳細のコメント欄。
 *
 * 実DB接続時は `item_comments` に保存する（アプリを閉じても残る）。
 * 未接続時は従来どおりモックの初期コメント＋画面内の一時state。
 */
export type UIComment = {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | number;
};

export function useItemComments(itemId: string) {
  const users = useUsers();
  const live = isSupabaseEnabled;
  const me = useMe();
  const [comments, setComments] = useState<UIComment[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!live) {
      // モック：固定の初期コメントを表示名つきに詰め替える
      setComments(
        getItemComments(itemId).map((c) => {
          const u = users.user(c.userId);
          return {
            id: c.id,
            userId: c.userId,
            body: c.body,
            createdAt: c.createdAt,
            authorName: u.nickname,
            authorAvatar: u.avatar,
          };
        })
      );
      return;
    }
    try {
      const list = await api.fetchItemComments(itemId);
      setComments(
        list.map((c) => ({
          id: c.id,
          userId: c.userId,
          body: c.body,
          createdAt: c.createdAt,
          authorName: c.authorName,
          authorAvatar: c.authorAvatar,
        }))
      );
    } catch {
      setComments([]);
    }
  }, [live, itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text || busy) return;
      if (!live) {
        setComments((list) => [
          ...list,
          {
            id: `ci-${Date.now()}`,
            userId: me.id,
            body: text,
            createdAt: 'たった今',
            authorName: me.nickname,
            authorAvatar: me.avatar,
          },
        ]);
        return;
      }
      setBusy(true);
      try {
        await api.addItemComment(itemId, me.id, text);
        await load();
      } catch {
        // 送れなかったときは何も足さない（画面はそのまま）
      } finally {
        setBusy(false);
      }
    },
    [busy, live, itemId, me.id, me.nickname, me.avatar, load]
  );

  const remove = useCallback(
    async (commentId: string) => {
      setComments((list) => list.filter((c) => c.id !== commentId));
      if (live) {
        try {
          await api.deleteItemComment(commentId);
        } catch {
          await load(); // 消せなかったら元に戻す
        }
      }
    },
    [live, load]
  );

  return { comments, add, remove, busy, reload: load };
}
