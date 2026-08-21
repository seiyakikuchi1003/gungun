export const runtime = "edge";

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COOKIE, passwordRequired, sessionToken } from '@/lib/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = '/', error } = await searchParams;

  if (!passwordRequired) redirect('/');

  async function signIn(formData: FormData) {
    'use server';
    const input = String(formData.get('password') ?? '');
    const dest = String(formData.get('next') || '/');
    if (input !== process.env.ADMIN_PASSWORD) {
      redirect(`/login?next=${encodeURIComponent(dest)}&error=1`);
    }
    (await cookies()).set(COOKIE, await sessionToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12, // 12時間
    });
    redirect(dest);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form action={signIn} className="card p-8 w-full max-w-sm">
        <div className="text-2xl font-black text-green leading-tight">ぐんぐん</div>
        <div className="text-xs font-bold text-muted mt-1 mb-6">管理画面</div>

        <label className="block text-xs font-bold text-muted mb-1.5">パスワード</label>
        <input type="password" name="password" className="input" autoFocus autoComplete="current-password" />
        <input type="hidden" name="next" value={next} />

        {error ? <p className="text-xs text-danger font-bold mt-2">パスワードが違います</p> : null}

        <button type="submit" className="btn-primary w-full mt-5">
          ログイン
        </button>
      </form>
    </div>
  );
}
