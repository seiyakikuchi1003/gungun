/**
 * DB型（手書き）。
 * Supabaseプロジェクトができたら `supabase gen types typescript` で自動生成に置き換える想定。
 * それまでは supabase/migrations の DDL と手動で対応させる。
 */

export type ItemStatus = 'growing' | 'trading' | 'completed' | 'deleted';
export type ExchangeStatus = 'pending' | 'shipped' | 'received';
export type FertilizerReason = 'login_bonus' | 'purchase' | 'watering' | 'admin' | 'subscription';
export type NotificationType =
  | 'watered'
  | 'harvested'
  | 'shipped'
  | 'received'
  | 'message'
  | 'board_comment'
  | 'item_comment'
  | 'ring_completed';

export type Profile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  fertilizer: number;
  last_login_bonus_on: string | null;
  /** いまプレミアムか（これが正）。期限切れは expire_premium() が false にする */
  is_premium: boolean;
  /** プレミアムの期限。null は期限なし（運営付与） */
  premium_until: string | null;
  created_at: string;
};

export type Item = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string;
  condition: string;
  status: ItemStatus;
  parent_id: string | null; // null = 種
  root_id: string; // 種なら自分自身
  depth: number;
  created_at: string;
  updated_at: string;
};

export type ItemImage = {
  id: string;
  item_id: string;
  url: string;
  sort_order: number; // 0 = サムネイル
};

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  body: string;
  related_id: string | null;
  read_at: string | null;
  /** プッシュ送信済みの時刻。null なら未送信（二重送信の防止に使う） */
  pushed_at: string | null;
  created_at: string;
};

export type PurchasePlatform = 'ios' | 'android' | 'admin';
export type PurchaseKind = 'fertilizer' | 'premium';

/**
 * IAP のレシート。付与は redeem_purchase()（service_role 専用）経由のみ。
 * アプリからは自分の履歴を読むだけ。
 */
export type Purchase = {
  id: string;
  user_id: string;
  platform: PurchasePlatform;
  kind: PurchaseKind;
  product_id: string;
  transaction_id: string;
  fertilizer_amount: number;
  premium_days: number;
  price_jpy: number | null;
  created_at: string;
};

/** 端末のプッシュ通知トークン。主キーは token */
export type PushToken = {
  token: string;
  user_id: string;
  platform: 'ios' | 'android';
  updated_at: string;
};

/** 出品フォームの入力（種植え・水やり共通） */
export type ListingInput = {
  name: string;
  description: string;
  category: string;
  condition: string;
  images: string[]; // 1枚目がサムネイル
};
