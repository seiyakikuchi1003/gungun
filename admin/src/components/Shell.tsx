import Link from 'next/link';
import { isConnected, rows } from '@/lib/supabase';
import { passwordRequired } from '@/lib/auth';

/**
 * 管理画面の共通レイアウト。
 *
 * 【考え方】
 * 触るのは開発者ではなく運営の方なので、「今どこにいるか」「この画面で何ができるか」
 * 「今やるべきことは何か」が、説明を読まなくても分かる状態を目指す。
 *
 * - 現在地はナビで塗って示す（以前はどこにいるか分からなかった）
 * - 各画面に1行の説明を必ず添える
 * - 未対応の通報はナビに件数を出す。放置されると運営として困るため
 */

const NAV = [
  { href: '/', label: 'ダッシュボード', icon: 'home', desc: '全体のようす' },
  { href: '/users', label: 'ユーザー', icon: 'user', desc: '会員の確認と対応' },
  { href: '/items', label: '商品', icon: 'box', desc: '出品の確認と非表示' },
  { href: '/reports', label: '通報', icon: 'flag', desc: '通報された内容の対応' },
  { href: '/settings', label: 'アプリ設定', icon: 'gear', desc: '金額や文章の変更' },
];

/** 小さなアイコン。ライブラリを足さずに済むよう手書きの SVG にしている */
function Icon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const p: Record<string, React.ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V21H3z" />,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
    box: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>,
    flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 3.5L16 11H5z" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {p[name]}
    </svg>
  );
}

/** 未対応の通報件数。ナビに出して気づけるようにする */
async function openReportCount(): Promise<number> {
  if (!isConnected) return 0;
  const { data } = await rows<any>((db) => db.from('reports').select('id').eq('status', 'open').limit(100));
  return data.length;
}

export async function Shell({
  title,
  description,
  current,
  actions,
  children,
}: {
  title: string;
  /** この画面で何ができるかの1行説明 */
  description?: string;
  /** 現在地。ナビを塗るのに使う */
  current?: string;
  /** 見出しの右に置く操作 */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const openReports = await openReportCount();

  return (
    <div className="min-h-screen flex bg-cream">
      {/* サイドナビ */}
      <aside className="w-60 shrink-0 border-r border-line bg-white hidden md:flex md:flex-col sticky top-0 h-screen">
        <div className="px-5 py-5">
          <div className="text-lg font-black text-green leading-none">ぐんぐん</div>
          <div className="text-[11px] font-bold text-muted tracking-wide mt-1">管理画面</div>
        </div>

        <nav className="px-3 flex flex-col gap-0.5">
          {NAV.map((n) => {
            const on = current === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? 'page' : undefined}
                className={`group flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${
                  on ? 'bg-green text-white' : 'text-ink hover:bg-cream'
                }`}
              >
                <span className={`mt-0.5 ${on ? 'text-white' : 'text-muted group-hover:text-green'}`}>
                  <Icon name={n.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold">{n.label}</span>
                    {n.href === '/reports' && openReports > 0 && (
                      <span className={`text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none ${
                        on ? 'bg-white text-green-deep' : 'bg-danger text-white'
                      }`}>
                        {openReports}
                      </span>
                    )}
                  </span>
                  <span className={`block text-[11px] leading-tight mt-0.5 ${on ? 'text-white/80' : 'text-muted'}`}>
                    {n.desc}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-3">
          <div className={`text-[11px] font-bold rounded-lg px-3 py-2 flex items-center gap-1.5 ${
            isConnected ? 'bg-green-soft text-green-deep' : 'bg-mikan-soft text-mikan'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green' : 'bg-mikan'}`} />
            {isConnected ? 'データベースに接続中' : 'データベース未接続'}
          </div>
        </div>
      </aside>

      {/* 本体 */}
      <div className="flex-1 min-w-0">
        {/* スマホ用のナビ。横に並べて現在地を塗る */}
        <nav className="md:hidden flex gap-1 overflow-x-auto bg-white border-b border-line px-3 py-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`text-xs font-bold whitespace-nowrap rounded-full px-3 py-1.5 ${
                current === n.href ? 'bg-green text-white' : 'text-muted'
              }`}
            >
              {n.label}
              {n.href === '/reports' && openReports > 0 && ` ${openReports}`}
            </Link>
          ))}
        </nav>

        <header className="border-b border-line bg-white px-6 py-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight">{title}</h1>
              {description && <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>}
            </div>
            {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
          </div>
        </header>

        <main className="p-6 max-w-6xl">
          {/* 未設定でも公開URLは middleware が 503 で閉じるので、「誰でも開ける」とは書かない。
              いま開けているのは localhost だからだと分かる文言にする。 */}
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
      <p className="text-xs text-muted mt-3">
        ※ service_role キーはすべての権限を持ちます。リポジトリにコミットせず、公開の場に貼らないでください。
      </p>
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
