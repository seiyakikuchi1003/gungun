export const runtime = "edge";

import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { isConnected, rows } from '@/lib/supabase';
import { grantFertilizer, setSuspended } from '@/lib/actions';
import { redirectWithResult } from '@/lib/result';
import Link from 'next/link';
import { jst, num, shortId } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function suspendAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const to = formData.get('to') === '1';
  const res = await setSuspended(id, to, String(formData.get('reason') ?? ''));
  redirectWithResult('/users', res, to ? '停止しました' : '停止を解除しました');
}

async function fertilizerAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const res = await grantFertilizer(id, Number(formData.get('amount')));
  redirectWithResult('/users', res, '肥料を更新しました');
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; edit?: string; error?: string; ok?: string }>;
}) {
  const { q = '', f = 'all', edit, error, ok } = await searchParams;

  if (!isConnected) {
    return (
      <Shell title="ユーザー">
        <NotConnected />
      </Shell>
    );
  }

  const { data: users, error: dbError } = await rows((db) => {
    let query = db.from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
    if (q) query = query.ilike('nickname', `%${q}%`);
    if (f === 'suspended') query = query.eq('is_suspended', true);
    if (f === 'premium') query = query.eq('is_premium', true);
    return query;
  });

  const FILTERS = [
    { key: 'all', label: 'すべて' },
    { key: 'premium', label: 'プレミアム' },
    { key: 'suspended', label: '停止中' },
  ];
  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(f !== 'all' ? { f } : {}), ...extra });
    const qs = p.toString();
    return `/users${qs ? `?${qs}` : ''}`;
  };

  return (
    <Shell title="ユーザー">
      <Banner error={error ?? dbError} ok={ok} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <form className="flex gap-2 grow max-w-md">
          <input name="q" defaultValue={q} placeholder="ニックネームで検索" className="input" />
          {f !== 'all' && <input type="hidden" name="f" value={f} />}
          <button className="btn-primary shrink-0">検索</button>
        </form>
        <div className="flex gap-1">
          {FILTERS.map((t) => (
            <Link
              key={t.key}
              href={keep(t.key === 'all' ? {} : { f: t.key })}
              className={`btn h-8 px-3 ${f === t.key ? 'bg-green text-white' : 'border border-line text-muted'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <span className="text-xs text-muted ml-auto">{num(users.length)} 人</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr>
              <th className="th">ニックネーム</th>
              <th className="th">肥料</th>
              <th className="th">プレミアム</th>
              <th className="th">状態</th>
              <th className="th">登録日</th>
              <th className="th">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td className="td font-bold">
                  {u.nickname?.trim() || <span className="text-muted font-normal">名前未設定</span>}
                  <div className="text-[11px] font-mono font-normal text-muted">{shortId(u.id)}</div>
                  {u.suspended_reason ? (
                    <div className="text-xs font-normal text-muted">理由: {u.suspended_reason}</div>
                  ) : null}
                </td>
                <td className="td">{num(u.fertilizer)}</td>
                <td className="td">{u.is_premium ? <span className="text-mikan font-bold">加入中</span> : '—'}</td>
                <td className="td">
                  {u.is_suspended ? <span className="text-danger font-bold">停止中</span> : '通常'}
                </td>
                <td className="td text-muted text-xs whitespace-nowrap">{jst(u.created_at)}</td>
                <td className="td">
                  {/* 停止や肥料付与を全行に出しておくと、押し間違いが起きるうえ表も読みにくい。
                      必要な行だけ開く（2026-08-17 指摘） */}
                  {edit === u.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={fertilizerAction} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          name="amount"
                          type="number"
                          defaultValue={100}
                          className="input w-24 h-8"
                          aria-label="肥料の増減"
                        />
                        <button className="btn-ghost h-8 px-3 whitespace-nowrap">肥料を足す</button>
                      </form>
                      <form action={suspendAction} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="to" value={u.is_suspended ? '0' : '1'} />
                        {!u.is_suspended && (
                          <input name="reason" placeholder="停止理由（本人に表示）" className="input w-44 h-8" />
                        )}
                        <button className={`h-8 px-3 btn whitespace-nowrap ${u.is_suspended ? 'btn-ghost' : 'bg-danger text-white'}`}>
                          {u.is_suspended ? '停止を解除' : '利用を停止'}
                        </button>
                      </form>
                      <Link href={keep({})} className="text-xs text-muted underline">閉じる</Link>
                    </div>
                  ) : (
                    <Link href={keep({ edit: u.id })} className="btn-ghost h-8 px-3 inline-flex items-center">
                      操作する
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={6}>
                  該当するユーザーがいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
