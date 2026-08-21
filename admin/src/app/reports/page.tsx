export const runtime = "edge";

import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { isConnected, rows } from '@/lib/supabase';
import { setReportStatus } from '@/lib/actions';
import { redirectWithResult } from '@/lib/result';
import { jst, shortId } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'open', label: '未対応' },
  { key: 'resolved', label: '対応済み' },
  { key: 'dismissed', label: '却下' },
  { key: 'all', label: 'すべて' },
];

const TARGET_LABEL: Record<string, string> = {
  item: '商品',
  board_post: '掲示板の投稿',
  board_comment: '掲示板のコメント',
  user: 'ユーザー',
};

async function statusAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const status = String(formData.get('status')) as 'open' | 'resolved' | 'dismissed';
  const res = await setReportStatus(id, status, String(formData.get('note') ?? ''));
  redirectWithResult('/reports', res, '通報を更新しました');
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; error?: string; ok?: string }>;
}) {
  const { s = 'open', error, ok } = await searchParams;

  if (!isConnected) {
    return (
      <Shell title="通報" current="/reports">
        <NotConnected />
      </Shell>
    );
  }

  const { data: reportList, error: dbError } = await rows<any>((db) => {
    let query = db.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
    if (s !== 'all') query = query.eq('status', s);
    return query;
  });

  // 通報対象の名前を引く（UUID だけでは運営が判断できないため）
  //
  // ★ null を混ぜないこと。退会済みの通報者は reporter_id が null になり、
  //   それを .in() にそのまま渡すとクエリ全体が失敗して、
  //   すべての通報者名が UUID 表示に戻ってしまう（2026-08-17 に発生）
  const NONE = ['00000000-0000-0000-0000-000000000000'];
  const clean = (ids: (string | null)[]) => {
    const ok = [...new Set(ids.filter((v): v is string => !!v))];
    return ok.length ? ok : NONE;
  };
  const idsOf = (type: string) =>
    clean(reportList.filter((r) => r.target_type === type).map((r) => r.target_id));
  const reporterIds = clean(reportList.map((r) => r.reporter_id));

  const [items, posts, comments, targetUsers, reporterList] = await Promise.all([
    rows<any>((db) => db.from('items').select('id, name, user_id, status').in('id', idsOf('item'))),
    rows<any>((db) => db.from('board_posts').select('id, body, user_id').in('id', idsOf('board_post'))),
    rows<any>((db) => db.from('board_comments').select('id, body, user_id').in('id', idsOf('board_comment'))),
    rows<any>((db) => db.from('profiles').select('id, nickname').in('id', idsOf('user'))),
    rows<any>((db) => db.from('profiles').select('id, nickname').in('id', reporterIds)),
  ]);

  /** 通報対象の中身。運営が読んで判断できるだけの情報を持たせる */
  type Target = { title: string; body?: string; ownerId?: string; note?: string };
  const targets = new Map<string, Target>();
  items.data.forEach((i) =>
    targets.set(i.id, {
      title: i.name,
      ownerId: i.user_id,
      note: i.status === 'deleted' ? '削除済み' : undefined,
    })
  );
  posts.data.forEach((p) => targets.set(p.id, { title: '掲示板の投稿', body: p.body, ownerId: p.user_id }));
  comments.data.forEach((c) => targets.set(c.id, { title: 'コメント', body: c.body, ownerId: c.user_id }));
  targetUsers.data.forEach((u) => targets.set(u.id, { title: u.nickname }));

  const reporters = new Map<string, string>();
  reporterList.data.forEach((u) => reporters.set(u.id, u.nickname));

  // 投稿者・出品者の名前も引く（誰の投稿への通報なのかが分からないと処理できない）
  const ownerIds = clean([...targets.values()].map((t) => t.ownerId ?? null));
  const owners = new Map<string, string>();
  (await rows<any>((db) => db.from('profiles').select('id, nickname').in('id', ownerIds))).data.forEach((u) =>
    owners.set(u.id, u.nickname)
  );

  // 同じ相手が繰り返し通報されているかは、対応の重さを決める材料になる
  const repeat = new Map<string, number>();
  reportList.forEach((r) => repeat.set(r.target_id, (repeat.get(r.target_id) ?? 0) + 1));

  return (
    <Shell
      title="通報"
      description="利用者から報告された出品・投稿・ユーザーです。内容を見て、対応済みか問題なしかを記録します。"
      current="/reports"
    >
      <Banner error={error ?? dbError} ok={ok} />

      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/reports?s=${t.key}`}
            className={`btn h-8 px-3 ${s === t.key ? 'bg-green text-white' : 'border border-line text-muted'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {reportList.map((r) => {
          const t = targets.get(r.target_id);
          const owner = t?.ownerId ? owners.get(t.ownerId) : null;
          const count = repeat.get(r.target_id) ?? 1;
          return (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cream text-muted">
                  {TARGET_LABEL[r.target_type] ?? r.target_type}
                </span>
                {count > 1 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-mikan-soft text-mikan">
                    同じ対象に {count} 件
                  </span>
                )}
                {t?.note && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cream text-muted">
                    {t.note}
                  </span>
                )}
                <span className="text-xs text-muted ml-auto">{jst(r.created_at)}</span>
              </div>

              {/* 通報された中身。ここが読めないと運営は判断できない */}
              <div className="rounded-xl bg-cream/60 border border-line p-3 mb-3">
                <div className="text-sm font-black mb-1">
                  {t?.title ?? shortId(r.target_id)}
                  {owner && <span className="ml-2 text-xs font-bold text-muted">{owner}さん</span>}
                </div>
                {t?.body ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{t.body}</p>
                ) : (
                  <p className="text-xs text-muted">
                    {t ? '本文のない対象です。' : 'この対象は削除されたか、見つかりませんでした。'}
                  </p>
                )}
              </div>

              <dl className="text-xs mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted">通報理由</dt>
                <dd className="font-bold">{r.reason || '（記載なし）'}</dd>
                <dt className="text-muted">通報者</dt>
                <dd>{r.reporter_id ? (reporters.get(r.reporter_id) ?? shortId(r.reporter_id)) : '退会したユーザー'}</dd>
                {r.handled_note ? (
                  <>
                    <dt className="text-muted">対応メモ</dt>
                    <dd>{r.handled_note}</dd>
                  </>
                ) : null}
              </dl>

              {r.status === 'open' ? (
                <form action={statusAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" placeholder="対応メモ（任意・記録に残ります）" className="input flex-1 min-w-[200px] h-9" />
                  <button name="status" value="resolved" className="btn-primary h-9">
                    対応済みにする
                  </button>
                  <button name="status" value="dismissed" className="btn-ghost h-9">
                    問題なし
                  </button>
                </form>
              ) : (
                <form action={statusAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <span className={`text-xs font-bold ${r.status === 'resolved' ? 'text-green-deep' : 'text-muted'}`}>
                    {r.status === 'resolved' ? '対応済み' : '問題なしとして処理'} ／ {jst(r.handled_at)}
                  </span>
                  <button name="status" value="open" className="btn-ghost h-8 px-3 ml-auto">
                    未対応に戻す
                  </button>
                </form>
              )}
            </div>
          );
        })}

        {reportList.length === 0 && (
          <div className="card p-6 text-sm text-muted">
            {s === 'open' ? '未対応の通報はありません。' : '該当する通報はありません。'}
          </div>
        )}
      </div>
    </Shell>
  );
}
