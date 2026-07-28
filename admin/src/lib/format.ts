/** 一覧に出す日時（日本時間・秒は省く） */
export function jst(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** UUID をそのまま出すと表が読めないので先頭だけ */
export function shortId(id?: string | null): string {
  return id ? id.slice(0, 8) : '—';
}

export function num(n?: number | null): string {
  return (n ?? 0).toLocaleString('ja-JP');
}
