import Link from 'next/link';
import { isConnected, countOf } from '@/lib/supabase';
import { passwordRequired } from '@/lib/auth';
import { Icon, type IconName } from './Icon';

/**
 * 管理画面の共通レイアウト。
 *
 * 【考え方】
 * 触るのは開発者ではなく運営の方なので、「今どこにいるか」「この画面で何ができるか」
 * 「今やるべきことは何か」が、説明を読まなくても分かる状態を目指す。
 *
 * - ナビは「毎日見るもの」と「ときどき触るもの」に分けて並べる
 * - 対応が必要な件数（未対応の通報）はナビに赤い数字で出す
 * - 各画面の見出しに、その画面で何ができるかを1行で添える
 */

type NavItem = { href: string; label: string; icon: IconName; desc: string; badge?: 'reports' };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: '毎日みるもの',
    items: [
      { href: '/', label: 'ダッシュボード', icon: 'home', desc: '全体のようすと、やること' },
      { href: '/reports', label: '通報', icon: 'flag', desc: '通報された内容に対応する', badge: 'reports' },
    ],
  },
  {
    title: '管理する',
    items: [
      { href: '/users', label: 'ユーザー', icon: 'user', desc: '会員の確認・プレミアム・停止' },
      { href: '/items', label: '商品', icon: 'box', desc: '出品の確認と非表示' },
      { href: '/board', label: '掲示板', icon: 'chat', desc: '投稿とコメントの確認' },
      { href: '/mail', label: 'メール配信', icon: 'mail', desc: '利用者にお知らせを送る' },
    ],
  },
  {
    title: '設定と記録',
    items: [
      { href: '/settings', label: 'アプリ設定', icon: 'gear', desc: '金額・肥料・文章の変更' },
      { href: '/audit', label: '操作の記録', icon: 'clock', desc: '誰が・いつ・何をしたか' },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export async function Shell({
  title,
  description,
  current,
  actions,
  back,
  children,
}: {
  title: string;
  /** この画面で何ができるかの1行説明 */
  description?: string;
  /** 現在地。ナビを塗るのに使う */
  current?: string;
  /** 見出しの右に置く操作 */
  actions?: React.ReactNode;
  /** 詳細画面で、一覧へ戻るリンク */
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const openReports = isConnected ? await countOf('reports', (q) => q.eq('status', 'open')) : 0;
  const badgeOf = (n: NavItem) => (n.badge === 'reports' ? openReports : 0);

  return (
    <div className="min-h-screen flex bg-cream">
      {/* サイドナビ */}
      <aside className="w-64 shrink-0 border-r border-line bg-white hidden md:flex md:flex-col sticky top-0 h-screen">
        <Link href="/" className="px-5 pt-5 pb-4 flex items-center gap-2.5">
          {/* 「ぐ」の1文字だと濁点が矢印に見え、戻るボタンと間違えやすかった */}
          <span className="w-9 h-9 rounded-xl bg-green text-white grid place-items-center">
            <Icon name="leaf" className="w-5 h-5" />
          </span>
          <span>
            <span className="block text-base font-black text-ink leading-none">ぐんぐん</span>
            <span className="block text-[11px] font-bold text-muted tracking-wide mt-1">運営管理画面</span>
          </span>
        </Link>

        <nav className="px-3 flex-1 overflow-y-auto pb-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.title} className="mt-3 first:mt-1">
              <div className="px-3 pb-1.5 text-[10.5px] font-black text-muted/80 tracking-wider">{g.title}</div>
              <div className="flex flex-col gap-0.5">
                {g.items.map((n) => {
                  const on = current === n.href;
                  const badge = badgeOf(n);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      aria-current={on ? 'page' : undefined}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                        on ? 'bg-green text-white shadow-sm' : 'text-ink hover:bg-cream'
                      }`}
                    >
                      <span className={on ? 'text-white' : 'text-muted group-hover:text-green'}>
                        <Icon name={n.icon} className="w-[18px] h-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold leading-tight">{n.label}</span>
                        <span className={`block text-[11px] leading-tight mt-0.5 truncate ${on ? 'text-white/80' : 'text-muted'}`}>
                          {n.desc}
                        </span>
                      </span>
                      {badge > 0 && (
                        <span className={`text-[11px] font-black rounded-full min-w-[20px] h-5 px-1.5 grid place-items-center ${
                          on ? 'bg-white text-green-deep' : 'bg-danger text-white'
                        }`}>
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          <div className={`text-[11px] font-bold rounded-lg px-3 py-2 flex items-center gap-1.5 ${
            isConnected ? 'bg-green-soft text-green-deep' : 'bg-mikan-soft text-mikan'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green' : 'bg-mikan'}`} />
            {isConnected ? '本番のデータに接続中' : 'データベース未接続'}
          </div>
        </div>
      </aside>

      {/* 本体 */}
      <div className="flex-1 min-w-0">
        {/* スマホ用のナビ。横に並べて現在地を塗る */}
        <nav className="md:hidden flex gap-1 overflow-x-auto bg-white border-b border-line px-3 py-2 sticky top-0 z-20">
          {ALL_NAV.map((n) => {
            const badge = badgeOf(n);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`text-xs font-bold whitespace-nowrap rounded-full px-3 py-1.5 ${
                  current === n.href ? 'bg-green text-white' : 'text-muted'
                }`}
              >
                {n.label}
                {badge > 0 && <span className="ml-1 text-danger">{badge}</span>}
              </Link>
            );
          })}
        </nav>

        <header className="border-b border-line bg-white px-4 md:px-8 py-5">
          {back && (
            <Link href={back.href} className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-green mb-2">
              <Icon name="chevron-left" className="w-3.5 h-3.5" />
              {back.label}
            </Link>
          )}
          <div className="flex items-start gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-[22px] font-black leading-tight">{title}</h1>
              {description && <p className="text-[13px] text-muted mt-1 leading-relaxed">{description}</p>}
            </div>
            {actions && <div className="ml-auto flex items-center gap-2 flex-wrap">{actions}</div>}
          </div>
        </header>

        <main className="px-4 md:px-8 py-6 max-w-[1200px]">
          {!passwordRequired && (
            <div className="mb-4 rounded-lg px-4 py-3 text-sm font-bold bg-mikan-soft text-mikan">
              ADMIN_PASSWORD 未設定 — いまは localhost なので開けています。
              公開URLからは 503 で閉じるため、先方にお渡しする前に設定してください。
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

/** Supabase 未接続のときに出す案内 */
export function NotConnected() {
  return (
    <div className="card p-6">
      <h2 className="font-black text-base mb-2">データベースに接続されていません</h2>
      <p className="text-sm text-muted leading-relaxed mb-4">
        管理画面を動かすには、Supabase プロジェクトの接続情報が必要です。
        <code className="mx-1 px-1.5 py-0.5 bg-cream rounded text-xs">admin/.env.local</code>
        に以下を設定して再起動してください。
      </p>
      <pre className="bg-ink text-white text-xs rounded-lg p-4 overflow-x-auto">
{`SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=（Project Settings → API の service_role）
ADMIN_PASSWORD=（管理画面を開くためのパスワード）`}
      </pre>
    </div>
  );
}

/** 一覧が空のときの案内。「壊れている」と誤解されないよう理由を書く */
export function Empty({ title, note }: { title: string; note?: string }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-bold text-sm">{title}</p>
      {note && <p className="text-xs text-muted mt-1.5 leading-relaxed">{note}</p>}
    </div>
  );
}
