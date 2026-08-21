/**
 * 配送業者と荷物の追跡（2026-08-14 / 2026-08-17）。
 *
 * 追跡ページのURLも番号の桁数も業者の都合で変わるので、DBではなくここに置く。
 * 変わってもアプリの配信だけで直せる。
 *
 * 【桁数を検証する理由】
 * 参考にした他アプリでは、桁数の違う番号をそのまま追跡サイトに渡していて、
 * 開いた先で「お問い合わせ番号の入力桁数に誤りがあります」と出ていた。
 * 受け取る側は自分では直せないので、入力した本人に、その場で気づかせる。
 */

export type Carrier = 'yamato' | 'japanpost' | 'sagawa' | 'other';

export const CARRIERS: {
  key: Carrier;
  label: string;
  /** 受け付ける桁数。空なら検証しない */
  digits: number[];
  /** 入力欄に出す例 */
  sample: string;
}[] = [
  { key: 'yamato', label: 'ヤマト運輸', digits: [12], sample: '1234-5678-9012' },
  { key: 'japanpost', label: '日本郵便', digits: [11, 12, 13], sample: '1234-5678-9012' },
  { key: 'sagawa', label: '佐川急便', digits: [10, 11, 12], sample: '1234-5678-90' },
  { key: 'other', label: 'その他・追跡なし', digits: [], sample: '' },
];

export function carrier(key: string | null | undefined) {
  return CARRIERS.find((c) => c.key === key);
}

export function carrierLabel(key: string | null | undefined): string {
  return carrier(key)?.label ?? 'その他';
}

/** 追跡番号から、業者のフォームが受け付けない文字（ハイフン・空白）を落とす */
export function normalize(no: string | null | undefined): string {
  return (no ?? '').replace(/[^0-9]/g, '');
}

/** 見せるときは4桁ずつ区切ると読み合わせしやすい */
export function prettyNumber(no: string | null | undefined): string {
  const n = normalize(no);
  return n.replace(/(\d{4})(?=\d)/g, '$1-');
}

/**
 * 入力された番号を確かめる。
 * 追跡サイトへ送る前に弾いて、「開いた先でエラー」を防ぐ。
 */
export function checkNumber(carrierKey: string, input: string): { ok: true } | { ok: false; reason: string } {
  const c = carrier(carrierKey);
  const no = normalize(input);
  if (!c || c.digits.length === 0) return { ok: true };      // 追跡なしは検証しない
  if (no.length === 0) return { ok: false, reason: '追跡番号を入力してください' };
  if (!c.digits.includes(no.length)) {
    const range =
      c.digits.length === 1 ? `${c.digits[0]}桁` : `${Math.min(...c.digits)}〜${Math.max(...c.digits)}桁`;
    return { ok: false, reason: `${c.label}の追跡番号は${range}です（いまは${no.length}桁）` };
  }
  return { ok: true };
}

/**
 * 追跡ページのURL。番号が無い・「その他」を選んだ場合は null（リンクを出さない）。
 */
export function trackingUrl(carrierKey: string | null | undefined, number: string | null | undefined): string | null {
  const no = normalize(number);
  if (!no) return null;
  switch (carrierKey) {
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
