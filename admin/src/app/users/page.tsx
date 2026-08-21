export const runtime = "edge";

import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { isConnected, rows } from '@/lib/supabase';
import { grantFertilizer, setSuspended } from '@/lib/actions';
import { redirectWithResult } from '@/lib/result';
import Link from 'next/link';
import { jst, num } from '@/lib/format';
import { ConfirmButton } from '@/components/ConfirmButton';

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
      <Shell title="ユーザー" current="/users">
        <NotConnected />
      </Shell>
    );
  }

  const { data: users, error: dbError } = await rows((db) => {
    // メール・出品数・取引数まで入ったビュー（0041）。
    // 名前だけでは同じ人かどうか判断できないため
    let query = db.from('admin_user_cards').select('*').order('created_at', { ascending: false }).limit(200);
    // 名前でもメールでも探せるようにする（運営はメールで問い合わせを受けるため）
    if (q) query = query.or(`nickname.ilike.%${q}%,email.ilike.%${q}%`);
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
    <Shell
      title="ユーザー"
      description="登録している人の一覧です。肥料を足したり、規約に反する人の利用を止めたりできます。"
      current="/users"
    >
      <Banner error={error ?? dbError} ok={ok} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <form className="flex gap-2 grow max-w-md">
          <input name="q" defaultValue={q} placeholder="名前・メールアドレスで検索" className="input" />
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
              <th className="th">ユーザー</th>
              <th className="th num">肥料</th>
              <th className="th num">出品</th>
              <th className="th num">取引</th>
              <th className="th">状態</th>
              <th className="th">登録日</th>
              <th className="th">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td className="td">
                  <div className="font-bold">
                    {u.nickname?.trim() || <span className="text-muted font-normal">名前未設定</span>}
                  </div>
                  {/* 同じ名前の人を取り違えないように、連絡先のメールを添える */}
                  <div className="text-[11px] text-muted">{u.email ?? '—'}</div>
                </td>
                <td className="td num">{num(u.fertilizer)}</td>
                <td className="td num">{u.item_count ? num(u.item_count) : <span className="text-muted">0</span>}</td>
                <td className="td num">{u.trade_count ? num(u.trade_count) : <span className="text-muted">0</span>}</td>
                <td className="td">
                  {/* 何もなければ空にする。印がついている行だけが目に入るようにしたい */}
                  <div className="flex flex-wrap gap-1">
                    {u.is_suspended && <span className="pill pill-danger">停止中</span>}
                    {u.is_premium && <span className="pill pill-mikan">プレミアム</span>}
                    {u.reported_count > 0 && <span className="pill pill-gray">通報{num(u.reported_count)}</span>}
                    {!u.is_suspended && !u.is_premium && !u.reported_count && (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </div>
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
                        <ConfirmButton
                          message={
                            u.is_suspended
                              ? `${u.nickname || 'このユーザー'} の利用停止を解除します。よろしいですか？`
                              : `${u.nickname || 'このユーザー'} の利用を停止します。ログインできなくなります。よろしいですか？`
                          }
                          className={`h-8 px-3 btn whitespace-nowrap ${u.is_suspended ? 'btn-ghost' : 'bg-danger text-white'}`}
                        >
                          {u.is_suspended ? '停止を解除' : '利用を停止'}
                        </ConfirmButton>
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
                <td className="td text-muted" colSpan={7}>
                  {q ? `「${q}」にあてはまる人はいません` : '該当する人はいません'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
