export const runtime = "edge";

import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { countOf, isConnected, rows } from '@/lib/supabase';
import { jst } from '@/lib/format';
import { Tabs, SearchBox, Pager } from '@/components/ui';
import { UserTable, type UserRow } from '@/components/UserTable';

export const dynamic = 'force-dynamic';

/**
 * ユーザー一覧（2026-09-17 作り直し）。
 *
 * 指摘：利用者を確認しづらい。全員選択や複数選択ができず、一人ずつ探すしかない。
 *  - 行にチェックを付けて、選んだ人にまとめてメールを送れるようにした
 *  - 行を押すと詳細画面へ。プレミアム・肥料・停止・警告はそこにまとめた
 *    （表の中に操作ボタンを並べると押し間違えるうえ、読みにくい）
 *  - 50人ずつページで送る（これまでは200人で打ち切り、それ以上は見られなかった）
 */

const PAGE_SIZE = 50;

type Filter = 'all' | 'premium' | 'suspended' | 'reported';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; page?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const f = (['all', 'premium', 'suspended', 'reported'].includes(sp.f ?? '') ? sp.f : 'all') as Filter;
  const page = Math.max(1, Number(sp.page) || 1);

  if (!isConnected) {
    return (
      <Shell title="ユーザー" current="/users">
        <NotConnected />
      </Shell>
    );
  }

  // 検索語に「,」や「%」が入ると PostgREST の or() 構文が壊れるので取り除く
  const safeQ = q.replace(/[,%()]/g, ' ').trim();

  const applyFilter = (query: any, filter: Filter) => {
    if (safeQ) query = query.or(`nickname.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);
    if (filter === 'premium') query = query.eq('is_premium', true);
    if (filter === 'suspended') query = query.eq('is_suspended', true);
    if (filter === 'reported') query = query.gt('reported_count', 0);
    return query;
  };

  const [{ data: users, error: dbError }, total, cAll, cPremium, cSuspended, cReported] = await Promise.all([
    rows<any>((db) =>
      applyFilter(db.from('admin_user_cards').select('*'), f)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    ),
    countOf('admin_user_cards', (query) => applyFilter(query, f)),
    countOf('admin_user_cards', (query) => applyFilter(query, 'all')),
    countOf('admin_user_cards', (query) => applyFilter(query, 'premium')),
    countOf('admin_user_cards', (query) => applyFilter(query, 'suspended')),
    countOf('admin_user_cards', (query) => applyFilter(query, 'reported')),
  ]);

  const href = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, f: f !== 'all' ? f : undefined, ...extra };
    for (const [k, v] of Object.entries(merged)) {
      // 1ページ目はクエリに出さない（URL を短く保つ）
      if (v === undefined || v === '' || (k === 'page' && Number(v) === 1)) continue;
      p.set(k, String(v));
    }
    const s = p.toString();
    return `/users${s ? `?${s}` : ''}`;
  };

  const tableRows: UserRow[] = users.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    email: u.email,
    avatar_url: u.avatar_url,
    fertilizer: Number(u.fertilizer ?? 0),
    item_count: Number(u.item_count ?? 0),
    trade_count: Number(u.trade_count ?? 0),
    reported_count: Number(u.reported_count ?? 0),
    is_premium: Boolean(u.is_premium),
    is_suspended: Boolean(u.is_suspended),
    created_at: u.created_at,
    created_label: jst(u.created_at),
  }));

  // ページをまたいだ全員に送るときは、宛先を絞り込み条件で渡す
  const mailAll = new URLSearchParams({ to: 'filter', ...(q ? { q } : {}), ...(f !== 'all' ? { f } : {}) }).toString();

  return (
    <Shell
      title="ユーザー"
      description="登録している人の一覧です。名前を押すと、プレミアムの付与・肥料の調整・利用停止などができます。"
      current="/users"
    >
      <Banner error={sp.error ?? dbError} ok={sp.ok} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Tabs
          current={f}
          items={[
            { key: 'all', label: 'すべて', href: href({ f: undefined, page: undefined }), count: cAll },
            { key: 'premium', label: 'プレミアム', href: href({ f: 'premium', page: undefined }), count: cPremium },
            { key: 'reported', label: '通報あり', href: href({ f: 'reported', page: undefined }), count: cReported },
            { key: 'suspended', label: '停止中', href: href({ f: 'suspended', page: undefined }), count: cSuspended },
          ]}
        />
        <SearchBox q={q} placeholder="名前・メールアドレスで探す" keep={f !== 'all' ? { f } : undefined} />
      </div>

      {q && (
        <p className="text-xs text-muted mb-3">
          「<span className="font-bold text-ink">{q}</span>」で {total}人 見つかりました
        </p>
      )}

      <UserTable rows={tableRows} allMatchingHref={`/mail?${mailAll}`} allMatchingCount={total} />

      <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => href({ page: p })} />
    </Shell>
  );
}
