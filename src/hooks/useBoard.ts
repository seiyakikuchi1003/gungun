import { useCallback, useEffect, useState } from 'react';
import { boardPosts as mockPosts, type BoardPost, type BoardTag } from '@/data/mockSocial';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useMe } from '@/store/me';
import * as api from '@/lib/api/board';

/**
 * 掲示板。
 *
 * 実DB接続時は `board_posts` / `board_comments` / `board_likes` に保存する。
 * 未接続時は従来のモック配列を返すので、プレビューの見た目は変わらない。
 *
 * 画面は BoardPost 型（mockSocial のもの）のまま使えるよう詰め替える。
 * DB 側の投稿は著者名・アバターを行に持っているので、それを添えて返す。
 */
export type UIPost = BoardPost & {
  authorName: string;
  authorAvatar: string | number;
  imageUrl?: string | null;
};

function toUIPost(p: api.BoardPost): UIPost {
  return {
    id: p.id,
    userId: p.userId,
    body: p.body,
    createdAt: p.createdAt,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    liked: p.liked,
    tag: (p.tag ?? 'chat') as BoardTag,
    pinned: p.pinned ?? false,
    authorName: p.authorName,
    authorAvatar: p.authorAvatar,
    imageUrl: p.imageUrl,
  };
}

/** モックの投稿にも著者情報を添えて、画面側の分岐を無くす */
function mockToUIPost(p: BoardPost, nameOf: (id: string) => { nickname: string; avatar: string | number }): UIPost {
  const u = nameOf(p.userId);
  return { ...p, authorName: u.nickname, authorAvatar: u.avatar, imageUrl: null };
}

export function useBoard() {
  const live = isSupabaseEnabled;
  const me = useMe();
  const [posts, setPosts] = useState<UIPost[]>([]);
  const [loading, setLoading] = useState(live);

  const load = useCallback(async () => {
    if (!live) {
      const { getUser } = await import('@/data/mock');
      setPosts(mockPosts.map((p) => mockToUIPost(p, getUser)));
      setLoading(false);
      return;
    }
    try {
      setPosts((await api.fetchPosts(me.live ? me.id : null)).map(toUIPost));
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [live, me.live, me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (body: string, tag: BoardTag, imageUrl?: string | null): Promise<{ error: string | null }> => {
      if (!live) {
        // モック：一覧の先頭に足すだけ（永続化しない）
        setPosts((list) => [
          {
            id: `p-${Date.now()}`,
            userId: me.id,
            body: body.trim(),
            createdAt: 'たった今',
            likeCount: 0,
            commentCount: 0,
            tag,
            authorName: me.nickname,
            authorAvatar: me.avatar,
            imageUrl: imageUrl ?? null,
          },
          ...list,
        ]);
        return { error: null };
      }
      if (!me.live) return { error: 'ログインしてください' };
      try {
        await api.createPost(me.id, body, tag, imageUrl ?? null);
        await load();
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : '投稿できませんでした' };
      }
    },
    [live, me.live, me.id, me.nickname, me.avatar, load]
  );

  const remove = useCallback(
    async (postId: string) => {
      setPosts((list) => list.filter((p) => p.id !== postId));
      if (live && me.live) {
        try {
          await api.deletePost(postId);
        } catch {
          await load();
        }
      }
    },
    [live, me.live, load]
  );

  return { posts, loading, reload: load, create, remove };
}

/** 投稿1件＋そのコメント */
export function useBoardPost(postId: string) {
  const live = isSupabaseEnabled;
  const me = useMe();
  const [post, setPost] = useState<UIPost | null>(null);
  const [comments, setComments] = useState<api.BoardComment[]>([]);
  const [loading, setLoading] = useState(live);

  const load = useCallback(async () => {
    if (!live) {
      const { getUser } = await import('@/data/mock');
      const p = mockPosts.find((x) => x.id === postId) ?? null;
      setPost(p ? mockToUIPost(p, getUser) : null);
      setLoading(false);
      return;
    }
    try {
      const [p, cs] = await Promise.all([
        api.fetchPost(postId, me.live ? me.id : null),
        api.fetchComments(postId),
      ]);
      setPost(p ? toUIPost(p) : null);
      setComments(cs);
    } finally {
      setLoading(false);
    }
  }, [live, postId, me.live, me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const addComment = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text) return;
      if (!live) {
        setComments((list) => [
          ...list,
          {
            id: `c-${Date.now()}`,
            postId,
            userId: me.id,
            authorName: me.nickname,
            authorAvatar: typeof me.avatar === 'string' ? me.avatar : '',
            body: text,
            createdAt: 'たった今',
          },
        ]);
        return;
      }
      if (!me.live) return;
      try {
        await api.addComment(postId, me.id, text);
        await load();
      } catch {
        // 送れなければ何もしない
      }
    },
    [live, postId, me.live, me.id, me.nickname, me.avatar, load]
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      setComments((list) => list.filter((c) => c.id !== commentId));
      if (live && me.live) {
        try {
          await api.deleteComment(commentId);
        } catch {
          await load();
        }
      }
    },
    [live, me.live, load]
  );

  return { post, comments, loading, reload: load, addComment, removeComment };
}
