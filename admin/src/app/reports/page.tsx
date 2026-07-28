import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { isConnected, rows } from '@/lib/supabase';
import { setReportStatus } from '@/lib/actions';
import { jst, shortId } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'open', label: '未対応' },
  { key: 'resolved', label: '対応済み' },
  { key: 'dismissed', label: '却下' },
  { key: 'all', label: 'すべて' },
];

const TARGET_LABEL: Record<string, string> = {
  item: '商品',
  board_post: '掲示板の投稿',
  board_comment: '掲示板のコメント',
  user: 'ユーザー',
};

async function statusAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const status = String(formData.get('status')) as 'open' | 'resolved' | 'dismissed';
  const res = await setReportStatus(id, status, String(formData.get('note') ?? ''));
  redirect(res.error ? `/reports?error=${encodeURIComponent(res.error)}` : '/reports?ok=通報を更新しました');
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; error?: string; ok?: string }>;
}) {
  const { s = 'open', error, ok } = await searchParams;

  if (!isConnected) {
    return (
      <Shell title="通報">
        <NotConnected />
      </Shell>
    );
  }

  const { data: reportList, error: dbError } = await rows<any>((db) => {
    let query = db.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
    if (s !== 'all') query = query.eq('status', s);
    return query;
  });

  // 通報対象の名前を引く（UUID だけでは運営が判断できないため）
  const NONE = ['00000000-0000-0000-0000-000000000000'];
  const idsOf = (type: string) => {
    const ids = reportList.filter((r) => r.target_type === type).map((r) => r.target_id);
    return ids.length ? ids : NONE;
  };
  const reporterIds = reportList.length ? reportList.map((r) => r.reporter_id) : NONE;

  const [items, posts, targetUsers, reporterList] = await Promise.all([
    rows<any>((db) => db.from('items').select('id, name').in('id', idsOf('item'))),
    rows<any>((db) => db.from('board_posts').select('id, body').in('id', idsOf('board_post'))),
    rows<any>((db) => db.from('profiles').select('id, nickname').in('id', idsOf('user'))),
    rows<any>((db) => db.from('profiles').select('id, nickname').in('id', reporterIds)),
  ]);

  const names = new Map<string, string>();
  items.data.forEach((i) => names.set(i.id, i.name));
  posts.data.forEach((p) => names.set(p.id, String(p.body).slice(0, 40)));
  targetUsers.data.forEach((u) => names.set(u.id, u.nickname));
  const reporters = new Map<string, string>();
  reporterList.data.forEach((u) => reporters.set(u.id, u.nickname));

  return (
    <Shell title="通報">
      <Banner error={error ?? dbError} ok={ok} />

      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/reports?s=${t.key}`}
            className={`btn h-8 px-3 ${s === t.key ? 'bg-green text-white' : 'border border-line text-muted'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {reportList.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cream">
                {TARGET_LABEL[r.target_type] ?? r.target_type}
              </span>
              <span className="font-black">{names.get(r.target_id) ?? shortId(r.target_id)}</span>
              <span className="text-xs text-muted ml-auto">{jst(r.created_at)}</span>
            </div>

            <p className="text-sm leading-relaxed mb-1">{r.reason || '（理由の記載なし）'}</p>
            <p className="text-xs text-muted mb-3">
              通報者: {reporters.get(r.reporter_id) ?? shortId(r.reporter_id)}
              {r.handled_note ? ` ／ 対応メモ: ${r.handled_note}` : ''}
            </p>

            {r.status === 'open' ? (
              <form action={statusAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={r.id} />
                <input name="note" placeholder="対応メモ（任意）" className="input max-w-xs h-9" />
                <button name="status" value="resolved" className="btn-primary h-9">
                  対応済みにする
                </button>
                <button name="status" value="dismissed" className="btn-ghost h-9">
                  却下
                </button>
              </form>
            ) : (
              <form action={statusAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={r.id} />
                <span className={`text-xs font-bold ${r.status === 'resolved' ? 'text-green-deep' : 'text-muted'}`}>
                  {r.status === 'resolved' ? '対応済み' : '却下'} ／ {jst(r.handled_at)}
                </span>
                <button name="status" value="open" className="btn-ghost h-8 px-3">
                  未対応に戻す
                </button>
              </form>
            )}
          </div>
        ))}

        {reportList.length === 0 && (
          <div className="card p-6 text-sm text-muted">
            {s === 'open' ? '未対応の通報はありません。' : '該当する通報はありません。'}
          </div>
        )}
      </div>
    </Shell>
  );
}
