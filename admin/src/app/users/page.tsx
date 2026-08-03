export const runtime = "edge";

import { redirect } from 'next/navigation';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { isConnected, rows } from '@/lib/supabase';
import { grantFertilizer, setSuspended } from '@/lib/actions';
import { jst, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function suspendAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const to = formData.get('to') === '1';
  const res = await setSuspended(id, to, String(formData.get('reason') ?? ''));
  redirect(res.error ? `/users?error=${encodeURIComponent(res.error)}` : `/users?ok=${to ? '停止しました' : '停止を解除しました'}`);
}

async function fertilizerAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const res = await grantFertilizer(id, Number(formData.get('amount')));
  redirect(res.error ? `/users?error=${encodeURIComponent(res.error)}` : '/users?ok=肥料を更新しました');
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; ok?: string }>;
}) {
  const { q = '', error, ok } = await searchParams;

  if (!isConnected) {
    return (
      <Shell title="ユーザー">
        <NotConnected />
      </Shell>
    );
  }

  const { data: users, error: dbError } = await rows((db) => {
    let query = db.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
    if (q) query = query.ilike('nickname', `%${q}%`);
    return query;
  });

  return (
    <Shell title="ユーザー">
      <Banner error={error ?? dbError} ok={ok} />

      <form className="flex gap-2 mb-4 max-w-md">
        <input name="q" defaultValue={q} placeholder="ニックネームで検索" className="input" />
        <button className="btn-primary shrink-0">検索</button>
      </form>

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
                  {u.nickname}
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
                      <button className="btn-ghost h-8 px-3">肥料付与</button>
                    </form>
                    <form action={suspendAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="to" value={u.is_suspended ? '0' : '1'} />
                      {!u.is_suspended && (
                        <input name="reason" placeholder="停止理由" className="input w-32 h-8" />
                      )}
                      <button className={`h-8 px-3 btn ${u.is_suspended ? 'btn-ghost' : 'bg-danger text-white'}`}>
                        {u.is_suspended ? '解除' : '停止'}
                      </button>
                    </form>
                  </div>
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
