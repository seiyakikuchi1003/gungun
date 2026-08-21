/**
 * 管理画面のログイン。
 *
 * v1 は共有パスワード1本のみ（運営メンバーが数人の想定）。
 * パスワードそのものは Cookie に入れず、ハッシュを入れて突き合わせる。
 * お客様アカウントへ引き継ぐときは ADMIN_PASSWORD を差し替えるだけでよい。
 */
export const COOKIE = 'gungun_admin';

/** ADMIN_PASSWORD が設定されているか */
export const passwordRequired = Boolean(process.env.ADMIN_PASSWORD);

/** ローカル開発かどうか。ここだけは ADMIN_PASSWORD 無しでも開ける */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(':')[0];
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

/**
 * ADMIN_PASSWORD 未設定のアクセスを拒否すべきか。
 *
 * ★ 未設定のときは「鍵なしで通す」のではなく「閉じる」（fail closed）。
 *   この画面の裏には RLS を越える service_role キーがあるため、設定漏れが
 *   そのまま「全ユーザーの個人情報が誰でも読める」状態になってしまう。
 *   実際に一度、パスワード未設定のまま公開URLに出ていた（2026-08-03 に検知）。
 *
 *   ローカル開発（localhost）だけは従来どおり鍵なしで動かせる。
 */
export function shouldBlockUnconfigured(host: string | null | undefined): boolean {
  return !passwordRequired && !isLocalHost(host);
}

/** Cookie に入れる値。middleware（Edge）でも動くよう Web Crypto を使う */
export async function sessionToken(password = process.env.ADMIN_PASSWORD ?? ''): Promise<string> {
  const bytes = new TextEncoder().encode(`gungun-admin:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
