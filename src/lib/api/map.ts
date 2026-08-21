import type { MockItem, MockUser } from '@/data/mock';

/**
 * DB の行 → 画面が使っている形（MockItem / MockUser）への変換。
 *
 * 画面は全部 MockItem を前提に書かれているので、DB 化にあたっては
 * **画面の型を変えず、ここで詰め替える**方針にする。
 * こうすると「モックのまま動く」「実DBでも動く」を1つの画面コードで両立できる。
 */

/**
 * 退会したユーザーの表示名。
 *
 * 退会すると profiles の行が消え、取引・評価・投稿から参照が NULL になる
 * （相手の履歴を壊さないため、行そのものは残す設計）。
 * 名前欄が空だと壊れて見えるので、全画面でこの文言に揃える。
 */
export const DELETED_USER_NAME = '退会したユーザー';

/** まだ名前を決めていない人の表示名（2026-08-12 項目23） */
export const NO_NAME = '名前未設定';

/**
 * 画面に出す名前。
 *
 * 以前は登録時にメールアドレスの @ より前を名前として入れていたが、
 * 本人が入れた覚えのないローマ字名が出るのでやめた（0030）。
 * その代わり、空のときはここで「名前未設定」に寄せる。
 * 退会した人（プロフィールごと消えている）とは区別する。
 */
export function displayName(nickname: string | null | undefined): string {
  if (nickname === null || nickname === undefined) return DELETED_USER_NAME;
  return nickname.trim() === '' ? NO_NAME : nickname;
}

/** item_cards ビューの1行 */
export type ItemCardRow = {
  id: string;
  user_id: string;
  owner_nickname: string;
  owner_avatar_url: string | null;
  name: string;
  description: string | null;
  category: string;
  condition: string;
  status: 'growing' | 'trading' | 'completed';
  parent_id: string | null;
  root_id: string;
  depth: number;
  created_at: string;
  image_url: string | null;
  image_urls: string[] | null;
  water_count: number;
  like_count: number;
  tree_count: number;
  /** 自分がいいねしているか（0010 で追加） */
  liked: boolean;
};

export function toItem(r: ItemCardRow): MockItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    condition: r.condition,
    description: r.description ?? '',
    image: r.image_url ?? '',
    images: r.image_urls ?? (r.image_url ? [r.image_url] : []),
    ownerId: r.user_id,
    waterCount: Number(r.water_count ?? 0),
    likeCount: Number(r.like_count ?? 0),
    liked: Boolean(r.liked),
    treeCount: Number(r.tree_count ?? 0),
    status: r.status,
    parentId: r.parent_id,
    rootId: r.root_id,
    depth: Number(r.depth ?? 0),
    createdAt: r.created_at,
  };
}

/** item_cards の行から、出品者を MockUser 形で取り出す（画面のアバター表示用） */
export function toOwner(r: ItemCardRow): MockUser {
  return {
    id: r.user_id,
    nickname: r.owner_nickname,
    avatar: r.owner_avatar_url ?? '',
    ratingCount: 0,
    itemCount: 0,
  };
}

/** item_cards ビューから取る列。1か所にまとめて選択漏れを防ぐ */
export const ITEM_CARD_COLUMNS =
  'id, user_id, owner_nickname, owner_avatar_url, name, description, category, condition, ' +
  'status, parent_id, root_id, depth, created_at, image_url, image_urls, ' +
  'water_count, like_count, tree_count, liked';

/** 「3分前」「2日前」のような相対表記（画面が createdAt を文字列で出しているため） */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}日前`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}ヶ月前`;
  return `${Math.floor(mo / 12)}年前`;
}
