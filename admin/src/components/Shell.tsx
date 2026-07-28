import Link from 'next/link';
import { isConnected } from '@/lib/supabase';
import { passwordRequired } from '@/lib/auth';

const NAV = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/users', label: 'ユーザー' },
  { href: '/items', label: '商品' },
  { href: '/reports', label: '通報' },
  { href: '/settings', label: 'アプリ設定' },
];

/** 管理画面の共通レイアウト（サイドナビ＋ヘッダー） */
export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* サイドナビ */}
      <aside className="w-56 shrink-0 border-r border-line bg-white/70 hidden md:flex md:flex-col">
        <div className="px-5 py-5 border-b border-line">
          <div className="text-lg font-black text-green">ぐんぐん</div>
          <div className="text-[11px] font-bold text-muted tracking-wide">管理画面</div>
        </div>
        <nav className="p-3 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 rounded-lg text-sm font-bold text-ink hover:bg-green-soft transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-3">
          <div
            className={`text-[11px] font-bold rounded-lg px-3 py-2 ${
              isConnected ? 'bg-green-soft text-green-deep' : 'bg-mikan-soft text-mikan'
            }`}
          >
            {isConnected ? '● Supabase 接続中' : '○ Supabase 未接続'}
          </div>
        </div>
      </aside>

      {/* 本体 */}
      <div className="flex-1 min-w-0">
        <header className="border-b border-line bg-white/70 px-6 py-4 flex items-center gap-4">
          <h1 className="text-lg font-black">{title}</h1>
          <nav className="md:hidden flex gap-2 ml-auto overflow-x-auto">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-xs font-bold text-muted whitespace-nowrap">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="p-6 max-w-6xl">
          {!passwordRequired && (
            <div className="mb-4 rounded-lg px-4 py-3 text-sm font-bold bg-mikan-soft text-mikan">
              ADMIN_PASSWORD が未設定のため、この管理画面は誰でも開けます。公開前に必ず設定してください。
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
      <h2 className="font-black text-base mb-2">Supabase に接続されていません</h2>
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
