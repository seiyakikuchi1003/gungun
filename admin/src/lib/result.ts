import { redirect } from 'next/navigation';

/**
 * 操作の結果メッセージを付けて画面に戻る。
 *
 * ★ 必ずここを通すこと。redirect() の URL に日本語をそのまま書くと、
 *   Location ヘッダーに非 ASCII が入って 500 になり、ブラウザには
 *   「An unexpected response was received from the server.」とだけ出る。
 *   ヘッダーは Latin-1 しか運べないため、パーセントエンコードが必須。
 *   （2026-08-04：管理画面の全ての書き込みボタンがこれで動いていなかった）
 */
/**
 * 画面から渡された戻り先を、この管理画面の中のパスに限る。
 * サーバーアクションの引数はブラウザ側で書き換えられるので、
 * 「https://…」や「//…」を渡されて外に飛ばされないようにする。
 */
export function safePath(path: string, fallback = '/'): string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : fallback;
}

export function redirectWithResult(
  path: string,
  res: { error?: string },
  okMessage: string,
): never {
  const query = res.error
    ? `error=${encodeURIComponent(res.error)}`
    : `ok=${encodeURIComponent(okMessage)}`;
  redirect(`${path}?${query}`);
}
