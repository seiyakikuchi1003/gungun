/**
 * 課金・肥料まわりの設定値。
 *
 * ⚠️ 金額・肥料量は「未確定」。SPEC/AGENTS の規約どおりハードコードしない方針。
 * ネイティブ化の際は `app_settings` テーブル（または環境変数）から読み込み、
 * 管理画面から差し替え可能にする。ここはモック用の暫定デフォルト。
 */
export const settings = {
  // 水やり1回に必要な肥料（暫定たたき台）
  waterCost: 200,
  // ログインボーナス
  dailyLoginBonus: 40,
  // プレミアム会員のログインボーナス（2026-07-28 MTG で復活）
  dailyLoginBonusPremium: 80,
  // 最初の種植えは無料
  firstSeedFree: true,

  // 肥料チャージのプラン（price は円。未確定のため null なら画面に「¥---」を表示）
  // ★本実装では app_settings / 環境変数から読み込み、管理画面から変更可能にする
  chargePlans: [
    { id: 'c1', fertilizer: 1000, price: 500 as number | null, badge: '' },
    { id: 'c2', fertilizer: 3000, price: 1200 as number | null, badge: 'お得' },
    { id: 'c3', fertilizer: 7000, price: 2500 as number | null, badge: '人気' },
  ],
  // プレミアム月額（未確定。null の間は「¥---」表示）
  premiumMonthly: 480 as number | null,
} as const;

/** 円表示。未設定（null/undefined）は SPEC に従い「¥---」。 */
export function formatPrice(v: number | null | undefined): string {
  return v == null ? '¥---' : `¥${v.toLocaleString()}`;
}
