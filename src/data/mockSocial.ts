/** 掲示板・通知・取引・評価のモックデータ。 */
import { getUser, getItem, MockItem } from './mock';

export type BoardPost = {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  liked?: boolean;
};

export const boardPosts: BoardPost[] = [
  { id: 'p1', userId: 'sakura', body: 'はじめてぐんぐんで交換成立しました🌱 わらしべ長者みたいで楽しい！みなさんの水やり待ってます〜', createdAt: '10分前', likeCount: 24, commentCount: 5, liked: true },
  { id: 'p2', userId: 'takusan', body: 'Nintendo Switchの種を植えました。ゲーム好きな方、ぜひ水やりしてください！', createdAt: '1時間前', likeCount: 12, commentCount: 3 },
  { id: 'p3', userId: 'yu', body: 'カメラと交換できるものを探しています。おすすめの出品があれば教えてください📷', createdAt: '3時間前', likeCount: 8, commentCount: 2 },
  { id: 'p4', userId: 'haru', body: '収穫できました🎉 発送準備中です。スムーズな取引ありがとうございました！', createdAt: '昨日', likeCount: 31, commentCount: 7 },
];

export type BoardComment = { id: string; userId: string; body: string; createdAt: string };
export const boardComments: Record<string, BoardComment[]> = {
  p1: [
    { id: 'c1', userId: 'takusan', body: 'おめでとうございます！自分も頑張ります🌱', createdAt: '8分前' },
    { id: 'c2', userId: 'yu', body: '交換の輪、いいですね！', createdAt: '5分前' },
    { id: 'c3', userId: 'metan', body: 'わたしも今日はじめました〜', createdAt: '2分前' },
  ],
};

export type NotificationType = 'watered' | 'harvested' | 'shipped' | 'received' | 'message' | 'board_comment';
export type Notif = {
  id: string;
  type: NotificationType;
  body: string;
  createdAt: string;
  read?: boolean;
};

export const notifications: Notif[] = [
  { id: 'n1', type: 'watered', body: 'たくさんさんがあなたの「香水」に水やりしました', createdAt: '5分前' },
  { id: 'n2', type: 'harvested', body: '「コーヒーメーカー」が収穫されました。発送をお願いします', createdAt: '30分前' },
  { id: 'n3', type: 'message', body: 'さくらさんからメッセージが届きました', createdAt: '1時間前', read: true },
  { id: 'n4', type: 'shipped', body: 'ゆうさんが商品を発送しました', createdAt: '3時間前', read: true },
  { id: 'n5', type: 'board_comment', body: 'あなたの投稿にコメントがつきました', createdAt: '昨日', read: true },
];

export const NOTIF_ICON: Record<NotificationType, string> = {
  watered: 'water',
  harvested: 'leaf',
  shipped: 'cube',
  received: 'checkmark-done',
  message: 'chatbubble-ellipses',
  board_comment: 'chatbox',
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

export function tradeItem(t: Trade): MockItem | undefined {
  return getItem(t.itemId);
}
export function tradeUser(t: Trade) {
  return getUser(t.counterpartId);
}
