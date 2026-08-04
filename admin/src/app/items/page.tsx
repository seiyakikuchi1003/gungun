export const runtime = "edge";

import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { isConnected, rows } from '@/lib/supabase';
import { restoreItem, softDeleteItem } from '@/lib/actions';
import { redirectWithResult } from '@/lib/result';
import { jst, shortId } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  growing: '育成中',
  trading: '交換中',
  completed: '完了',
  deleted: '削除済み',
};

const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'seed', label: '種のみ' },
  { key: 'growing', label: '育成中' },
  { key: 'trading', label: '交換中' },
  { key: 'deleted', label: '削除済み' },
];

async function deleteAction(formData: FormData) {
  'use server';
  const res = await softDeleteItem(String(formData.get('id')));
  redirectWithResult('/items', res, '非表示にしました');
}

async function restoreAction(formData: FormData) {
  'use server';
  const res = await restoreItem(String(formData.get('id')));
  redirectWithResult('/items', res, '復活させました');
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; error?: string; ok?: string }>;
}) {
  const { q = '', f = 'all', error, ok } = await searchParams;

  if (!isConnected) {
    return (
      <Shell title="商品">
        <NotConnected />
      </Shell>
    );
  }

  // item_cards ビューは owner_nickname を含むので profiles を join せずに済む
  // （items ↔ profiles を直接 embed すると Supabase の FK 推論が曖昧になり
  //   "more than one relationship found" で失敗する）。
  // ただし item_cards は status='deleted' を除外する view なので、
  // 「削除済み」を見たいときだけ items を直で引く。
  const { data: items, error: dbError } = await rows((db) => {
    const wantsDeleted = f === 'deleted';
    let query = wantsDeleted
      ? db
          .from('items')
          .select('id, name, category, condition, status, parent_id, root_id, depth, created_at, user_id')
          .eq('status', 'deleted')
      : db
          .from('item_cards')
          .select('id, name, category, condition, status, parent_id, root_id, depth, created_at, user_id, owner_nickname');

    query = query.order('created_at', { ascending: false }).limit(100);
    if (q) query = query.ilike('name', `%${q}%`);
    if (f === 'seed') query = query.is('parent_id', null);
    else if (f !== 'all' && f !== 'deleted') query = query.eq('status', f);
    return query;
  });

  return (
    <Shell title="商品">
      <Banner error={error ?? dbError} ok={ok} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <form className="flex gap-2 max-w-md">
          <input name="q" defaultValue={q} placeholder="商品名で検索" className="input" />
          <input type="hidden" name="f" value={f} />
          <button className="btn-primary shrink-0">検索</button>
        </form>
        <div className="flex gap-1 ml-auto">
          {FILTERS.map((t) => (
            <Link
              key={t.key}
              href={`/items?f=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`btn h-8 px-3 ${f === t.key ? 'bg-green text-white' : 'border border-line text-muted'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="th">商品名</th>
              <th className="th">出品者</th>
              <th className="th">カテゴリ</th>
              <th className="th">段</th>
              <th className="th">ツリー</th>
              <th className="th">状態</th>
              <th className="th">出品日</th>
              <th className="th">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.id}>
                <td className="td font-bold">{it.name}</td>
                <td className="td text-muted whitespace-nowrap">{it.owner_nickname ?? '—'}</td>
                <td className="td text-muted">{it.category}</td>
                <td className="td">{it.parent_id === null ? '種' : `${it.depth}段目`}</td>
                <td className="td text-muted text-xs font-mono">{shortId(it.root_id)}</td>
                <td className="td">
                  <span className={it.status === 'deleted' ? 'text-danger font-bold' : ''}>
                    {STATUS_LABEL[it.status] ?? it.status}
                  </span>
                </td>
                <td className="td text-muted text-xs whitespace-nowrap">{jst(it.created_at)}</td>
                <td className="td">
                  {it.status === 'deleted' ? (
                    <form action={restoreAction}>
                      <input type="hidden" name="id" value={it.id} />
                      <button className="btn-ghost h-8 px-3">復活</button>
                    </form>
                  ) : (
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={it.id} />
                      <button className="btn h-8 px-3 bg-danger text-white">非表示</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={8}>
                  該当する商品がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted mt-3 leading-relaxed">
        ※「非表示」は物理削除ではなく状態を <code className="px-1 bg-white rounded">deleted</code>{' '}
        にする操作です。ツリー（親子関係）は保持されるため、収穫済みの交換履歴は壊れません。
      </p>
    </Shell>
  );
}
