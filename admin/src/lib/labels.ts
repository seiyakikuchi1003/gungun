/**
 * 管理画面に出す言葉を1か所に集める。
 * 同じ操作が画面ごとに別の言い方で出ると、運営の方が読み替える必要が出るため。
 */

/** 監査ログの action と、通報の action_taken の読み方 */
export const ACTION_LABEL: Record<string, string> = {
  // 通報への対応
  hide_content: '内容を非表示',
  warn_user: '警告を送信',
  suspend_user: '利用を停止',
  none: '問題なし',
  handle_report: '通報に対応',
  reopen_report: '通報を未対応に戻す',
  set_report_status: '通報の状態を変更',
  // ユーザー
  unsuspend_user: '停止を解除',
  grant_fertilizer: '肥料を調整',
  grant_premium: 'プレミアムを付与',
  revoke_premium: 'プレミアムを解除',
  // 商品・投稿
  delete_item: '商品を非表示',
  restore_item: '商品を再表示',
  unhide_content: '内容を再表示',
  // そのほか
  send_mail: 'メールを配信',
  update_setting: '設定を変更',
};

/** 通報の対象の種類 */
export const TARGET_LABEL: Record<string, string> = {
  item: '商品',
  board_post: '掲示板の投稿',
  board_comment: '掲示板のコメント',
  item_comment: '商品へのコメント',
  user: 'ユーザー',
  board_posts: '掲示板の投稿',
  board_comments: '掲示板のコメント',
  item_comments: '商品へのコメント',
  report: '通報',
  app_setting: 'アプリ設定',
  mail: 'メール',
};
