export const runtime = "edge";

import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { Pager, Pill } from '@/components/ui';
import { countOf, isConnected, rows } from '@/lib/supabase';
import { jst } from '@/lib/format';
import { ACTION_LABEL, TARGET_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/**
 * 操作の記録（2026-09-17 新設）。
 *
 * 管理画面で行った操作は、すべて admin_audit_log に残している（0004 から）。
 * これまで読む画面が無く、残っているだけだった。
 * 引き継ぎ後に「誰がいつ停止したのか」「設定をいつ変えたのか」を追えるようにする。
 */

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  if (!isConnected) {
    return (
      <Shell title="操作の記録" current="/audit">
        <NotConnected />
      </Shell>
    );
  }

  const [{ data: logs, error }, total] = await Promise.all([
    rows<any>((db) =>
      db.from('admin_audit_log').select('*').order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    ),
    countOf('admin_audit_log'),
  ]);

  // ユーザーに対する操作は、名前で読めるようにする
  const userIds = [...new Set(logs.filter((l) => l.target_type === 'user').map((l) => l.target_id))];
  const { data: users } = userIds.length
    ? await rows<any>((db) => db.from('profiles').select('id, nickname').in('id', userIds))
    : { data: [] as any[] };
  const nameOf = new Map(users.map((u) => [u.id, u.nickname]));

  const target = (l: any) => {
    if (l.target_type === 'user') {
      return (
        <Link href={`/users/${l.target_id}`} className="font-bold hover:text-green">
          {nameOf.get(l.target_id)?.trim() || '名前未設定'}
        </Link>
      );
    }
    if (l.target_type === 'board_posts') {
      return <Link href={`/board/${l.target_id}`} className="hover:text-green">投稿を見る</Link>;
    }
    if (l.target_type === 'app_setting' || l.target_type === 'mail') return <span>{l.target_id}</span>;
    return <span className="text-muted text-xs">{String(l.target_id ?? '').slice(0, 8)}</span>;
  };

  const detail = (l: any) => {
    const d = l.detail ?? {};
    if (l.action === 'grant_fertilizer') return `${d.amount > 0 ? '+' : ''}${d.amount}（残り ${d.balance}）`;
    if (l.action === 'grant_premium') return d.until ? `${jst(d.until)} まで` : '期限なし';
    if (l.action === 'handle_report') return `${ACTION_LABEL[d.action] ?? d.action}${d.note ? `：${d.note}` : ''}`;
    if (l.action === 'send_mail') return `${d.total ?? '?'}人中 ${d.sent ?? 0}人に送信`;
    if (l.action === 'update_setting') return typeof d.value === 'object' ? '（JSON を更新）' : String(d.value ?? '').slice(0, 40);
    return d.reason || d.message || d.note || '';
  };

  const tone = (action: string): 'danger' | 'mikan' | 'green' | 'gray' => {
    if (['suspend_user', 'delete_item', 'hide_content'].includes(action)) return 'danger';
    if (['warn_user', 'grant_premium', 'revoke_premium'].includes(action)) return 'mikan';
    if (['unsuspend_user', 'restore_item', 'unhide_content'].includes(action)) return 'green';
    return 'gray';
  };

  return (
    <Shell
      title="操作の記録"
      description="この管理画面で行った操作の記録です。停止・非表示・プレミアム付与・設定変更などが、新しい順に並びます。"
      current="/audit"
    >
      {error && <p className="text-sm text-danger mb-4">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className="th">日時</th>
              <th className="th">操作</th>
              <th className="th">対象</th>
              <th className="th">内容</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="td text-muted text-xs whitespace-nowrap">{jst(l.created_at)}</td>
                <td className="td whitespace-nowrap">
                  <Pill tone={tone(l.action)}>{ACTION_LABEL[l.action] ?? l.action}</Pill>
                </td>
                <td className="td whitespace-nowrap">
                  <span className="text-[11px] text-muted mr-1.5">{TARGET_LABEL[l.target_type] ?? l.target_type}</span>
                  {target(l)}
                </td>
                <td className="td text-sm text-muted">{detail(l)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td className="td text-center text-muted py-10" colSpan={4}>まだ記録はありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/audit?page=${p}`} />
    </Shell>
  );
}
