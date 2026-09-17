export const runtime = "edge";

import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Icon } from '@/components/Icon';
import { Nickname, Pager, Pill, SearchBox, Tabs } from '@/components/ui';
import { countOf, isConnected, rows } from '@/lib/supabase';
import { restoreItem, softDeleteItem } from '@/lib/actions';
import { redirectWithResult, safePath } from '@/lib/result';
import { jst } from '@/lib/format';

/*
 * ★ サーバーアクションは必ずコンポーネントの外（モジュールの直下）に置くこと（2026-09-17）。
 *   コンポーネントの中で定義して画面の変数（id や戻り先）を使うと、Next.js はその値を
 *   暗号化してブラウザに渡すが、Cloudflare Pages（next-on-pages）では復号に失敗し、
 *   押した瞬間に「atob() called with invalid base64-encoded data」で落ちる。
 *   手元の next dev では再現しない。必要な値は .bind() の引数で渡す。
 */

async function hideAction(here: string, id: string, formData: FormData) {
  'use server';
  const res = await softDeleteItem(id, String(formData.get('reason') ?? ''));
  redirectWithResult(safePath(here, '/items'), res, '非表示にしました。出品者にお知らせを送りました');
}

async function restoreAction(here: string, id: string) {
  'use server';
  const res = await restoreItem(id);
  redirectWithResult(safePath(here, '/items'), res, '表示に戻しました');
}

export const dynamic = 'force-dynamic';

/**
 * 商品（2026-09-17 作り直し）。
 *
 * 絞り込みは「すべて・出品中・取引中・タネ・非表示」＋カテゴリー（T-3 の指摘で確定。
 * 段やツリーでの絞り込みは作らない）。
 * 写真と出品者を並べ、出品者を押すとその人の詳細へ行ける。
 */

const PAGE_SIZE = 40;

/** アプリの出品カテゴリー（src/data/mock.ts と同じ並び） */
const CATEGORIES = [
  '本・漫画・CD・DVD',
  'ファッション・アクセサリー',
  '趣味・サブカル',
  'コスメ・美容',
  'ベビー・キッズ用品',
  '家電・デジタルガジェット',
  '日用品・雑貨・文具',
  '食品（常温のみ）',
  'スポーツ用品',
  'アウトドア・旅行品',
];

const STATUS: Record<string, { label: string; tone: 'green' | 'mikan' | 'gray' | 'danger'; note: string }> = {
  growing: { label: '出品中', tone: 'green', note: '水やりを待っている' },
  trading: { label: '取引中', tone: 'mikan', note: '交換が決まり配送中' },
  completed: { label: '交換済み', tone: 'gray', note: '交換が終わった' },
  deleted: { label: '非表示', tone: 'danger', note: '運営または本人が非表示にした' },
};

type Filter = 'all' | 'growing' | 'trading' | 'seed' | 'deleted';

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; c?: string; page?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const f = (['all', 'growing', 'trading', 'seed', 'deleted'].includes(sp.f ?? '') ? sp.f : 'all') as Filter;
  const c = CATEGORIES.includes(sp.c ?? '') ? (sp.c as string) : '';
  const page = Math.max(1, Number(sp.page) || 1);

  if (!isConnected) {
    return (
      <Shell title="商品" current="/items">
        <NotConnected />
      </Shell>
    );
  }

  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, f: f !== 'all' ? f : undefined, c: c || undefined, ...extra })) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return `/items${s ? `?${s}` : ''}`;
  };
  const here = href({ page: page > 1 ? String(page) : undefined });

  // 非表示のものも見たいので items を直接引く（item_cards は非表示を除外するビュー）
  const apply = (query: any, filter: Filter) => {
    if (q) query = query.ilike('name', `%${q.replace(/[%]/g, '')}%`);
    if (c) query = query.eq('category', c);
    if (filter === 'seed') query = query.is('parent_id', null).neq('status', 'deleted');
    else if (filter === 'all') query = query;
    else query = query.eq('status', filter);
    return query;
  };

  const [{ data: items, error: dbError }, total, cAll, cGrowing, cTrading, cSeed, cDeleted] = await Promise.all([
    rows<any>((db) =>
      apply(db.from('items').select('id, name, category, condition, status, parent_id, created_at, user_id'), f)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    ),
    countOf('items', (x) => apply(x, f)),
    countOf('items', (x) => apply(x, 'all')),
    countOf('items', (x) => apply(x, 'growing')),
    countOf('items', (x) => apply(x, 'trading')),
    countOf('items', (x) => apply(x, 'seed')),
    countOf('items', (x) => apply(x, 'deleted')),
  ]);

  const NONE = ['00000000-0000-0000-0000-000000000000'];
  const itemIds = items.length ? items.map((i) => i.id) : NONE;
  const ownerIds = items.length ? [...new Set(items.map((i) => i.user_id))] : NONE;
  const [{ data: images }, { data: owners }, { data: reported }] = await Promise.all([
    rows<any>((db) => db.from('item_images').select('item_id, url, sort_order').in('item_id', itemIds).order('sort_order')),
    rows<any>((db) => db.from('profiles').select('id, nickname, is_suspended').in('id', ownerIds)),
    rows<any>((db) => db.from('reports').select('target_id').eq('target_type', 'item').eq('status', 'open').in('target_id', itemIds)),
  ]);
  const thumb = new Map<string, string>();
  for (const im of images) if (!thumb.has(im.item_id)) thumb.set(im.item_id, im.url);
  const ownerMap = new Map(owners.map((o) => [o.id, o]));
  const reportedSet = new Set(reported.map((r) => r.target_id));

  return (
    <Shell
      title="商品"
      description="利用者が出品したものの一覧です。規約に反するものは非表示にできます（データは消えず、あとから戻せます）。"
      current="/items"
    >
      <Banner error={sp.error ?? dbError} ok={sp.ok} />

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Tabs
          current={f}
          items={[
            { key: 'all', label: 'すべて', href: href({ f: undefined }), count: cAll },
            { key: 'growing', label: '出品中', href: href({ f: 'growing' }), count: cGrowing },
            { key: 'trading', label: '取引中', href: href({ f: 'trading' }), count: cTrading },
            { key: 'seed', label: 'タネ', href: href({ f: 'seed' }), count: cSeed },
            { key: 'deleted', label: '非表示', href: href({ f: 'deleted' }), count: cDeleted },
          ]}
        />
        <SearchBox q={q} placeholder="商品名で探す" keep={{ ...(f !== 'all' ? { f } : {}), ...(c ? { c } : {}) }} />
      </div>

      {/* カテゴリーで絞る。押すたびに切り替え、同じものをもう一度押すと解除 */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <Link
          href={href({ c: undefined, page: undefined })}
          className={`text-xs font-bold rounded-full px-3 h-7 inline-flex items-center border ${!c ? 'bg-ink text-white border-ink' : 'border-line text-muted bg-white hover:text-ink'}`}
        >
          すべてのカテゴリー
        </Link>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={href({ c: c === cat ? undefined : cat, page: undefined })}
            className={`text-xs font-bold rounded-full px-3 h-7 inline-flex items-center border ${c === cat ? 'bg-ink text-white border-ink' : 'border-line text-muted bg-white hover:text-ink'}`}
          >
            {cat}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[920px]">
          <thead>
            <tr>
              <th className="th">商品</th>
              <th className="th">出品者</th>
              <th className="th">状態</th>
              <th className="th">出品日</th>
              <th className="th"><span className="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const st = STATUS[it.status] ?? { label: it.status, tone: 'gray' as const, note: '' };
              const owner = ownerMap.get(it.user_id);
              const img = thumb.get(it.id);
              return (
                <tr key={it.id}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="w-12 h-12 rounded-lg object-cover bg-cream shrink-0" />
                      ) : (
                        <span className="w-12 h-12 rounded-lg bg-cream grid place-items-center text-muted shrink-0">
                          <Icon name="box" className="w-5 h-5" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold truncate max-w-[320px]">{it.name}</div>
                        <div className="text-[11.5px] text-muted flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span>{it.category}</span>
                          <span>・{it.condition}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="td whitespace-nowrap">
                    <Link href={`/users/${it.user_id}`} className="hover:text-green">
                      <Nickname name={owner?.nickname} />
                    </Link>
                    {owner?.is_suspended && <span className="ml-1.5"><Pill tone="danger">停止中</Pill></span>}
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1" title={st.note}>
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {it.parent_id === null && it.status !== 'deleted' && <Pill tone="green">タネ</Pill>}
                      {reportedSet.has(it.id) && <Pill tone="danger">通報あり</Pill>}
                    </div>
                  </td>
                  <td className="td text-muted text-xs whitespace-nowrap">{jst(it.created_at)}</td>
                  <td className="td text-right">
                    {it.status === 'deleted' ? (
                      <form action={restoreAction.bind(null, here, it.id)}>
                        <button className="btn-ghost h-8 px-3 whitespace-nowrap">表示に戻す</button>
                      </form>
                    ) : (
                      <form action={hideAction.bind(null, here, it.id)}>
                        <ConfirmButton
                          message={`「${it.name}」をアプリに表示しないようにします。出品者にお知らせが届きます。よろしいですか？（あとから戻せます）`}
                          className="btn-ghost h-8 px-3 whitespace-nowrap text-danger border-danger/30 hover:bg-danger/5"
                        >
                          非表示にする
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td className="td text-muted text-center py-10" colSpan={5}>
                  {q ? `「${q}」にあてはまる商品はありません` : '該当する商品はありません'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(pg) => href({ page: String(pg) })} />
    </Shell>
  );
}
