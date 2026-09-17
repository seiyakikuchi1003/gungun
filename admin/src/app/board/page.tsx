export const runtime = "edge";

import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { Icon } from '@/components/Icon';
import { Nickname, Pager, Pill, SearchBox, Tabs } from '@/components/ui';
import { countOf, isConnected, rows } from '@/lib/supabase';
import { setContentHidden } from '@/lib/actions';
import { redirectWithResult, safePath } from '@/lib/result';
import { jst } from '@/lib/format';

/*
 * ★ サーバーアクションは必ずコンポーネントの外（モジュールの直下）に置くこと（2026-09-17）。
 *   コンポーネントの中で定義して画面の変数（id や戻り先）を使うと、Next.js はその値を
 *   暗号化してブラウザに渡すが、Cloudflare Pages（next-on-pages）では復号に失敗し、
 *   押した瞬間に「atob() called with invalid base64-encoded data」で落ちる。
 *   手元の next dev では再現しない。必要な値は .bind() の引数で渡す。
 */

async function hideAction(here: string, id: string, hidden: boolean) {
  'use server';
  const res = await setContentHidden('board_posts', id, hidden);
  redirectWithResult(safePath(here, '/board'), res, hidden ? '投稿を非表示にしました。投稿者にお知らせを送りました' : '投稿を再表示しました');
}

export const dynamic = 'force-dynamic';

/**
 * 掲示板（2026-09-17 新設）。
 *
 * 指摘（T-6）：掲示板を確認・管理できる場所が無い。しっかり作り込んでほしい。
 * これまで管理画面で分かるのは投稿の件数と、通報された投稿だけだった。
 *
 * 投稿を新しい順に並べ、コメント数・いいね数・通報の有無を一目で見られるようにする。
 * 投稿を開くとコメントまで読め、投稿もコメントも1件ずつ非表示にできる。
 */

const PAGE_SIZE = 30;

const TAG_LABEL: Record<string, string> = {
  harvest: '収穫報告',
  question: '質問',
  chat: '雑談',
  notice: 'お知らせ',
};

type Filter = 'all' | 'visible' | 'hidden' | 'reported';

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; page?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const f = (['all', 'visible', 'hidden', 'reported'].includes(sp.f ?? '') ? sp.f : 'all') as Filter;
  const page = Math.max(1, Number(sp.page) || 1);

  if (!isConnected) {
    return (
      <Shell title="掲示板" current="/board">
        <NotConnected />
      </Shell>
    );
  }

  const here = `/board?${new URLSearchParams({ ...(q ? { q } : {}), ...(f !== 'all' ? { f } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`;

  // 通報されたことのある投稿のID
  const { data: reported } = await rows<any>((db) =>
    db.from('reports').select('target_id, status').eq('target_type', 'board_post').limit(1000)
  );
  const reportedIds = [...new Set(reported.map((r) => r.target_id as string))];
  const openReported = new Set(reported.filter((r) => r.status === 'open').map((r) => r.target_id as string));

  const apply = (query: any, filter: Filter) => {
    if (q) query = query.ilike('body', `%${q.replace(/[%]/g, '')}%`);
    if (filter === 'visible') query = query.is('hidden_at', null);
    if (filter === 'hidden') query = query.not('hidden_at', 'is', null);
    if (filter === 'reported') query = query.in('id', reportedIds.length ? reportedIds : ['00000000-0000-0000-0000-000000000000']);
    return query;
  };

  const [{ data: posts, error: dbError }, total, cAll, cVisible, cHidden, cReported] = await Promise.all([
    rows<any>((db) =>
      apply(db.from('board_posts').select('id, user_id, body, image_url, tag, pinned, hidden_at, hidden_reason, created_at'), f)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    ),
    countOf('board_posts', (x) => apply(x, f)),
    countOf('board_posts', (x) => apply(x, 'all')),
    countOf('board_posts', (x) => apply(x, 'visible')),
    countOf('board_posts', (x) => apply(x, 'hidden')),
    countOf('board_posts', (x) => apply(x, 'reported')),
  ]);

  const postIds = posts.length ? posts.map((p) => p.id) : ['00000000-0000-0000-0000-000000000000'];
  const authorIds = posts.length ? [...new Set(posts.map((p) => p.user_id))] : ['00000000-0000-0000-0000-000000000000'];
  const [{ data: comments }, { data: likes }, { data: authors }] = await Promise.all([
    rows<any>((db) => db.from('board_comments').select('post_id').in('post_id', postIds)),
    rows<any>((db) => db.from('board_likes').select('post_id').in('post_id', postIds)),
    rows<any>((db) => db.from('profiles').select('id, nickname, avatar_url, is_suspended').in('id', authorIds)),
  ]);
  const countBy = (arr: any[]) => arr.reduce<Record<string, number>>((m, x) => ((m[x.post_id] = (m[x.post_id] ?? 0) + 1), m), {});
  const commentCount = countBy(comments);
  const likeCount = countBy(likes);
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, f: f !== 'all' ? f : undefined, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/board${s ? `?${s}` : ''}`;
  };

  return (
    <Shell
      title="掲示板"
      description="利用者の投稿とコメントです。投稿を押すとコメントまで読めます。不適切なものは非表示にできます（投稿者にお知らせが届きます）。"
      current="/board"
    >
      <Banner error={sp.error ?? dbError} ok={sp.ok} />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Tabs
          current={f}
          items={[
            { key: 'all', label: 'すべて', href: href({ f: undefined }), count: cAll },
            { key: 'visible', label: '表示中', href: href({ f: 'visible' }), count: cVisible },
            { key: 'reported', label: '通報あり', href: href({ f: 'reported' }), count: cReported },
            { key: 'hidden', label: '非表示', href: href({ f: 'hidden' }), count: cHidden },
          ]}
        />
        <SearchBox q={q} placeholder="投稿の本文で探す" keep={f !== 'all' ? { f } : undefined} />
      </div>

      <div className="flex flex-col gap-3">
        {posts.map((p) => {
          const a = authorMap.get(p.user_id);
          const hidden = !!p.hidden_at;
          return (
            <article key={p.id} className={`card p-4 flex gap-4 ${hidden ? 'opacity-75' : ''}`}>
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="w-20 h-20 rounded-lg object-cover bg-cream shrink-0 hidden sm:block" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Link href={`/users/${p.user_id}`} className="text-sm font-bold hover:text-green">
                    <Nickname name={a?.nickname} />
                  </Link>
                  {a?.is_suspended && <Pill tone="danger">停止中</Pill>}
                  {p.tag && <Pill tone="green">{TAG_LABEL[p.tag] ?? p.tag}</Pill>}
                  {p.pinned && <Pill tone="mikan">固定</Pill>}
                  {hidden && <Pill tone="danger">非表示</Pill>}
                  {openReported.has(p.id) && <Pill tone="danger">未対応の通報</Pill>}
                  <span className="text-xs text-muted ml-auto">{jst(p.created_at)}</span>
                </div>
                <Link href={`/board/${p.id}`} className="block text-sm leading-relaxed whitespace-pre-wrap break-words line-clamp-3 hover:text-green">
                  {p.body}
                </Link>
                <div className="flex items-center gap-4 mt-2.5 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><Icon name="chat" className="w-3.5 h-3.5" />コメント {commentCount[p.id] ?? 0}</span>
                  <span className="inline-flex items-center gap-1"><Icon name="heart" className="w-3.5 h-3.5" />いいね {likeCount[p.id] ?? 0}</span>
                  <Link href={`/board/${p.id}`} className="font-bold text-green ml-auto">開く</Link>
                  <form action={hideAction.bind(null, here, p.id, !hidden)}>
                    <button className={`inline-flex items-center gap-1 font-bold ${hidden ? 'text-green' : 'text-danger'}`}>
                      <Icon name={hidden ? 'eye' : 'eye-off'} className="w-3.5 h-3.5" />
                      {hidden ? '再表示する' : '非表示にする'}
                    </button>
                  </form>
                </div>
                {hidden && p.hidden_reason && <p className="text-xs text-danger mt-1.5">非表示の理由：{p.hidden_reason}</p>}
              </div>
            </article>
          );
        })}

        {posts.length === 0 && (
          <div className="card p-12 text-center text-sm text-muted">
            {q ? `「${q}」を含む投稿はありません` : 'ここに表示する投稿はありません'}
          </div>
        )}
      </div>

      <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(pg) => href({ page: String(pg) })} />
    </Shell>
  );
}
