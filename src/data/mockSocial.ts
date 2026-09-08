/** 掲示板・通知・取引・評価のモックデータ。 */
import { getUser, getItem, MockItem } from './mock';

export type BoardTag = 'harvest' | 'question' | 'chat' | 'notice';
export type BoardPost = {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  liked?: boolean;
  tag: BoardTag;
  image?: number; // ローカル画像（require）。あれば投稿にサムネ表示。
  pinned?: boolean;
};

export const TAG_META: Record<BoardTag, { label: string; color: string; bg: string }> = {
  harvest: { label: '交換報告', color: '#2C8547', bg: '#E6F0DD' },
  question: { label: '質問', color: '#C57A1E', bg: '#FBEBCF' },
  chat: { label: '雑談', color: '#3B7AB0', bg: '#E1EDF6' },
  notice: { label: 'お知らせ', color: '#8A5AC2', bg: '#EEE6F7' },
};

const bagImg = require('../../assets/products/bag.jpg') as number;
const switchImg = require('../../assets/products/switch.jpg') as number;

export const boardPosts: BoardPost[] = [
  { id: 'p1', userId: 'sakura', tag: 'harvest', body: 'はじめてぐんぐんで交換成立しました🌱 ずっと眠っていたバッグが、欲しかったカメラに。わらしべ長者みたいで本当に楽しい…！みなさんの水やり待ってます〜', createdAt: '10分前', likeCount: 24, commentCount: 5, liked: true, image: bagImg, pinned: true },
  { id: 'p2', userId: 'takusan', tag: 'chat', body: 'Nintendo Switchの種を植えました🎮 ゲーム好きな方、ぜひ水やりしてください！交換の輪を広げましょう。', createdAt: '1時間前', likeCount: 12, commentCount: 3, image: switchImg },
  { id: 'p3', userId: 'yu', tag: 'question', body: 'カメラと交換できるものを探しています。水やりの仕組みがまだ少し不安なのですが、途中で抜けたりできますか？📷', createdAt: '3時間前', likeCount: 8, commentCount: 2 },
  { id: 'p4', userId: 'haru', tag: 'harvest', body: '収穫できました🎉 発送準備中です。梱包も丁寧にして今日中に送ります。スムーズな取引をありがとうございました！', createdAt: '昨日', likeCount: 31, commentCount: 7 },
];

export const boardTagFilters: { key: 'all' | BoardTag; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'harvest', label: '交換報告' },
  { key: 'question', label: '質問' },
  { key: 'chat', label: '雑談' },
  { key: 'notice', label: 'お知らせ' },
];

/** 人気のタグ（トレンド）。 */
export const trendingTags = ['#交換成立', '#ゲーム', '#はじめました', '#カメラ', '#梱包丁寧'];

export type BoardComment = { id: string; userId: string; body: string; createdAt: string };
export const boardComments: Record<string, BoardComment[]> = {
  p1: [
    { id: 'c1', userId: 'takusan', body: 'おめでとうございます！自分も頑張ります🌱', createdAt: '8分前' },
    { id: 'c2', userId: 'yu', body: '交換の輪、いいですね！', createdAt: '5分前' },
    { id: 'c3', userId: 'metan', body: 'わたしも今日はじめました〜', createdAt: '2分前' },
  ],
};

export type NotificationType =
  | 'watered' | 'harvested' | 'shipped' | 'received' | 'message'
  | 'sapling'         // 収穫の輪から外れて、自分の商品が新しいタネ（苗木）になった
  | 'board_comment'   // 掲示板の投稿へのコメント
  | 'item_comment'    // 自分の出品へのコメント（2026-08-12 に掲示板から分離）
  | 'ring_completed'; // 玉突きの輪が一周した（お祝い）
export type Notif = {
  id: string;
  type: NotificationType;
  body: string;
  createdAt: string;
  read?: boolean;
  /** 保存した通知（一覧の上に固定される） */
  saved?: boolean;
  today?: boolean;
  actorId?: string; // 相手のアバター表示用
  /**
   * 遷移先の対象ID（要件定義 第11章「通知タップで該当ページに遷移する」）。
   * type ごとに指す先が違う：
   *   watered / harvested → 商品ID、shipped / received / message → 取引ID、
   *   board_comment → 投稿ID
   */
  relatedId?: string;
  /** 関係する商品の写真（実データのみ） */
  imageUrl?: string;
  actorName?: string;
  actorAvatar?: string;
};

// body は「{actor}さん」に続く形で書く（先頭に助詞を含める）
export const notifications: Notif[] = [
  { id: 'n1', type: 'watered', body: 'があなたの「香水」に水やりしました', relatedId: 'perfume', createdAt: '5分前', today: true, actorId: 'takusan' },
  { id: 'n2', type: 'harvested', body: 'が「コーヒーメーカー」の輪を収穫しました。発送をお願いします', relatedId: 'coffee', createdAt: '30分前', today: true, actorId: 'yu' },
  { id: 'n3', type: 'message', body: 'からメッセージが届きました', relatedId: 't1', createdAt: '1時間前', read: true, today: true, actorId: 'sakura' },
  { id: 'n4', type: 'shipped', body: 'が商品を発送しました。到着までお待ちください', relatedId: 't1', createdAt: '3時間前', read: true, today: true, actorId: 'yu' },
  { id: 'n5', type: 'board_comment', body: 'があなたの投稿にコメントしました', relatedId: 'p1', createdAt: '昨日', read: true, actorId: 'haru' },
  { id: 'n6', type: 'received', body: 'が受け取りを完了しました。評価をお願いします', relatedId: 't2', createdAt: '2日前', read: true, actorId: 'sakura' },
];

export const NOTIF_ICON: Record<NotificationType, string> = {
  watered: 'water',
  harvested: 'leaf',
  sapling: 'flower',
  shipped: 'cube',
  received: 'checkmark-done',
  message: 'chatbubble-ellipses',
  board_comment: 'chatbox',
  item_comment: 'pricetag',
  ring_completed: 'trophy',
};

/** 取引（玉突きの1ペア）。dir=receive:受け取る（緑） / send:送る（オレンジ） */
export type Trade = {
  id: string;
  dir: 'receive' | 'send';
  itemId: string;
  counterpartId: string; // 相手
  status: 'pending' | 'shipped' | 'received';
  shippedAt?: string;
};

export const trades: Trade[] = [
  { id: 't1', dir: 'receive', itemId: 'switch', counterpartId: 'takusan', status: 'shipped', shippedAt: '7/15' },
  { id: 't2', dir: 'receive', itemId: 'airpods', counterpartId: 'haru', status: 'pending' },
  { id: 't3', dir: 'send', itemId: 'coffee', counterpartId: 'yu', status: 'pending' },
  { id: 't4', dir: 'send', itemId: 'perfume', counterpartId: 'sakura', status: 'shipped', shippedAt: '7/14' },
];

export type ChatMsg = { id: string; mine: boolean; body: string; time: string; system?: boolean };
export const chatByTrade: Record<string, ChatMsg[]> = {
  t1: [
    { id: 'm0', mine: false, body: '収穫が成立しました。発送・受け取りを進めましょう🌱', time: '', system: true },
    { id: 'm1', mine: false, body: 'こんにちは！本日発送しました。追跡番号は追ってお送りします。', time: '9:24' },
    { id: 'm2', mine: true, body: 'ありがとうございます！到着を楽しみにしています😊', time: '9:31' },
    { id: 'm3', mine: false, body: 'よろしくお願いします！', time: '9:33' },
  ],
};

/** 商品詳細のコメント（SPEC：商品詳細にコメント機能）。 */
export type ItemComment = { id: string; userId: string; body: string; createdAt: string };
export const itemComments: Record<string, ItemComment[]> = {
  switch: [
    { id: 'ic1', userId: 'yu', body: '付属品は全部そろっていますか？ジョイコンの状態も知りたいです！', createdAt: '30分前' },
    { id: 'ic2', userId: 'takusan', body: 'はい、付属品すべて揃っています。ジョイコンのドリフトもありません😊', createdAt: '20分前' },
    { id: 'ic3', userId: 'haru', body: '水やりしました！交換できたら嬉しいです🌱', createdAt: '5分前' },
  ],
};
export function getItemComments(id: string): ItemComment[] {
  return itemComments[id] ?? [];
}

export function tradeItem(t: Trade): MockItem | undefined {
  return getItem(t.itemId);
}
export function tradeUser(t: Trade) {
  return getUser(t.counterpartId);
}
