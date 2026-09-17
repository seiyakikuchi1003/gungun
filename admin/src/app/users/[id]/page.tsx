export const runtime = "edge";

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Icon } from '@/components/Icon';
import { Field, Nickname, Pill, Section, StatCard } from '@/components/ui';
import { admin, isConnected, rows } from '@/lib/supabase';
import { grantFertilizer, setPremium, setSuspended, warnUser } from '@/lib/actions';
import { redirectWithResult } from '@/lib/result';
import { jst, num } from '@/lib/format';
import { ACTION_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/**
 * ユーザーの詳細（2026-09-17 新設）。
 *
 * 1人について「どんな人か」「何をしてきたか」「運営が何をしたか」を1画面で見て、
 * そのままプレミアム・肥料・停止・警告の操作ができるようにする。
 * これまでは一覧の行を開いて小さな入力欄を触るしかなく、プレミアムは操作自体が無かった。
 */

const ITEM_STATUS: Record<string, { label: string; tone: 'green' | 'mikan' | 'gray' | 'danger' }> = {
  growing: { label: '出品中', tone: 'green' },
  trading: { label: '取引中', tone: 'mikan' },
  completed: { label: '交換済み', tone: 'gray' },
  deleted: { label: '非表示', tone: 'danger' },
};

const LEDGER_REASON: Record<string, string> = {
  login_bonus: 'ログインボーナス',
  purchase: '購入',
  watering: '水やり',
  admin: '運営が調整',
  subscription: 'プレミアム特典',
};

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { error, ok } = await searchParams;

  if (!isConnected) {
    return (
      <Shell title="ユーザー" current="/users">
        <NotConnected />
      </Shell>
    );
  }

  const { data: user } = await admin().from('admin_user_cards').select('*').eq('id', id).maybeSingle();
  if (!user) notFound();

  const back = `/users/${id}`;

  // ── 操作（どれも結果をこの画面に返す） ──
  async function premiumAction(on: boolean, formData: FormData) {
    'use server';
    const until = String(formData.get('until') ?? '').trim();
    const noLimit = formData.get('nolimit') === 'on';
    const res = await setPremium(id, on, on && !noLimit ? until || null : null);
    redirectWithResult(back, res, on ? 'プレミアムにしました' : 'プレミアムを外しました');
  }
  async function fertilizerAction(sign: 1 | -1, formData: FormData) {
    'use server';
    const amount = Math.abs(Number(formData.get('amount'))) * sign;
    const res = await grantFertilizer(id, amount);
    redirectWithResult(back, res, sign > 0 ? `肥料を ${Math.abs(amount)} 増やしました` : `肥料を ${Math.abs(amount)} 減らしました`);
  }
  async function suspendAction(to: boolean, formData: FormData) {
    'use server';
    const res = await setSuspended(id, to, String(formData.get('reason') ?? ''));
    redirectWithResult(back, res, to ? '利用を停止しました。本人にお知らせを送りました' : '利用停止を解除しました');
  }
  async function warnAction(formData: FormData) {
    'use server';
    const res = await warnUser(id, String(formData.get('message') ?? ''));
    redirectWithResult(back, res, '警告を送りました（本人の通知に届きます）');
  }

  const [
    { data: items },
    { data: posts },
    { data: ledger },
    { data: reportsAgainst },
    { data: history },
    { data: stats },
  ] = await Promise.all([
    rows<any>((db) =>
      db.from('items').select('id, name, status, parent_id, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20)
    ),
    rows<any>((db) =>
      db.from('board_posts').select('id, body, hidden_at, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10)
    ),
    rows<any>((db) =>
      db.from('fertilizer_ledger').select('amount, reason, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10)
    ),
    rows<any>((db) =>
      db.from('reports').select('id, reason, status, action_taken, created_at').eq('target_type', 'user').eq('target_id', id).order('created_at', { ascending: false }).limit(10)
    ),
    rows<any>((db) =>
      db.from('admin_audit_log').select('action, detail, created_at').eq('target_id', id).order('created_at', { ascending: false }).limit(20)
    ),
    rows<any>((db) => db.from('profile_stats').select('rating_avg, rating_count, harvest_count').eq('id', id).limit(1)),
  ]);

  const s = stats[0] ?? {};
  const premiumUntil = user.premium_until ? jst(user.premium_until) : null;
  const expired = user.is_premium && user.premium_until && new Date(user.premium_until).getTime() < Date.now();
  // 期限の初期値は1か月後
  const defaultUntil = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  return (
    <Shell
      title={user.nickname?.trim() || '名前未設定'}
      description={user.email ?? 'メールアドレス未登録'}
      current="/users"
      back={{ href: '/users', label: 'ユーザー一覧へ戻る' }}
      actions={
        <div className="flex gap-1.5 flex-wrap">
          {user.is_suspended && <Pill tone="danger">利用停止中</Pill>}
          {user.is_premium && <Pill tone="mikan">★ プレミアム</Pill>}
          {Number(user.reported_count) > 0 && <Pill tone="gray">通報 {user.reported_count}件</Pill>}
        </div>
      }
    >
      <Banner error={error} ok={ok} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="肥料の残り" value={num(user.fertilizer)} icon="leaf" tone="green" />
        <StatCard label="出品" value={num(user.item_count)} note="非表示を除く" icon="box" />
        <StatCard label="取引" value={num(user.trade_count)} note="送る・受け取るの合計" />
        <StatCard
          label="評価"
          value={s.rating_avg ? `★ ${s.rating_avg}` : '—'}
          note={`${num(s.rating_count)}件の評価`}
          icon="star"
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* 左：この人について */}
        <div className="flex flex-col gap-6 min-w-0">
          <Section title="基本情報">
            <dl>
              <Field label="ニックネーム"><Nickname name={user.nickname} /></Field>
              <Field label="メール">{user.email ?? <span className="text-muted">未登録</span>}</Field>
              <Field label="登録日">{jst(user.created_at)}</Field>
              <Field label="最終ログイン">{jst(user.last_sign_in_at)}</Field>
              <Field label="成立した交換">{num(s.harvest_count)} 回</Field>
              <Field label="ユーザーID"><code className="text-xs text-muted">{user.id}</code></Field>
            </dl>
          </Section>

          <Section title="出品" note="新しい順に20件まで" flush>
            <table className="w-full">
              <tbody>
                {items.map((it) => {
                  const st = ITEM_STATUS[it.status] ?? { label: it.status, tone: 'gray' as const };
                  return (
                    <tr key={it.id}>
                      <td className="td font-bold">{it.name}</td>
                      <td className="td w-px whitespace-nowrap">
                        <Pill tone={st.tone}>{st.label}</Pill>
                        {it.parent_id === null && <span className="ml-1"><Pill tone="green">タネ</Pill></span>}
                      </td>
                      <td className="td text-muted text-xs whitespace-nowrap w-px">{jst(it.created_at)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td className="td text-muted text-center py-6">出品はありません</td></tr>
                )}
              </tbody>
            </table>
          </Section>

          <Section title="掲示板の投稿" note="新しい順に10件まで" flush>
            <table className="w-full">
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td className="td">
                      <Link href={`/board/${p.id}`} className="hover:text-green line-clamp-2">{p.body}</Link>
                    </td>
                    <td className="td w-px whitespace-nowrap">{p.hidden_at && <Pill tone="danger">非表示</Pill>}</td>
                    <td className="td text-muted text-xs whitespace-nowrap w-px">{jst(p.created_at)}</td>
                  </tr>
                ))}
                {posts.length === 0 && (
                  <tr><td className="td text-muted text-center py-6">投稿はありません</td></tr>
                )}
              </tbody>
            </table>
          </Section>

          <Section title="この人への通報" flush>
            <table className="w-full">
              <tbody>
                {reportsAgainst.map((r) => (
                  <tr key={r.id}>
                    <td className="td">{r.reason || <span className="text-muted">（理由の記載なし）</span>}</td>
                    <td className="td w-px whitespace-nowrap">
                      {r.status === 'open' ? <Pill tone="danger">未対応</Pill> : <Pill tone="gray">{ACTION_LABEL[r.action_taken] ?? '対応済み'}</Pill>}
                    </td>
                    <td className="td text-muted text-xs whitespace-nowrap w-px">{jst(r.created_at)}</td>
                  </tr>
                ))}
                {reportsAgainst.length === 0 && (
                  <tr><td className="td text-muted text-center py-6">通報はありません</td></tr>
                )}
              </tbody>
            </table>
          </Section>

          <Section title="運営が行った操作" note="この人に対して管理画面で行ったこと" flush>
            <table className="w-full">
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td className="td font-bold">{ACTION_LABEL[h.action] ?? h.action}</td>
                    <td className="td text-muted text-xs">{describeDetail(h.action, h.detail)}</td>
                    <td className="td text-muted text-xs whitespace-nowrap w-px">{jst(h.created_at)}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td className="td text-muted text-center py-6">まだ操作はありません</td></tr>
                )}
              </tbody>
            </table>
          </Section>
        </div>

        {/* 右：操作 */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <Section
            title="プレミアム"
            note="決済を通さず、運営が直接付け外しできます"
            actions={user.is_premium ? <Pill tone="mikan">加入中</Pill> : <Pill tone="gray">未加入</Pill>}
          >
            {user.is_premium ? (
              <>
                <p className="text-sm mb-3">
                  {premiumUntil ? (
                    <>
                      <span className="font-bold">{premiumUntil}</span> まで有効
                      {expired && <span className="text-danger font-bold">（期限切れ・次のログインで外れます）</span>}
                    </>
                  ) : (
                    <span className="font-bold">期限なし</span>
                  )}
                </p>
                <form action={premiumAction.bind(null, true)} className="flex flex-col gap-2 mb-3">
                  <label className="text-xs font-bold text-muted">有効期限を変える</label>
                  <div className="flex gap-2">
                    <input type="date" name="until" defaultValue={defaultUntil} className="input" />
                    <button className="btn-ghost shrink-0">変更</button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="nolimit" className="accent-green" /> 期限なしにする
                  </label>
                </form>
                <form action={premiumAction.bind(null, false)}>
                  <ConfirmButton
                    message={`${user.nickname || 'このユーザー'} のプレミアムを外します。よろしいですか？`}
                    className="btn-ghost w-full text-danger"
                  >
                    プレミアムを外す
                  </ConfirmButton>
                </form>
              </>
            ) : (
              <form action={premiumAction.bind(null, true)} className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted">有効期限</label>
                <input type="date" name="until" defaultValue={defaultUntil} className="input" />
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" name="nolimit" className="accent-green" /> 期限なしにする
                </label>
                <button className="btn bg-mikan text-white hover:brightness-95 mt-1">
                  <Icon name="star" className="w-4 h-4" />
                  プレミアムにする
                </button>
              </form>
            )}
          </Section>

          <Section title="肥料" note={`いまの残り：${num(user.fertilizer)}`}>
            <form className="flex flex-col gap-2">
              <input name="amount" type="number" min={1} defaultValue={100} className="input" aria-label="増減する量" />
              <div className="grid grid-cols-2 gap-2">
                <button formAction={fertilizerAction.bind(null, 1)} className="btn-primary">増やす</button>
                <button formAction={fertilizerAction.bind(null, -1)} className="btn-ghost">減らす</button>
              </div>
            </form>
            {ledger.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-bold text-muted mb-1.5">最近の増減</div>
                <ul className="text-xs divide-y divide-line/70">
                  {ledger.map((l, i) => (
                    <li key={i} className="py-1.5 flex gap-2">
                      <span className={`font-bold tabular-nums w-14 text-right ${l.amount > 0 ? 'text-green' : 'text-danger'}`}>
                        {l.amount > 0 ? `+${l.amount}` : l.amount}
                      </span>
                      <span className="text-muted">{LEDGER_REASON[l.reason] ?? l.reason}</span>
                      <span className="text-muted ml-auto">{jst(l.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="警告を送る" note="投稿や出品はそのまま。本人の通知に「運営からの警告」として届きます">
            <form action={warnAction} className="flex flex-col gap-2">
              <textarea
                name="message"
                rows={3}
                className="textarea"
                placeholder="例：不適切な内容の投稿がありました。今後同様の投稿が続く場合、利用を停止することがあります。"
              />
              <button className="btn-ghost">警告を送る</button>
            </form>
          </Section>

          <Section
            title="利用停止"
            note={user.is_suspended ? `停止日：${jst(user.suspended_at)}` : '停止すると、本人はアプリを開いても何もできなくなります'}
          >
            {user.is_suspended ? (
              <>
                <div className="rounded-lg bg-danger/5 border border-danger/20 p-3 text-sm mb-3">
                  <div className="text-xs font-bold text-danger mb-1">停止の理由（本人に表示中）</div>
                  {user.suspended_reason || <span className="text-muted">理由なし</span>}
                </div>
                <form action={suspendAction.bind(null, false)}>
                  <ConfirmButton
                    message={`${user.nickname || 'このユーザー'} の利用停止を解除します。よろしいですか？`}
                    className="btn-ghost w-full"
                  >
                    停止を解除する
                  </ConfirmButton>
                </form>
              </>
            ) : (
              <form action={suspendAction.bind(null, true)} className="flex flex-col gap-2">
                <textarea name="reason" rows={2} className="textarea" placeholder="停止の理由（本人に表示されます）" />
                <ul className="text-[11.5px] text-muted leading-relaxed list-disc pl-4">
                  <li>アプリを開くと「利用を停止しています」の画面になり、何もできません</li>
                  <li>出品・水やり・投稿・コメントはサーバ側でも止まります</li>
                  <li>本人には理由と問い合わせ先が表示されます</li>
                </ul>
                <ConfirmButton
                  message={`${user.nickname || 'このユーザー'} の利用を停止します。本人はアプリを使えなくなります。よろしいですか？`}
                  className="btn bg-danger text-white hover:brightness-95"
                >
                  <Icon name="ban" className="w-4 h-4" />
                  利用を停止する
                </ConfirmButton>
              </form>
            )}
          </Section>

          <Section title="メールを送る">
            <Link href={`/mail?ids=${user.id}`} className="btn-ghost w-full">
              <Icon name="mail" className="w-4 h-4" />
              この人にメールを書く
            </Link>
          </Section>
        </div>
      </div>
    </Shell>
  );
}

/** 監査ログの detail を、運営に読める一言にする */
function describeDetail(action: string, detail: any): string {
  if (!detail) return '';
  switch (action) {
    case 'grant_fertilizer':
      return `${detail.amount > 0 ? '+' : ''}${detail.amount}（残り ${detail.balance}）`;
    case 'grant_premium':
      return detail.until ? `${jst(detail.until)} まで` : '期限なし';
    case 'suspend_user':
      return detail.reason ? `理由：${detail.reason}` : '';
    case 'warn_user':
      return detail.message ?? '';
    default:
      return '';
  }
}
