/**
 * モック用ダミーデータ。
 * Phase 8（supabase/seed.sql）と同じ世界観：ユーザー6人・商品12件。
 * ネイティブ化の際は各 feature の api.ts の戻り値をこの型に合わせる想定。
 */

export type MockUser = {
  id: string;
  nickname: string;
  avatar: string;
  ratingCount: number;
  itemCount: number;
};

export type MockItem = {
  id: string;
  name: string;
  category: string;
  condition: string;
  description: string;
  image: string;
  images: string[];
  ownerId: string;
  waterCount: number; // 水やり数（＝子ノード数）
  likeCount: number;
  treeCount: number; // 木全体の商品数（同じ root_id）
  status: 'growing' | 'trading' | 'completed';
  /** ローカル商品画像（assets/products/）。あれば remote より優先。 */
  local?: number;
  localImages?: number[];
};

/**
 * 商品写真スロット（assets/products/）。
 * ★実写真を同じファイル名で差し替えれば、ここを変えずにアプリ全体へ反映される。
 */
const P = {
  switch: require('../../assets/products/switch.jpg') as number,
  books: require('../../assets/products/books.jpg') as number,
  airpods: require('../../assets/products/airpods.jpg') as number,
  controller: require('../../assets/products/controller.jpg') as number,
  iphone: require('../../assets/products/iphone.jpg') as number,
  bag: require('../../assets/products/bag.jpg') as number,
};

export const users: Record<string, MockUser> = {
  takusan: { id: 'takusan', nickname: 'たくさん', avatar: 'https://i.pravatar.cc/150?img=12', ratingCount: 230, itemCount: 35 },
  sakura: { id: 'sakura', nickname: 'さくら', avatar: 'https://i.pravatar.cc/150?img=45', ratingCount: 188, itemCount: 22 },
  yu: { id: 'yu', nickname: 'ゆう', avatar: 'https://i.pravatar.cc/150?img=33', ratingCount: 96, itemCount: 14 },
  haru: { id: 'haru', nickname: 'はる', avatar: 'https://i.pravatar.cc/150?img=5', ratingCount: 54, itemCount: 9 },
  metan: { id: 'metan', nickname: 'めたん', avatar: 'https://i.pravatar.cc/150?img=20', ratingCount: 41, itemCount: 6 },
  kenta: { id: 'kenta', nickname: 'けんた', avatar: 'https://i.pravatar.cc/150?img=15', ratingCount: 12, itemCount: 3 },
};

const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/800`;

export const items: MockItem[] = [
  {
    id: 'switch',
    name: 'Nintendo Switch',
    category: 'ゲーム・おもちゃ',
    condition: '目立った傷や汚れなし',
    description: '2年ほど使用しました。動作は良好で、付属品はすべて揃っています。箱も保管してあります。喫煙者・ペットはいません。',
    image: img('switch1'),
    images: [img('switch1'), img('switch2'), img('switch3')],
    local: P.switch,
    localImages: [P.switch],
    ownerId: 'takusan',
    waterCount: 12,
    likeCount: 23,
    treeCount: 12,
    status: 'growing',
  },
  { id: 'lv-bag', name: 'ルイヴィトン バッグ', category: 'レディース', condition: 'やや傷や汚れあり', description: '数年前に購入したモノグラムのバッグです。使用感はありますが、まだまだ使えます。', image: img('bag1'), images: [img('bag1'), img('bag2')], local: P.bag, localImages: [P.bag], ownerId: 'sakura', waterCount: 8, likeCount: 41, treeCount: 8, status: 'growing' },
  { id: 'iphone15', name: 'iPhone 15', category: 'スマホ・家電', condition: '目立った傷や汚れなし', description: 'バッテリー最大容量92%。画面割れなし。初期化して発送します。', image: img('phone1'), images: [img('phone1'), img('phone2')], local: P.iphone, localImages: [P.iphone], ownerId: 'yu', waterCount: 5, likeCount: 30, treeCount: 5, status: 'growing' },
  { id: 'airpods', name: 'AirPods Pro', category: 'スマホ・家電', condition: '目立った傷や汚れなし', description: '第2世代。ケース・イヤーチップ揃っています。', image: img('airpods1'), images: [img('airpods1')], local: P.airpods, localImages: [P.airpods], ownerId: 'haru', waterCount: 3, likeCount: 18, treeCount: 3, status: 'growing' },
  { id: 'controller', name: 'ワイヤレスコントローラー', category: 'ゲーム・おもちゃ', condition: '目立った傷や汚れなし', description: '数回使用のみ。動作確認済み、箱・ケーブル付き。', image: img('controller1'), images: [img('controller1')], local: P.controller, localImages: [P.controller], ownerId: 'kenta', waterCount: 5, likeCount: 22, treeCount: 5, status: 'growing' },
  { id: 'books', name: '文庫本 まとめ売り', category: '本・音楽', condition: '目立った傷や汚れなし', description: '小説を中心に6冊セット。書き込みなし、状態良好です。', image: img('books1'), images: [img('books1')], local: P.books, localImages: [P.books], ownerId: 'sakura', waterCount: 3, likeCount: 16, treeCount: 3, status: 'growing' },
  { id: 'wallet', name: 'ブランド財布', category: 'メンズ', condition: '未使用に近い', description: 'いただきものですが使わないため出品します。', image: img('wallet1'), images: [img('wallet1')], ownerId: 'takusan', waterCount: 2, likeCount: 9, treeCount: 2, status: 'growing' },
  { id: 'watch', name: '腕時計', category: 'メンズ', condition: '目立った傷や汚れなし', description: 'シンプルなアナログ時計。電池交換済み。', image: img('watch1'), images: [img('watch1')], ownerId: 'sakura', waterCount: 4, likeCount: 14, treeCount: 4, status: 'growing' },
  { id: 'perfume', name: '香水', category: 'コスメ・美容', condition: '未使用に近い', description: '数回使用のみ。残量9割ほど。', image: img('perfume1'), images: [img('perfume1')], ownerId: 'metan', waterCount: 1, likeCount: 7, treeCount: 1, status: 'growing' },
  { id: 'sneaker', name: 'スニーカー', category: 'メンズ', condition: 'やや傷や汚れあり', description: '27cm。数回着用。', image: img('sneaker1'), images: [img('sneaker1')], ownerId: 'kenta', waterCount: 2, likeCount: 11, treeCount: 2, status: 'growing' },
  { id: 'coffee', name: 'コーヒーメーカー', category: '家電', condition: '目立った傷や汚れなし', description: '全自動タイプ。動作確認済み。', image: img('coffee1'), images: [img('coffee1')], ownerId: 'metan', waterCount: 3, likeCount: 15, treeCount: 3, status: 'growing' },
  { id: 'camera', name: 'ミラーレスカメラ', category: 'スマホ・家電', condition: '目立った傷や汚れなし', description: 'レンズキット付き。シャッター回数少なめ。', image: img('camera1'), images: [img('camera1')], ownerId: 'yu', waterCount: 6, likeCount: 28, treeCount: 6, status: 'growing' },
  { id: 'speaker', name: 'ワイヤレススピーカー', category: '家電', condition: '未使用に近い', description: '防水対応。箱付き。', image: img('speaker1'), images: [img('speaker1')], ownerId: 'haru', waterCount: 2, likeCount: 10, treeCount: 2, status: 'growing' },
  { id: 'giftcard', name: 'ギフト券', category: 'チケット', condition: '新品・未使用', description: '5,000円分。有効期限まだあります。', image: img('gift1'), images: [img('gift1')], ownerId: 'metan', waterCount: 4, likeCount: 19, treeCount: 4, status: 'growing' },
];

/** ホーム「みんなの種」＝ parent_id is null かつ growing 相当 */
export const seedItems = items;

/** 商品カルーセル用の画像ソース配列（ローカルがあれば優先）。 */
export function itemImageSources(item: MockItem): (number | { uri: string })[] {
  if (item.localImages && item.localImages.length) return item.localImages;
  return item.images.map((u) => ({ uri: u }));
}

export function getItem(id: string): MockItem | undefined {
  return items.find((i) => i.id === id);
}
export function getUser(id: string): MockUser {
  return users[id] ?? { id, nickname: '名無し', avatar: '', ratingCount: 0, itemCount: 0 };
}

/** ログイン中ユーザー（モック）：めたん、肥料400 */
export const currentUser = {
  ...users.metan,
  fertilizer: 400,
  dailyBonus: 40,
};

/** ぐんぐんの楽しみ方 3ステップ */
export const howToSteps = [
  { key: 'plant', title: '種を植える', desc: 'いらないものを出品', icon: 'sprout' },
  { key: 'water', title: '水やりする', desc: '欲しいものに交換希望', icon: 'water' },
  { key: 'harvest', title: '収穫する', desc: '輪になって交換成立', icon: 'harvest' },
] as const;

export const categories = [
  'レディース', 'メンズ', 'スマホ・家電', '家電', 'ゲーム・おもちゃ',
  'コスメ・美容', 'インテリア', '本・音楽', 'チケット', 'その他',
];

export const conditions = [
  '新品・未使用', '未使用に近い', '目立った傷や汚れなし', 'やや傷や汚れあり', '全体的に状態が悪い',
];
