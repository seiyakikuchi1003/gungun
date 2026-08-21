import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, passwordRequired, sessionToken, shouldBlockUnconfigured } from '@/lib/auth';

const BLOCKED_PAGE = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>設定が必要です — ぐんぐん管理画面</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#FDF8F0;color:#2B3A2F;font-family:system-ui,-apple-system,sans-serif;padding:24px}
  .card{max-width:540px;background:#fff;border-radius:16px;padding:32px;
        box-shadow:0 4px 24px rgba(0,0,0,.07)}
  h1{margin:0 0 14px;font-size:19px;line-height:1.5}
  p{margin:0 0 14px;font-size:14.5px;line-height:1.85;color:#5B6B5F}
  code{background:#F1EFE8;padding:2px 6px;border-radius:5px;font-size:13px}
  ol{font-size:14.5px;line-height:2;color:#5B6B5F;padding-left:22px;margin:0}
</style></head>
<body><div class="card">
  <h1>🔒 ADMIN_PASSWORD が設定されていません</h1>
  <p>この管理画面は全ユーザーの個人情報を扱うため、パスワードが未設定のときは
     開けないようにしています（鍵なしで通すより閉じるほうが安全なため）。</p>
  <ol>
    <li>Cloudflare Pages → 対象プロジェクト → Settings → Variables</li>
    <li><code>ADMIN_PASSWORD</code> を追加（Encrypt を有効にする）</li>
    <li>Deployments → Retry deployment で再デプロイ</li>
  </ol>
</div></body></html>`;

/** /login 以外はすべてパスワードで保護する */
export async function middleware(req: NextRequest) {
  // ADMIN_PASSWORD 未設定のまま公開URLに出ている場合は開かせない。
  // 裏に service_role キー（RLS を越える全権キー）があるため、
  // 設定漏れがそのまま全ユーザーの個人情報の公開になってしまう。
  if (shouldBlockUnconfigured(req.headers.get('host'))) {
    return new NextResponse(BLOCKED_PAGE, {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  // ログイン画面はここから先の判定を通さない（通すと /login → /login のループになる）
  if (req.nextUrl.pathname === '/login') return NextResponse.next();

  if (!passwordRequired) return NextResponse.next();

  const ok = req.cookies.get(COOKIE)?.value === (await sessionToken());
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // 静的アセットは除外。/login も「未設定なら閉じる」判定を通したいので matcher に含め、
  // 通過後は passwordRequired の分岐で素通しになる。
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
