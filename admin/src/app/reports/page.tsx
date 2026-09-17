export const runtime = "edge";

import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Icon } from '@/components/Icon';
import { Nickname, Pager, Pill, Tabs } from '@/components/ui';
import { countOf, isConnected, rows } from '@/lib/supabase';
import { handleReport, reopenReport, type ReportAction } from '@/lib/actions';
import { redirectWithResult, safePath } from '@/lib/result';
import { jst } from '@/lib/format';
import { ACTION_LABEL, TARGET_LABEL } from '@/lib/labels';

/*
 * ★ サーバーアクションは必ずコンポーネントの外（モジュールの直下）に置くこと（2026-09-17）。
 *   コンポーネントの中で定義して画面の変数（id や戻り先）を使うと、Next.js はその値を
 *   暗号化してブラウザに渡すが、Cloudflare Pages（next-on-pages）では復号に失敗し、
 *   押した瞬間に「atob() called with invalid base64-encoded data」で落ちる。
 *   手元の next dev では再現しない。必要な値は .bind() の引数で渡す。
 */

async function actAction(here: string, reportId: string, action: ReportAction, formData: FormData) {
  'use server';
  const res = await handleReport(reportId, action, String(formData.get('note') ?? ''));
  const msg: Record<ReportAction, string> = {
    hide_content: '非表示にしました。投稿者にお知らせを送りました',
    warn_user: '警告を送りました',
    suspend_user: '利用を停止しました。投稿者にお知らせを送りました',
    none: '問題なしとして閉じました',
  };
  redirectWithResult(safePath(here, '/reports'), res, msg[action]);
}

async function reopenAction(here: string, reportId: string) {
  'use server';
  const res = await reopenReport(reportId);
  redirectWithResult(safePath(here, '/reports'), res, '未対応に戻しました（行った非表示・停止は、それぞれの画面で戻してください）');
}

export const dynamic = 'force-dynamic';

/**
 * 通報（2026-09-17 作り直し）。
 *
 * 指摘：「対応済み」が何を指すのか、対応されたユーザーがその後どうなるのか分からない。
 * 一般的なアプリと同じ仕様にしてほしい。
 *
 * これまでは通報の状態を書き換えるだけで、相手には何も起きていなかった。
 * 対応の中身を選ぶ形にし、選んだとおりに実際に効かせる：
 *
 *   非表示にする … 通報された商品・投稿・コメントを、他の人から見えなくする
 *   警告を送る   … 投稿はそのままで、本人に「運営からの警告」を届ける
 *   利用を停止   … 本人はアプリを開いても何もできなくなる
 *   問題なし     … 何もせず閉じる
 *
 * どれを選んでも、本人には何をされたかが「運営からのお知らせ」で届く（問題なしを除く）。
 */

const PAGE_SIZE = 20;

type Filter = 'open' | 'resolved' | 'dismissed' | 'all';

/** 対応の選択肢。押す前に「相手にどう届くか」が読めるように説明を添える */
const CHOICES: {
  action: ReportAction;
  label: string;
  what: string;
  cls: string;
  confirm?: string;
  forUser?: boolean;
  needsReason?: boolean;
}[] = [
  {
    action: 'hide_content',
    label: '非表示にする',
    what: '通報された内容を他の人から見えなくします。投稿者に「運営が非表示にしました」と届きます。',
    cls: 'btn-primary',
    forUser: false,
  },
  {
    action: 'warn_user',
    label: '警告を送る',
    what: '内容はそのまま。投稿者に「運営からの警告」が届きます。メモ欄の文章が本文になります。',
    cls: 'btn bg-mikan text-white hover:brightness-95',
  },
  {
    action: 'suspend_user',
    label: '利用を停止する',
    what: '投稿者はアプリを開いても何もできなくなります。メモ欄の文章が停止理由として本人に表示されます。',
    cls: 'btn bg-danger text-white hover:brightness-95',
    confirm: '投稿者の利用を停止します。本人はアプリを使えなくなります。よろしいですか？',
    needsReason: true,
  },
  {
    action: 'none',
    label: '問題なし',
    what: '何もせずに閉じます。投稿者には何も届きません。',
    cls: 'btn-ghost',
  },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; page?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const s = (['open', 'resolved', 'dismissed', 'all'].includes(sp.s ?? '') ? sp.s : 'open') as Filter;
  const page = Math.max(1, Number(sp.page) || 1);

  if (!isConnected) {
    return (
      <Shell title="通報" current="/reports">
        <NotConnected />
      </Shell>
    );
  }

  const here = `/reports${s !== 'open' ? `?s=${s}` : ''}`;

  const filterQuery = (q: any) => (s === 'all' ? q : q.eq('status', s));
  const [{ data: reportList, error: dbError }, total, cOpen, cResolved, cDismissed, cAll] = await Promise.all([
    rows<any>((db) =>
      filterQuery(db.from('reports').select('*'))
        .order('created_at', { ascending: s === 'open' })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    ),
    countOf('reports', filterQuery),
    countOf('reports', (q) => q.eq('status', 'open')),
    countOf('reports', (q) => q.eq('status', 'resolved')),
    countOf('reports', (q) => q.eq('status', 'dismissed')),
    countOf('reports'),
  ]);

  // 通報対象の中身を引く（UUID だけでは運営が判断できないため）
  // ★ null を混ぜないこと。退会済みの通報者は reporter_id が null になり、
  //   .in() にそのまま渡すとクエリ全体が失敗する（2026-08-17 に発生）
  const NONE = ['00000000-0000-0000-0000-000000000000'];
  const clean = (ids: (string | null)[]) => {
    const ok = [...new Set(ids.filter((v): v is string => !!v))];
    return ok.length ? ok : NONE;
  };
  const idsOf = (type: string) => clean(reportList.filter((r) => r.target_type === type).map((r) => r.target_id));

  const [items, posts, comments, targetUsers] = await Promise.all([
    rows<any>((db) => db.from('items').select('id, name, description, user_id, status').in('id', idsOf('item'))),
    rows<any>((db) => db.from('board_posts').select('id, body, user_id, hidden_at').in('id', idsOf('board_post'))),
    rows<any>((db) => db.from('board_comments').select('id, body, user_id, post_id, hidden_at').in('id', idsOf('board_comment'))),
    rows<any>((db) => db.from('profiles').select('id, nickname, is_suspended').in('id', idsOf('user'))),
  ]);
  const ownerIds = clean([
    ...items.data.map((x) => x.user_id),
    ...posts.data.map((x) => x.user_id),
    ...comments.data.map((x) => x.user_id),
    ...reportList.map((r) => r.reporter_id),
  ]);
  const { data: people } = await rows<any>((db) => db.from('profiles').select('id, nickname, is_suspended').in('id', ownerIds));

  const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
  const itemMap = byId(items.data);
  const postMap = byId(posts.data);
  const commentMap = byId(comments.data);
  const userMap = byId([...targetUsers.data, ...people]);

  /** 通報1件ぶんの「何が通報されたか」 */
  const describe = (r: any) => {
    const t = r.target_type as string;
    if (t === 'item') {
      const it = itemMap.get(r.target_id);
      return {
        body: it ? it.name : null,
        sub: it?.description,
        ownerId: it?.user_id ?? null,
        hidden: it?.status === 'deleted',
        link: null as string | null,
      };
    }
    if (t === 'board_post') {
      const p = postMap.get(r.target_id);
      return { body: p?.body ?? null, sub: null, ownerId: p?.user_id ?? null, hidden: !!p?.hidden_at, link: p ? `/board/${p.id}` : null };
    }
    if (t === 'board_comment') {
      const c = commentMap.get(r.target_id);
      return { body: c?.body ?? null, sub: null, ownerId: c?.user_id ?? null, hidden: !!c?.hidden_at, link: c ? `/board/${c.post_id}` : null };
    }
    const u = userMap.get(r.target_id);
    return { body: u ? (u.nickname || '名前未設定') : null, sub: null, ownerId: r.target_id, hidden: false, link: `/users/${r.target_id}` };
  };

  const tab = (key: Filter) => `/reports${key !== 'open' ? `?s=${key}` : ''}`;

  return (
    <Shell
      title="通報"
      description="利用者から届いた通報です。内容を見て「非表示にする／警告を送る／利用を停止する／問題なし」のどれかを選んでください。"
      current="/reports"
    >
      <Banner error={sp.error ?? dbError} ok={sp.ok} />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Tabs
          current={s}
          items={[
            { key: 'open', label: '未対応', href: tab('open'), count: cOpen },
            { key: 'resolved', label: '対応済み', href: tab('resolved'), count: cResolved },
            { key: 'dismissed', label: '問題なし', href: tab('dismissed'), count: cDismissed },
            { key: 'all', label: 'すべて', href: tab('all'), count: cAll },
          ]}
        />
        {s === 'open' && cOpen > 0 && <span className="text-xs text-muted">古い通報から順に並んでいます</span>}
      </div>

      {/* 対応の意味を一度だけ説明しておく（毎回読まなくていいよう畳める） */}
      <details className="card px-5 py-3.5 mb-5 text-sm group">
        <summary className="font-bold cursor-pointer list-none flex items-center gap-2">
          <Icon name="alert" className="w-4 h-4 text-muted" />
          それぞれの対応をすると、相手はどうなる？
          <span className="ml-auto text-xs text-muted group-open:hidden">開く</span>
        </summary>
        <ul className="mt-3 space-y-2">
          {CHOICES.map((c) => (
            <li key={c.action} className="flex gap-3">
              <span className="w-28 shrink-0 font-bold">{c.label}</span>
              <span className="text-muted">{c.what}</span>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-col gap-4">
        {reportList.map((r) => {
          const d = describe(r);
          const owner = d.ownerId ? userMap.get(d.ownerId) : null;
          const reporter = r.reporter_id ? userMap.get(r.reporter_id) : null;
          const open = r.status === 'open';
          return (
            <article key={r.id} className={`card overflow-hidden ${open ? 'border-l-4 border-l-danger' : ''}`}>
              <div className="p-5">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Pill tone="gray">{TARGET_LABEL[r.target_type] ?? r.target_type}</Pill>
                  {open ? (
                    <Pill tone="danger">未対応</Pill>
                  ) : (
                    <Pill tone={r.status === 'resolved' ? 'green' : 'gray'}>
                      {ACTION_LABEL[r.action_taken] ?? (r.status === 'resolved' ? '対応済み' : '問題なし')}
                    </Pill>
                  )}
                  {d.hidden && <Pill tone="danger">いま非表示</Pill>}
                  {owner?.is_suspended && <Pill tone="danger">投稿者は停止中</Pill>}
                  <span className="text-xs text-muted ml-auto">{jst(r.created_at)} に通報</span>
                </div>

                {/* 通報された中身。判断に必要なのはまずこれ */}
                <div className="rounded-lg bg-cream/70 border border-line px-4 py-3 mb-3">
                  {d.body ? (
                    <>
                      <p className="text-sm whitespace-pre-wrap break-words line-clamp-6">{d.body}</p>
                      {d.sub && <p className="text-xs text-muted mt-1 line-clamp-2">{d.sub}</p>}
                    </>
                  ) : (
                    <p className="text-sm text-muted">この内容は削除されたか、見つかりませんでした。</p>
                  )}
                  {d.link && (
                    <Link href={d.link} className="inline-flex items-center gap-1 text-xs font-bold text-green mt-2">
                      {r.target_type === 'user' ? 'この人の詳細を見る' : '前後の流れを見る'} <Icon name="chevron-right" className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                <dl className="grid sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted font-bold">通報の理由</dt>
                    <dd className="font-bold mt-0.5">{r.reason || <span className="text-muted font-normal">記載なし</span>}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted font-bold">{r.target_type === 'user' ? '通報された人' : '投稿した人'}</dt>
                    <dd className="mt-0.5">
                      {d.ownerId ? (
                        <Link href={`/users/${d.ownerId}`} className="font-bold hover:text-green">
                          <Nickname name={owner?.nickname} />
                        </Link>
                      ) : (
                        <span className="text-muted">不明</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted font-bold">通報した人</dt>
                    <dd className="mt-0.5">
                      {r.reporter_id ? (
                        <Link href={`/users/${r.reporter_id}`} className="hover:text-green">
                          <Nickname name={reporter?.nickname} />
                        </Link>
                      ) : (
                        <span className="text-muted">退会したユーザー</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {open ? (
                <form className="border-t border-line bg-white px-5 py-4">
                  <label className="text-xs font-bold text-muted block mb-1.5">
                    メモ（警告の本文・停止の理由として本人に届きます。問題なしの場合は運営用の記録）
                  </label>
                  <textarea name="note" rows={2} className="textarea mb-3" placeholder="例：他の利用者を中傷する内容のため" />
                  <div className="flex flex-wrap gap-2">
                    {CHOICES.filter((c) => !(c.forUser === false && r.target_type === 'user')).map((c) =>
                      c.confirm ? (
                        <ConfirmButton
                          key={c.action}
                          formAction={actAction.bind(null, here, r.id, c.action)}
                          message={c.confirm}
                          className={c.cls}
                          title={c.what}
                        >
                          {c.label}
                        </ConfirmButton>
                      ) : (
                        <button key={c.action} formAction={actAction.bind(null, here, r.id, c.action)} className={c.cls} title={c.what}>
                          {c.label}
                        </button>
                      )
                    )}
                  </div>
                </form>
              ) : (
                <div className="border-t border-line bg-white px-5 py-3 flex items-center gap-3 flex-wrap text-sm">
                  <span className="text-xs text-muted">{jst(r.handled_at)} に対応</span>
                  {r.handled_note && <span className="text-xs">メモ：{r.handled_note}</span>}
                  <form action={reopenAction.bind(null, here, r.id)} className="ml-auto">
                    <button className="btn-ghost h-8 px-3">未対応に戻す</button>
                  </form>
                </div>
              )}
            </article>
          );
        })}

        {reportList.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-soft text-green grid place-items-center mx-auto mb-3">
              <Icon name="check" className="w-6 h-6" />
            </div>
            <p className="font-bold">{s === 'open' ? '未対応の通報はありません' : 'ここに表示する通報はありません'}</p>
          </div>
        )}
      </div>

      <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/reports?${new URLSearchParams({ ...(s !== 'open' ? { s } : {}), page: String(p) })}`} />
    </Shell>
  );
}
