import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { countOf, isConnected, rows } from '@/lib/supabase';
import { jst, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Stat = { label: string; value: number; href?: string; tone?: 'green' | 'mikan' | 'danger' };

export default async function DashboardPage() {
  if (!isConnected) {
    return (
      <Shell title="ダッシュボード">
        <NotConnected />
      </Shell>
    );
  }

  const [users, premium, seeds, growing, harvests, openReports, posts] = await Promise.all([
    countOf('profiles'),
    countOf('profiles', (q) => q.eq('is_premium', true)),
    countOf('items', (q) => q.is('parent_id', null)),
    countOf('items', (q) => q.eq('status', 'growing')),
    countOf('harvests'),
    countOf('reports', (q) => q.eq('status', 'open')),
    countOf('board_posts'),
  ]);

  const stats: Stat[] = [
    { label: 'ユーザー', value: users, href: '/users' },
    { label: 'プレミアム', value: premium, href: '/users', tone: 'mikan' },
    { label: '種（ツリーの起点）', value: seeds, href: '/items' },
    { label: '育成中の商品', value: growing, href: '/items', tone: 'green' },
    { label: '収穫された種', value: harvests },
    { label: '未対応の通報', value: openReports, href: '/reports', tone: openReports > 0 ? 'danger' : undefined },
    { label: '掲示板の投稿', value: posts },
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

  return (
    <Shell title="ダッシュボード">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map((s) => {
          const body = (
            <div className="card p-4 h-full">
              <div className="text-xs font-bold text-muted mb-1">{s.label}</div>
              <div
                className={`text-2xl font-black ${
                  s.tone === 'danger' ? 'text-danger' : s.tone === 'mikan' ? 'text-mikan' : s.tone === 'green' ? 'text-green' : ''
                }`}
              >
                {num(s.value)}
              </div>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block hover:opacity-80 transition-opacity">
              {body}
            </Link>
          ) : (
            <div key={s.label}>{body}</div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <h2 className="px-4 py-3 font-black text-sm border-b border-line">最近の出品</h2>
          <table className="w-full">
            <tbody>
              {recentItems.map((it: any) => (
                <tr key={it.id}>
                  <td className="td font-bold">{it.name}</td>
                  <td className="td text-muted whitespace-nowrap">{it.owner_nickname ?? '—'}</td>
                  <td className="td text-muted text-xs whitespace-nowrap">{jst(it.created_at)}</td>
                </tr>
              ))}
              {recentItems.length === 0 && (
                <tr>
                  <td className="td text-muted">まだ出品がありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <h2 className="px-4 py-3 font-black text-sm border-b border-line">最近の登録</h2>
          <table className="w-full">
            <tbody>
              {recentUsers.map((u: any) => (
                <tr key={u.id}>
                  <td className="td font-bold">{u.nickname}</td>
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
