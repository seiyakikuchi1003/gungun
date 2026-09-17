import { Icon } from './Icon';

/** 操作結果の表示（サーバーアクションから ?error= / ?ok= で戻ってくる） */
export function Banner({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`mb-5 rounded-xl px-4 py-3 text-sm font-bold flex items-start gap-2 border ${
        error ? 'bg-danger/5 text-danger border-danger/20' : 'bg-green-soft text-green-deep border-green/20'
      }`}
    >
      <Icon name={error ? 'alert' : 'check'} className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{error ?? ok}</span>
    </div>
  );
}
