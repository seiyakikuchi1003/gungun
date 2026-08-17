export const runtime = "edge";

import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { countOf, isConnected, rows } from '@/lib/supabase';
import { jst, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * ダッシュボード。
 *
 * 以前は数字が7つ並ぶだけで、見た人が次に何をすればいいのか分からなかった。
 * いちばん上に「対応が必要なこと」を置き、そこから直接その画面へ行けるようにする。
 * 数字はその下。用語も運営に伝わる言い方に直した（「種（ツリーの起点）」など内部語をやめる）。
 */

type Todo = { label: string; count: number; href: string; cta: string };

export default async function DashboardPage() {
  if (!isConnected) {
    return (
      <Shell title="ダッシュボード" current="/">
        <NotConnected />
      </Shell>
    );
  }

  const [users, premium, seeds, growing, harvests, openReports, posts, suspended, trading] = await Promise.all([
    countOf('profiles'),
    countOf('profiles', (q) => q.eq('is_premium', true)),
    countOf('items', (q) => q.is('parent_id', null)),
    countOf('items', (q) => q.eq('status', 'growing')),
    countOf('harvests'),
    countOf('reports', (q) => q.eq('status', 'open')),
    countOf('board_posts'),
    countOf('profiles', (q) => q.eq('is_suspended', true)),
    countOf('items', (q) => q.eq('status', 'trading')),
  ]);

  // 放っておくと困るものだけを出す。0件のものは出さない
  const todos: Todo[] = [
    { label: '未対応の通報', count: openReports, href: '/reports', cta: '確認する' },
  ].filter((t) => t.count > 0);

  const stats = [
    { label: 'ユーザー', value: users, href: '/users', note: '登録している人の数' },
    { label: 'プレミアム会員', value: premium, href: '/users?f=premium', note: '月額に加入している人', tone: 'mikan' as const },
    { label: '利用停止中', value: suspended, href: '/users?f=suspended', note: '運営が停止した人', tone: suspended > 0 ? ('danger' as const) : undefined },
    { label: '出品中の商品', value: growing, href: '/items?f=growing', note: 'いま水やりを待っている', tone: 'green' as const },
    { label: '取引中の商品', value: trading, href: '/items?f=trading', note: '交換が決まって配送中' },
    { label: 'タネの数', value: seeds, href: '/items?f=seed', note: '交換の輪の起点になった出品' },
    { label: '成立した交換', value: harvests, note: 'これまでに成立した収穫の数' },
    { label: '掲示板の投稿', value: posts, note: '利用者どうしのやり取り' },
  ];

  const [{ data: recentItems }, { data: recentUsers }] = await Promise.all([
    rows((db) =>
      // item_cards ビュー経由で owner_nickname を取る
      // （items ↔ profiles の直接 embed は FK が曖昧になり失敗する）
      db
        .from('item_cards')
        .select('id, name, category, status, created_at, owner_nickname')
        .order('created_at', { ascending: false })
        .limit(8)
    ),
    rows((db) =>
      db
        .from('profiles')
        .select('id, nickname, fertilizer, created_at')
        .order('created_at', { ascending: false })
        .limit(8)
    ),
  ]);

  const STATUS: Record<string, { label: string; cls: string }> = {
    growing: { label: '出品中', cls: 'bg-green-soft text-green-deep' },
    trading: { label: '取引中', cls: 'bg-mikan-soft text-mikan' },
    completed: { label: '完了', cls: 'bg-cream text-muted' },
    deleted: { label: '非表示', cls: 'bg-cream text-muted' },
  };

  return (
    <Shell
      title="ダッシュボード"
      description="サービス全体のようすと、いま対応が必要なことをまとめています。"
      current="/"
    >
      {/* いちばん上に「やること」。無ければ無いと言い切る */}
      {todos.length > 0 ? (
        <div className="flex flex-col gap-2 mb-7">
          {todos.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className="card p-4 flex items-center gap-4 border-l-4 border-l-danger hover:bg-white transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-black">
                  {t.label}が <span className="text-danger">{num(t.count)}件</span> あります
                </div>
                <p className="text-xs text-muted mt-0.5">利用者からの報告です。内容を見て対応してください。</p>
              </div>
              <span className="btn-primary h-9 px-4 ml-auto shrink-0 inline-flex items-center">{t.cta}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card p-4 mb-7 flex items-center gap-3 border-l-4 border-l-green">
          <div>
            <div className="text-sm font-black text-green-deep">対応が必要なことはありません</div>
            <p className="text-xs text-muted mt-0.5">未対応の通報はゼロです。</p>
          </div>
        </div>
      )}

      <h2 className="text-sm font-black mb-2">今のようす</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map((s) => {
          const body = (
            <div className="card p-4 h-full">
              <div className="text-xs font-bold text-muted">{s.label}</div>
              <div
                className={`text-2xl font-black my-0.5 ${
                  s.tone === 'danger' ? 'text-danger' : s.tone === 'mikan' ? 'text-mikan' : s.tone === 'green' ? 'text-green' : ''
                }`}
              >
                {num(s.value)}
              </div>
              <div className="text-[11px] text-muted leading-tight">{s.note}</div>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block hover:brightness-[0.99] transition">
              {body}
            </Link>
          ) : (
            <div key={s.label}>{body}</div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center">
            <h2 className="font-black text-sm">最近の出品</h2>
            <Link href="/items" className="text-xs font-bold text-green ml-auto">すべて見る</Link>
          </div>
          <table className="w-full">
            <tbody>
              {recentItems.map((it: any) => {
                const st = STATUS[it.status] ?? { label: it.status, cls: 'bg-cream text-muted' };
                return (
                  <tr key={it.id}>
                    <td className="td font-bold">{it.name}</td>
                    <td className="td w-px">
                      <span className={`inline-block text-[11px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="td text-muted whitespace-nowrap">{it.owner_nickname ?? '—'}</td>
                    <td className="td text-muted text-xs whitespace-nowrap">{jst(it.created_at)}</td>
                  </tr>
                );
              })}
              {recentItems.length === 0 && (
                <tr>
                  <td className="td text-muted">まだ出品がありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center">
            <h2 className="font-black text-sm">最近の登録</h2>
            <Link href="/users" className="text-xs font-bold text-green ml-auto">すべて見る</Link>
          </div>
          <table className="w-full">
            <tbody>
              {recentUsers.map((u: any) => (
                <tr key={u.id}>
                  <td className="td font-bold">{u.nickname?.trim() || <span className="text-muted font-normal">名前未設定</span>}</td>
                  <td className="td text-muted whitespace-nowrap">肥料 {num(u.fertilizer)}</td>
                  <td className="td text-muted text-xs whitespace-nowrap">{jst(u.created_at)}</td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr>
                  <td className="td text-muted">まだユーザーがいません</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </Shell>
  );
}
