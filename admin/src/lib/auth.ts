/**
 * 管理画面のログイン。
 *
 * v1 は共有パスワード1本のみ（運営メンバーが数人の想定）。
 * パスワードそのものは Cookie に入れず、ハッシュを入れて突き合わせる。
 * お客様アカウントへ引き継ぐときは ADMIN_PASSWORD を差し替えるだけでよい。
 */
export const COOKIE = 'gungun_admin';

/** ADMIN_PASSWORD が未設定なら鍵なし運用（ローカル開発用。本番では必ず設定する） */
export const passwordRequired = Boolean(process.env.ADMIN_PASSWORD);

/** Cookie に入れる値。middleware（Edge）でも動くよう Web Crypto を使う */
export async function sessionToken(password = process.env.ADMIN_PASSWORD ?? ''): Promise<string> {
  const bytes = new TextEncoder().encode(`gungun-admin:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
