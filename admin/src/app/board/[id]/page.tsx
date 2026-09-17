export const runtime = "edge";

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { Icon } from '@/components/Icon';
import { Nickname, Pill, Section } from '@/components/ui';
import { admin, isConnected, rows } from '@/lib/supabase';
import { setContentHidden } from '@/lib/actions';
import { redirectWithResult } from '@/lib/result';
import { jst } from '@/lib/format';
import { ACTION_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/**
 * 掲示板の投稿1件（2026-09-17 新設）。
 *
 * 投稿の本文・写真・コメントを、利用者が見ているのと同じ並びで読めるようにする。
 * 通報の前後関係（どんなやり取りの中で出た言葉か）を確かめてから判断できるように。
 * 投稿もコメントも、ここから1件ずつ非表示／再表示できる。
 */

export default async function BoardPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { error, ok } = await searchParams;

  if (!isConnected) {
    return (
      <Shell title="掲示板" current="/board">
        <NotConnected />
      </Shell>
    );
  }

  const { data: post } = await admin()
    .from('board_posts')
    .select('id, user_id, body, image_url, tag, pinned, hidden_at, hidden_reason, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!post) notFound();

  const back = `/board/${id}`;

  async function hidePost(hidden: boolean, formData: FormData) {
    'use server';
    const res = await setContentHidden('board_posts', id, hidden, String(formData.get('reason') ?? ''));
    redirectWithResult(back, res, hidden ? '投稿を非表示にしました。投稿者にお知らせを送りました' : '投稿を再表示しました');
  }
  async function hideComment(commentId: string, hidden: boolean) {
    'use server';
    const res = await setContentHidden('board_comments', commentId, hidden);
    redirectWithResult(back, res, hidden ? 'コメントを非表示にしました。書いた人にお知らせを送りました' : 'コメントを再表示しました');
  }

  const [{ data: comments }, likes, { data: reports }] = await Promise.all([
    rows<any>((db) =>
      db.from('board_comments').select('id, user_id, body, hidden_at, created_at').eq('post_id', id).order('created_at', { ascending: true })
    ),
    admin().from('board_likes').select('*', { count: 'exact', head: true }).eq('post_id', id),
    rows<any>((db) =>
      db.from('reports').select('id, target_type, target_id, reason, status, action_taken, created_at')
        .or(`and(target_type.eq.board_post,target_id.eq.${id})`)
        .order('created_at', { ascending: false })
    ),
  ]);

  const commentIds = comments.map((c) => c.id);
  const { data: commentReports } = commentIds.length
    ? await rows<any>((db) => db.from('reports').select('target_id, status').eq('target_type', 'board_comment').in('target_id', commentIds))
    : { data: [] as any[] };
  const reportedComment = new Set(commentReports.filter((r) => r.status === 'open').map((r) => r.target_id));

  const peopleIds = [...new Set([post.user_id, ...comments.map((c) => c.user_id)])];
  const { data: people } = await rows<any>((db) => db.from('profiles').select('id, nickname, avatar_url, is_suspended').in('id', peopleIds));
  const who = new Map(people.map((p) => [p.id, p]));
  const author = who.get(post.user_id);
  const hidden = !!post.hidden_at;

  return (
    <Shell
      title="掲示板の投稿"
      current="/board"
      back={{ href: '/board', label: '掲示板の一覧へ戻る' }}
      actions={
        <div className="flex gap-1.5">
          {hidden ? <Pill tone="danger">非表示中</Pill> : <Pill tone="green">表示中</Pill>}
          {reports.some((r) => r.status === 'open') && <Pill tone="danger">未対応の通報</Pill>}
        </div>
      }
    >
      <Banner error={error} ok={ok} />

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <article className={`card p-5 ${hidden ? 'border-l-4 border-l-danger' : ''}`}>
            <div className="flex items-center gap-3 mb-3">
              <Avatar url={author?.avatar_url} name={author?.nickname} />
              <div className="min-w-0">
                <Link href={`/users/${post.user_id}`} className="font-bold hover:text-green">
                  <Nickname name={author?.nickname} />
                </Link>
                <div className="text-xs text-muted">{jst(post.created_at)}</div>
              </div>
              {author?.is_suspended && <span className="ml-auto"><Pill tone="danger">投稿者は停止中</Pill></span>}
            </div>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{post.body}</p>
            {post.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.image_url} alt="" className="mt-3 rounded-xl max-h-80 object-contain bg-cream" />
            )}
            <div className="flex items-center gap-4 mt-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><Icon name="chat" className="w-3.5 h-3.5" />コメント {comments.length}</span>
              <span className="inline-flex items-center gap-1"><Icon name="heart" className="w-3.5 h-3.5" />いいね {likes.count ?? 0}</span>
            </div>
            {hidden && post.hidden_reason && (
              <p className="text-xs text-danger mt-3">非表示の理由：{post.hidden_reason}</p>
            )}
          </article>

          <Section title={`コメント（${comments.length}件）`} note="古い順。非表示にしたコメントは利用者からは見えません" flush>
            <ul className="divide-y divide-line/70">
              {comments.map((c) => {
                const p = who.get(c.user_id);
                const ch = !!c.hidden_at;
                return (
                  <li key={c.id} className={`px-5 py-3.5 flex gap-3 ${ch ? 'bg-danger/[0.03]' : ''}`}>
                    <Avatar url={p?.avatar_url} name={p?.nickname} small />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/users/${c.user_id}`} className="text-sm font-bold hover:text-green">
                          <Nickname name={p?.nickname} />
                        </Link>
                        {ch && <Pill tone="danger">非表示</Pill>}
                        {reportedComment.has(c.id) && <Pill tone="danger">未対応の通報</Pill>}
                        <span className="text-xs text-muted">{jst(c.created_at)}</span>
                      </div>
                      <p className={`text-sm mt-1 whitespace-pre-wrap break-words ${ch ? 'text-muted line-through decoration-muted/40' : ''}`}>
                        {c.body}
                      </p>
                    </div>
                    <form action={hideComment.bind(null, c.id, !ch)} className="shrink-0">
                      <button className={`text-xs font-bold inline-flex items-center gap-1 ${ch ? 'text-green' : 'text-danger'}`}>
                        <Icon name={ch ? 'eye' : 'eye-off'} className="w-3.5 h-3.5" />
                        {ch ? '再表示' : '非表示'}
                      </button>
                    </form>
                  </li>
                );
              })}
              {comments.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">コメントはありません</li>}
            </ul>
          </Section>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <Section title={hidden ? '再表示する' : '非表示にする'}>
            {hidden ? (
              <form action={hidePost.bind(null, false)} className="flex flex-col gap-2">
                <p className="text-sm text-muted">利用者から再び見えるようになります。</p>
                <button className="btn-primary">
                  <Icon name="eye" className="w-4 h-4" />
                  再表示する
                </button>
              </form>
            ) : (
              <form action={hidePost.bind(null, true)} className="flex flex-col gap-2">
                <textarea name="reason" rows={2} className="textarea" placeholder="理由（任意・投稿者へのお知らせに入ります）" />
                <p className="text-[11.5px] text-muted leading-relaxed">
                  投稿とコメントは利用者から見えなくなります。本文は消さずに残るので、あとから再表示できます。
                </p>
                <button className="btn bg-danger text-white hover:brightness-95">
                  <Icon name="eye-off" className="w-4 h-4" />
                  非表示にする
                </button>
              </form>
            )}
          </Section>

          <Section title="この投稿への通報" flush>
            <ul className="divide-y divide-line/70">
              {reports.map((r) => (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {r.status === 'open' ? <Pill tone="danger">未対応</Pill> : <Pill tone="gray">{ACTION_LABEL[r.action_taken] ?? '対応済み'}</Pill>}
                    <span className="text-xs text-muted ml-auto">{jst(r.created_at)}</span>
                  </div>
                  <p className="mt-1">{r.reason || <span className="text-muted">理由の記載なし</span>}</p>
                </li>
              ))}
              {reports.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">通報はありません</li>}
            </ul>
            {reports.some((r) => r.status === 'open') && (
              <div className="px-5 py-3 border-t border-line">
                <Link href="/reports" className="text-xs font-bold text-green">通報の画面で対応する →</Link>
              </div>
            )}
          </Section>
        </div>
      </div>
    </Shell>
  );
}

function Avatar({ url, name, small }: { url?: string | null; name?: string | null; small?: boolean }) {
  const size = small ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${size} rounded-full object-cover bg-cream shrink-0`} />
  ) : (
    <span className={`${size} rounded-full bg-cream grid place-items-center text-muted font-black shrink-0`}>
      {(name?.trim() || '?').slice(0, 1)}
    </span>
  );
}
