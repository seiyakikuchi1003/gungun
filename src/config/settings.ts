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
  // 最初の種植えは無料
  firstSeedFree: true,
} as const;
