import { requireSupabase } from '@/lib/supabase';
import { relativeTime, DELETED_USER_NAME, displayName } from './map';

/** 掲示板。投稿・コメント・いいね。 */

export type BoardPost = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  imageUrl: string | null;
  /** 交換報告／質問／雑談／お知らせ */
  tag: 'harvest' | 'question' | 'chat' | 'notice';
  pinned: boolean;
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
  'id, user_id, author_nickname, author_avatar_url, body, image_url, tag, pinned, ' +
  'created_at, comment_count, like_count';

function toPost(r: any, likedIds: Set<string>): BoardPost {
  return {
    id: r.id,
    userId: r.user_id,
    authorName: r.author_nickname,
    authorAvatar: r.author_avatar_url ?? '',
    body: r.body,
    imageUrl: r.image_url ?? null,
    tag: r.tag ?? 'chat',
    pinned: Boolean(r.pinned),
    createdAt: relativeTime(r.created_at),
    commentCount: Number(r.comment_count ?? 0),
    likeCount: Number(r.like_count ?? 0),
    liked: likedIds.has(r.id),
  };
}

/** 自分がいいねした投稿IDの集合（一覧の♡の状態に使う） */
export async function myLikedPostIds(userId: string | null): Promise<Set<string>> {
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

/**
 * 自分の投稿だけを取る（マイページ →「投稿履歴」）。
 * 掲示板の一覧は最新50件しか取らないので、そこから絞ると
 * 古い投稿が履歴から消える。ここで直接引く（2026-08-13 指摘）。
 */
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
  tag: BoardPost['tag'] = 'chat',
  imageUrl?: string | null
): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('board_posts')
    .insert({ user_id: userId, body: body.trim(), tag, image_url: imageUrl ?? null })
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
    authorName: displayName(r.profiles?.nickname),
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

/** いいねした投稿（マイページのいいね一覧）。押した順に並べ替えて返す */
export async function fetchPostsByIds(ids: string[], userId: string | null): Promise<BoardPost[]> {
  if (!ids.length) return [];
  const sb = requireSupabase();
  const [{ data, error }, liked] = await Promise.all([
    sb.from('board_cards').select(CARD_COLUMNS).in('id', ids),
    myLikedPostIds(userId),
  ]);
  if (error) throw error;
  const byId = new Map((data ?? []).map((r: any) => [r.id, toPost(r, liked)]));
  return ids.map((id) => byId.get(id)).filter((x): x is BoardPost => Boolean(x));
}

// ── 自分のコメント履歴 ─────────────────────────────────────

export type MyComment = {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  /** コメントした先の投稿（誰の・どんな内容か） */
  postBody: string;
  postAuthor: string;
};

/**
 * 自分が書いた掲示板コメントの履歴。
 * どの投稿へのコメントか分かるよう、投稿本文と投稿者名も一緒に引く。
 */
export async function fetchMyComments(userId: string, limit = 100): Promise<MyComment[]> {
  const { data, error } = await requireSupabase()
    .from('board_comments')
    // profiles への経路が board_posts_user_id_fkey と board_likes 経由の2通りあり、
    // どちらか決められず PostgREST が 300（PGRST201）を返していた。
    // 投稿者をたどりたいので、外部キーを名指しする（2026-08-17 指摘）
    .select('id, post_id, body, created_at, board_posts(body, profiles!board_posts_user_id_fkey(nickname))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    postId: r.post_id,
    body: r.body,
    createdAt: relativeTime(r.created_at),
    postBody: r.board_posts?.body ?? '',
    postAuthor: displayName(r.board_posts?.profiles?.nickname),
  }));
}
