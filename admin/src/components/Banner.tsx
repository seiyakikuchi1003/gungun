/** 操作結果の表示（サーバーアクションから ?error= / ?ok= で戻ってくる） */
export function Banner({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div
      className={`mb-4 rounded-lg px-4 py-3 text-sm font-bold ${
        error ? 'bg-mikan-soft text-danger' : 'bg-green-soft text-green-deep'
      }`}
    >
      {error ?? ok}
    </div>
  );
}
