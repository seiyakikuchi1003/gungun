/**
 * DB型（手書き）。
 * Supabaseプロジェクトができたら `supabase gen types typescript` で自動生成に置き換える想定。
 * それまでは supabase/migrations の DDL と手動で対応させる。
 */

export type ItemStatus = 'growing' | 'trading' | 'completed' | 'deleted';
export type ExchangeStatus = 'pending' | 'shipped' | 'received';
export type FertilizerReason = 'login_bonus' | 'purchase' | 'watering' | 'admin';
export type NotificationType =
  | 'watered'
  | 'harvested'
  | 'shipped'
  | 'received'
  | 'message'
  | 'board_comment';

export type Profile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  fertilizer: number;
  last_login_bonus_on: string | null;
  is_premium: boolean;
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
  created_at: string;
};

/** 出品フォームの入力（種植え・水やり共通） */
export type ListingInput = {
  name: string;
  description: string;
  category: string;
  condition: string;
  images: string[]; // 1枚目がサムネイル
};
