import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, passwordRequired, sessionToken } from '@/lib/auth';

/** /login 以外はすべてパスワードで保護する */
export async function middleware(req: NextRequest) {
  if (!passwordRequired) return NextResponse.next();

  const ok = req.cookies.get(COOKIE)?.value === (await sessionToken());
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // 静的アセットとログイン画面は除外
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
