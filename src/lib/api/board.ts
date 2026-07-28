import { requireSupabase } from '@/lib/supabase';
import { relativeTime } from './map';

/** 掲示板。投稿・コメント・いいね。 */

export type BoardPost = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  imageUrl: string | null;
  createdAt: string; // 「3分前」などの表示用
  commentCount: number;
  likeCount: number;
  liked: boolean;
};

export type BoardComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  createdAt: string;
};

const CARD_COLUMNS =
  'id, user_id, author_nickname, author_avatar_url, body, image_url, created_at, comment_count, like_count';

function toPost(r: any, likedIds: Set<string>): BoardPost {
  return {
    id: r.id,
    userId: r.user_id,
    authorName: r.author_nickname,
    authorAvatar: r.author_avatar_url ?? '',
    body: r.body,
    imageUrl: r.image_url ?? null,
    createdAt: relativeTime(r.created_at),
    commentCount: Number(r.comment_count ?? 0),
    likeCount: Number(r.like_count ?? 0),
    liked: likedIds.has(r.id),
  };
}

/** 自分がいいねした投稿IDの集合（一覧の♡の状態に使う） */
async function myLikedPostIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await requireSupabase().from('board_likes').select('post_id').eq('user_id', userId);
  return new Set(((data ?? []) as { post_id: string }[]).map((r) => r.post_id));
}

export async function fetchPosts(userId: string | null, limit = 50): Promise<BoardPost[]> {
  const sb = requireSupabase();
  const [{ data, error }, liked] = await Promise.all([
    sb.from('board_cards').select(CARD_COLUMNS).order('created_at', { ascending: false }).limit(limit),
    myLikedPostIds(userId),
  ]);
  if (error) throw error;
  return (data ?? []).map((r) => toPost(r, liked));
}

export async function fetchPost(id: string, userId: string | null): Promise<BoardPost | null> {
  const sb = requireSupabase();
  const [{ data, error }, liked] = await Promise.all([
    sb.from('board_cards').select(CARD_COLUMNS).eq('id', id).maybeSingle(),
    myLikedPostIds(userId),
  ]);
  if (error) throw error;
  return data ? toPost(data, liked) : null;
}

export async function fetchMyPosts(userId: string): Promise<BoardPost[]> {
  const sb = requireSupabase();
  const [{ data, error }, liked] = await Promise.all([
    sb
      .from('board_cards')
      .select(CARD_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    myLikedPostIds(userId),
  ]);
  if (error) throw error;
  return (data ?? []).map((r) => toPost(r, liked));
}

export async function createPost(
  userId: string,
  body: string,
  imageUrl?: string | null
): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('board_posts')
    .insert({ user_id: userId, body: body.trim(), image_url: imageUrl ?? null })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await requireSupabase().from('board_posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function fetchComments(postId: string): Promise<BoardComment[]> {
  const { data, error } = await requireSupabase()
    .from('board_comments')
    .select('id, post_id, user_id, body, created_at, profiles(nickname, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    postId: r.post_id,
    userId: r.user_id,
    authorName: r.profiles?.nickname ?? '',
    authorAvatar: r.profiles?.avatar_url ?? '',
    body: r.body,
    createdAt: relativeTime(r.created_at),
  }));
}

export async function addComment(postId: string, userId: string, body: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('board_comments')
    .insert({ post_id: postId, user_id: userId, body: body.trim() });
  if (error) throw error;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await requireSupabase().from('board_comments').delete().eq('id', commentId);
  if (error) throw error;
}

/** いいねの ON/OFF。結果の状態を返す */
export async function togglePostLike(postId: string, userId: string, on: boolean): Promise<void> {
  const sb = requireSupabase();
  if (on) {
    const { error } = await sb.from('board_likes').upsert({ post_id: postId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await sb
      .from('board_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}
