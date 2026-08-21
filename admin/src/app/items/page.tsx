export const runtime = "edge";

import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { isConnected, rows } from '@/lib/supabase';
import { restoreItem, softDeleteItem } from '@/lib/actions';
import { redirectWithResult } from '@/lib/result';
import { jst } from '@/lib/format';
import { ConfirmButton } from '@/components/ConfirmButton';

export const dynamic = 'force-dynamic';

/** 状態の見せ方。色でも区別できるようにする */
const STATUS: Record<string, { label: string; cls: string; note: string }> = {
  growing: { label: '出品中', cls: 'bg-green-soft text-green-deep', note: '水やりを待っている' },
  trading: { label: '取引中', cls: 'bg-mikan-soft text-mikan', note: '交換が決まり配送中' },
  completed: { label: '完了', cls: 'bg-cream text-muted', note: '交換が終わった' },
  deleted: { label: '非表示', cls: 'bg-danger/10 text-danger', note: '運営が非表示にした' },
};

const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'growing', label: '出品中' },
  { key: 'trading', label: '取引中' },
  { key: 'seed', label: 'タネ' },
  { key: 'deleted', label: '非表示にしたもの' },
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
    <Shell
      title="商品"
      description="利用者が出品したものの一覧です。規約に反するものは非表示にできます。"
      current="/items"
    >
      <Banner error={error ?? dbError} ok={ok} />

      {/* 操作の意味は、押す前に読める位置に置く（以前は表の下にあった） */}
      <p className="text-xs text-muted leading-relaxed mb-4 bg-white border border-line rounded-xl px-4 py-3">
        「非表示にする」を押すと、その商品はアプリに表示されなくなります。データは消えないので、
        あとから元に戻せます。すでに成立した交換の記録も壊れません。
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <form className="flex gap-2 max-w-md">
          <input name="q" defaultValue={q} placeholder="商品名で検索" className="input" />
          <input type="hidden" name="f" value={f} />
          <button className="btn-primary shrink-0">検索</button>
        </form>
        <div className="flex flex-wrap gap-1 ml-auto">
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
        <span className="text-xs text-muted w-full md:w-auto md:ml-2">{items.length} 件</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="th">商品名</th>
              <th className="th">出品者</th>
              <th className="th">カテゴリ</th>
              <th className="th">状態</th>
              <th className="th">出品日</th>
              <th className="th">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.id}>
                <td className="td">
                  <div className="font-bold">{it.name}</div>
                  {/* タネかどうかは運営にも意味があるので残すが、「何段目」は内部の概念なので出さない */}
                  {it.parent_id === null && (
                    <div className="text-[11px] text-muted">タネ（交換の輪の起点）</div>
                  )}
                </td>
                <td className="td text-muted whitespace-nowrap">{it.owner_nickname ?? '—'}</td>
                <td className="td text-muted">{it.category}</td>
                <td className="td">
                  <span
                    title={STATUS[it.status]?.note}
                    className={`text-[11px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${
                      STATUS[it.status]?.cls ?? 'bg-cream text-muted'
                    }`}
                  >
                    {STATUS[it.status]?.label ?? it.status}
                  </span>
                </td>
                <td className="td text-muted text-xs whitespace-nowrap">{jst(it.created_at)}</td>
                <td className="td">
                  {it.status === 'deleted' ? (
                    <form action={restoreAction}>
                      <input type="hidden" name="id" value={it.id} />
                      <button className="btn-ghost h-8 px-3 whitespace-nowrap">表示に戻す</button>
                    </form>
                  ) : (
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={it.id} />
                      <ConfirmButton
                        message={`「${it.name}」をアプリに表示しないようにします。よろしいですか？（あとから戻せます）`}
                        className="btn-ghost h-8 px-3 whitespace-nowrap text-danger border-danger/30 hover:bg-danger/5"
                      >
                        非表示にする
                      </ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={6}>
                  {q ? `「${q}」にあてはまる商品はありません` : '該当する商品はありません'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
