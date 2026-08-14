/**
 * 配送業者と追跡URL（2026-08-14 指摘：配送後のフローを細かく）。
 *
 * 追跡ページのURL形式は業者の都合で変わるので、DBではなくここに置く。
 * 変わってもアプリの配信だけで直せる。
 */

export type Carrier = 'yamato' | 'japanpost' | 'sagawa' | 'other';

export const CARRIERS: { key: Carrier; label: string }[] = [
  { key: 'yamato', label: 'ヤマト運輸' },
  { key: 'japanpost', label: '日本郵便' },
  { key: 'sagawa', label: '佐川急便' },
  { key: 'other', label: 'その他・番号なし' },
];

export function carrierLabel(key: string | null | undefined): string {
  return CARRIERS.find((c) => c.key === key)?.label ?? 'その他';
}

/**
 * 追跡ページのURL。番号が無い・その他を選んだ場合は null（リンクを出さない）。
 * 番号のハイフンや空白は業者のフォームが受け付けないことがあるので落とす。
 */
export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined): string | null {
  const no = (number ?? '').replace(/[\s-]/g, '');
  if (!no) return null;
  switch (carrier) {
    case 'yamato':
      return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number01=${no}`;
    case 'japanpost':
      return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${no}&searchKind=S002`;
    case 'sagawa':
      return `https://k2k.sagawa-exp.co.jp/p/sagawa/web/okurijoinput.jsp?okurijoNo=${no}`;
    default:
      return null;
  }
}
