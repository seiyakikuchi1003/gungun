'use client';

/**
 * 押すと確認を挟むボタン（2026-08-17）。
 *
 * 停止・非表示は他人のアカウントや出品に影響する操作なのに、
 * これまでは押した瞬間に実行されていた。取り消しの手段も無いので、
 * 一度「本当にやるか」を聞く。
 *
 * 確認は素の confirm() を使う。管理画面は運営が短時間触るだけの道具で、
 * ここに独自のダイアログを作り込むより、確実に止まることを優先する。
 */
export function ConfirmButton({
  message,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  return (
    <button
      {...rest}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
