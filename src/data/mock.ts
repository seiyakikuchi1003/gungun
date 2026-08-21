/**
 * モック用ダミーデータ。
 * Phase 8（supabase/seed.sql）と同じ世界観：ユーザー6人・商品12件。
 * ネイティブ化の際は各 feature の api.ts の戻り値をこの型に合わせる想定。
 */

export type MockUser = {
  id: string;
  nickname: string;
  avatar: string | number; // number = ローカル画像（require）
  /** 平均評価。評価が1件も無ければ null（星を光らせない） */
  ratingAvg?: number | null;
  ratingCount: number;
  itemCount: number;
};

// ユーザーアバター。data URI 文字列で埋め込み（プレビュー/実機で確実に表示）。
// 画像は assets/avatars/*.png が元。差し替え時は同PNGを更新して avatarData を再生成。
import { avatarData as A } from './avatarData';

export type MockItem = {
  id: string;
  name: string;
  category: string;
  condition: string;
  description: string;
  image: string;
  images: string[];
  ownerId: string;
  waterCount: number; // 水やり数（＝直接の子ノード数）
  likeCount: number;
  treeCount: number; // 木全体の商品数（同じ root_id）
  /** 自分がいいねしているか（item_cards.liked。モックでは常に false） */
  liked?: boolean;
  status: 'growing' | 'trading' | 'completed';
  /** ツリー構造（SPEC 第2章）。種は parentId=null / rootId=自分 / depth=0。 */
  parentId: string | null; // 水やり先（親商品）。NULL なら種（root）
  rootId: string; // 所属する木の根。種なら自分自身
  depth: number; // 根からの深さ（種=0）
  /** 出品された日時（ISO）。NEW の判定に使う。モックでは undefined */
  createdAt?: string;
  /** ローカル商品画像（assets/products/）。あれば remote より優先。 */
  local?: number;
  localImages?: number[];
};

/** 商品の生データ（ツリー項目は省略可能。未指定なら「種」として正規化）。 */
type RawItem = Omit<MockItem, 'parentId' | 'rootId' | 'depth'> & {
  parentId?: string | null;
  rootId?: string;
  depth?: number;
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
  wallet: require('../../assets/products/wallet.jpg') as number,
  watch: require('../../assets/products/watch.jpg') as number,
  perfume: require('../../assets/products/perfume.jpg') as number,
  sneaker: require('../../assets/products/sneaker.jpg') as number,
  coffee: require('../../assets/products/coffee.jpg') as number,
  camera: require('../../assets/products/camera.jpg') as number,
  speaker: require('../../assets/products/speaker.jpg') as number,
  giftcard: require('../../assets/products/giftcard.jpg') as number,
};

export const users: Record<string, MockUser> = {
  takusan: { id: 'takusan', nickname: 'たくさん', avatar: A.takusan, ratingCount: 230, itemCount: 35 },
  sakura: { id: 'sakura', nickname: 'さくら', avatar: A.sakura, ratingCount: 188, itemCount: 22 },
  yu: { id: 'yu', nickname: 'ゆう', avatar: A.yu, ratingCount: 96, itemCount: 14 },
  haru: { id: 'haru', nickname: 'はる', avatar: A.haru, ratingCount: 54, itemCount: 9 },
  metan: { id: 'metan', nickname: 'めたん', avatar: A.metan, ratingCount: 41, itemCount: 6 },
  kenta: { id: 'kenta', nickname: 'けんた', avatar: A.kenta, ratingCount: 12, itemCount: 3 },
};

const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/800`;

const rawItems: RawItem[] = [
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
  { id: 'wallet', name: 'ブランド財布', category: 'メンズ', condition: '未使用に近い', description: 'いただきものですが使わないため出品します。', image: img('wallet1'), images: [img('wallet1')], local: P.wallet, localImages: [P.wallet], ownerId: 'takusan', waterCount: 2, likeCount: 9, treeCount: 2, status: 'growing' },
  { id: 'watch', name: '腕時計', category: 'メンズ', condition: '目立った傷や汚れなし', description: 'シンプルなアナログ時計。電池交換済み。', image: img('watch1'), images: [img('watch1')], local: P.watch, localImages: [P.watch], ownerId: 'sakura', waterCount: 4, likeCount: 14, treeCount: 4, status: 'growing' },
  { id: 'perfume', name: '香水', category: 'コスメ・美容', condition: '未使用に近い', description: '数回使用のみ。残量9割ほど。', image: img('perfume1'), images: [img('perfume1')], local: P.perfume, localImages: [P.perfume], ownerId: 'metan', waterCount: 1, likeCount: 7, treeCount: 1, status: 'growing' },
  { id: 'sneaker', name: 'スニーカー', category: 'メンズ', condition: 'やや傷や汚れあり', description: '27cm。数回着用。', image: img('sneaker1'), images: [img('sneaker1')], local: P.sneaker, localImages: [P.sneaker], ownerId: 'kenta', waterCount: 2, likeCount: 11, treeCount: 2, status: 'growing' },
  { id: 'coffee', name: 'コーヒーメーカー', category: '家電', condition: '目立った傷や汚れなし', description: '全自動タイプ。動作確認済み。', image: img('coffee1'), images: [img('coffee1')], local: P.coffee, localImages: [P.coffee], ownerId: 'metan', waterCount: 3, likeCount: 15, treeCount: 3, status: 'growing' },
  { id: 'camera', name: 'ミラーレスカメラ', category: 'スマホ・家電', condition: '目立った傷や汚れなし', description: 'レンズキット付き。シャッター回数少なめ。', image: img('camera1'), images: [img('camera1')], local: P.camera, localImages: [P.camera], ownerId: 'yu', waterCount: 6, likeCount: 28, treeCount: 6, status: 'growing' },
  { id: 'speaker', name: 'ワイヤレススピーカー', category: '家電', condition: '未使用に近い', description: '防水対応。箱付き。', image: img('speaker1'), images: [img('speaker1')], local: P.speaker, localImages: [P.speaker], ownerId: 'haru', waterCount: 3, likeCount: 10, treeCount: 7, status: 'growing' },
  { id: 'giftcard', name: 'ギフト券', category: 'チケット', condition: '新品・未使用', description: '5,000円分。有効期限まだあります。', image: img('gift1'), images: [img('gift1')], local: P.giftcard, localImages: [P.giftcard], ownerId: 'metan', waterCount: 4, likeCount: 19, treeCount: 4, status: 'growing' },

  // ── デモ用の「育った木」＝水やりの連鎖（わらしべの鎖）──────────────
  // ワイヤレススピーカー（はる）を起点に、水やり＝出品が連鎖してつながっている。
  //   speaker(はる)
  //   ├─ キャンバストートバッグ(めたん)          … 深さ1
  //   ├─ マグカップ(さくら)                       … 深さ1
  //   │   └─ ミラーレスカメラ(ゆう)               … 深さ2
  //   │       └─ 腕時計(たくさん)                 … 深さ3
  //   └─ ギフト券(けんた)                          … 深さ1
  //       └─ 文庫本セット(さくら)                 … 深さ2
  // これで「A→B→C→D と交換の輪がつながっていく」連鎖が一目で分かる。
  { id: 'w-tote', name: 'キャンバストートバッグ', category: 'レディース', condition: '目立った傷や汚れなし', description: '無地のキャンバストート。数回使用のみで、大きな汚れもありません。', image: img('tote1'), images: [img('tote1')], local: P.bag, localImages: [P.bag], ownerId: 'metan', waterCount: 0, likeCount: 4, treeCount: 0, status: 'growing', parentId: 'speaker', rootId: 'speaker', depth: 1 },
  { id: 'w-mug', name: 'マグカップ', category: 'インテリア', condition: '未使用に近い', description: 'いただきもののマグカップ。使わないのでお譲りします。', image: img('mug1'), images: [img('mug1')], local: P.coffee, localImages: [P.coffee], ownerId: 'sakura', waterCount: 1, likeCount: 3, treeCount: 0, status: 'growing', parentId: 'speaker', rootId: 'speaker', depth: 1 },
  { id: 'w-cam', name: 'ミラーレスカメラ', category: 'スマホ・家電', condition: '目立った傷や汚れなし', description: 'マグカップと交換希望で水やりしました。レンズキット付き。', image: img('cam2'), images: [img('cam2')], local: P.camera, localImages: [P.camera], ownerId: 'yu', waterCount: 1, likeCount: 6, treeCount: 0, status: 'growing', parentId: 'w-mug', rootId: 'speaker', depth: 2 },
  { id: 'w-watch2', name: '腕時計', category: 'メンズ', condition: '未使用に近い', description: 'カメラが欲しくて水やり。電池交換済みです。', image: img('watch2'), images: [img('watch2')], local: P.watch, localImages: [P.watch], ownerId: 'takusan', waterCount: 0, likeCount: 5, treeCount: 0, status: 'growing', parentId: 'w-cam', rootId: 'speaker', depth: 3 },
  { id: 'w-gift', name: 'ギフト券 5,000円分', category: 'チケット', condition: '新品・未使用', description: '有効期限まだあります。', image: img('gift2'), images: [img('gift2')], local: P.giftcard, localImages: [P.giftcard], ownerId: 'kenta', waterCount: 1, likeCount: 2, treeCount: 0, status: 'growing', parentId: 'speaker', rootId: 'speaker', depth: 1 },
  { id: 'w-books2', name: '文庫本セット', category: '本・音楽', condition: '目立った傷や汚れなし', description: '人気作家の文庫本8冊セット。', image: img('books2'), images: [img('books2')], local: P.books, localImages: [P.books], ownerId: 'sakura', waterCount: 0, likeCount: 3, treeCount: 0, status: 'growing', parentId: 'w-gift', rootId: 'speaker', depth: 2 },

  // ── 自分（めたん）が植えたタネに集まった水やり ──────────────────
  // 収穫タブ「あなたの森」が空っぽに見えないように、通知の内容と辻褄が合う形で
  // 実データとして子をぶら下げておく（通知 n1=香水/たくさん、n2=コーヒーメーカー/ゆう）。
  //   香水(めたん)        └ スニーカー(たくさん)
  //   コーヒーメーカー(めたん) ├ ミラーレスカメラ(ゆう) └ 腕時計(けんた) └ 文庫本(さくら)
  //   ギフト券(めたん)     ├ AirPods(はる)  └ ブランド財布(さくら)
  { id: 'w-sneaker', name: 'スニーカー', category: 'メンズ', condition: '目立った傷や汚れなし', description: '27cm。香水と交換したくて水やりしました。数回着用のみです。', image: img('sneaker2'), images: [img('sneaker2')], local: P.sneaker, localImages: [P.sneaker], ownerId: 'takusan', waterCount: 0, likeCount: 6, treeCount: 0, status: 'growing', parentId: 'perfume', rootId: 'perfume', depth: 1 },

  { id: 'w-cam3', name: 'ミラーレスカメラ', category: 'スマホ・家電', condition: '目立った傷や汚れなし', description: 'コーヒーメーカーが欲しくて水やり。レンズキット付きです。', image: img('cam3'), images: [img('cam3')], local: P.camera, localImages: [P.camera], ownerId: 'yu', waterCount: 0, likeCount: 9, treeCount: 0, status: 'growing', parentId: 'coffee', rootId: 'coffee', depth: 1 },
  { id: 'w-watch3', name: '腕時計', category: 'メンズ', condition: '未使用に近い', description: 'シンプルなアナログ時計。電池交換済みです。', image: img('watch3'), images: [img('watch3')], local: P.watch, localImages: [P.watch], ownerId: 'kenta', waterCount: 0, likeCount: 4, treeCount: 0, status: 'growing', parentId: 'coffee', rootId: 'coffee', depth: 1 },
  { id: 'w-books3', name: '文庫本 まとめ売り', category: '本・音楽', condition: '目立った傷や汚れなし', description: '腕時計と交換希望です。小説6冊セット、書き込みなし。', image: img('books3'), images: [img('books3')], local: P.books, localImages: [P.books], ownerId: 'sakura', waterCount: 0, likeCount: 3, treeCount: 0, status: 'growing', parentId: 'w-watch3', rootId: 'coffee', depth: 2 },

  { id: 'w-airpods2', name: 'AirPods Pro', category: 'スマホ・家電', condition: '目立った傷や汚れなし', description: '第2世代。ケース・イヤーチップ揃っています。', image: img('airpods2'), images: [img('airpods2')], local: P.airpods, localImages: [P.airpods], ownerId: 'haru', waterCount: 0, likeCount: 12, treeCount: 0, status: 'growing', parentId: 'giftcard', rootId: 'giftcard', depth: 1 },
  { id: 'w-wallet2', name: 'ブランド財布', category: 'レディース', condition: '未使用に近い', description: 'いただきものですが使わないためお譲りします。', image: img('wallet2'), images: [img('wallet2')], local: P.wallet, localImages: [P.wallet], ownerId: 'sakura', waterCount: 0, likeCount: 7, treeCount: 0, status: 'growing', parentId: 'giftcard', rootId: 'giftcard', depth: 1 },
];

/**
 * ツリー項目を正規化：省略された商品は「種（root）」として parentId=null / rootId=自分 / depth=0。
 * ここが SPEC 第2章「items 1本で森を表現」の土台。
 */
export const items: MockItem[] = rawItems.map((it) => ({
  ...it,
  parentId: it.parentId ?? null,
  rootId: it.rootId ?? it.id,
  depth: it.depth ?? 0,
}));

/** ホーム「みんなの種」＝ parentId is null（＝木の根）だけ */
export const seedItems = items.filter((i) => i.parentId === null);

/** 商品カルーセル用の画像ソース配列（ローカルがあれば優先）。 */
export function itemImageSources(item: MockItem): (number | { uri: string })[] {
  if (item.localImages && item.localImages.length) return item.localImages;
  return item.images.map((u) => ({ uri: u }));
}

export function getItem(id: string): MockItem | undefined {
  return items.find((i) => i.id === id);
}

// ── ツリー操作（純粋関数）──────────────────────────────────
// 与えられた items 配列に対して親子関係を辿る。ストア・画面から共用。
// ネイティブ化時は SPEC 第3章の Postgres 関数（get_ancestors 等）に対応。

/** 直接の子ノード（＝この商品に水やりした商品たち）。 */
export function childrenOf(pool: MockItem[], id: string): MockItem[] {
  return pool.filter((i) => i.parentId === id);
}

/** 同じ木（root_id）に属する全商品。 */
export function treeItems(pool: MockItem[], rootId: string): MockItem[] {
  return pool.filter((i) => i.rootId === rootId);
}

/**
 * 木のイラストの見た目の段階だけを返す（TreeCanvas 専用）。
 *
 * 2026-07-28 MTG（めたん様）：
 *   「大きな木」「MAX まで育ちました」という表現は、1つのタネにいくつでも
 *   商品が結びつく以上、何を基準に大小を言っているのかが不明瞭なので無くす。
 *   ただし木の図そのものは残す。
 * → ラベル・絵文字・「次の段階まであとN」といった大小の表現はすべて廃止し、
 *   ここではイラストの描き分けに使う段階だけを返す。UI に文言は出さない。
 */
export type TreeVisual = { stage: 0 | 1 | 2 | 3 };
export function treeVisual(size: number): TreeVisual {
  if (size >= 6) return { stage: 3 };
  if (size >= 4) return { stage: 2 };
  if (size >= 2) return { stage: 1 };
  return { stage: 0 };
}

/** target 自身から root までの祖先ライン（target を含む）。 */
export function ancestorsOf(pool: MockItem[], id: string): MockItem[] {
  const line: MockItem[] = [];
  let cur = pool.find((i) => i.id === id);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    line.push(cur);
    guard.add(cur.id);
    if (cur.parentId == null) break;
    cur = pool.find((i) => i.id === cur!.parentId);
  }
  return line; // [target, ..., root]
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
// desc の改行は表示幅に合わせた意図的なもの（1文字だけの折り返しを防ぐ）
export const howToSteps = [
  { key: 'plant', title: '種を植える', desc: 'いらないものを\n出品', icon: 'sprout' },
  { key: 'water', title: '水やりする', desc: '欲しいものに\n交換希望', icon: 'water' },
  { key: 'harvest', title: '収穫する', desc: '輪になって\n交換成立', icon: 'harvest' },
] as const;

export const categories = [
  'レディース', 'メンズ', 'スマホ・家電', '家電', 'ゲーム・おもちゃ',
  'コスメ・美容', 'インテリア', '本・音楽', 'チケット', 'その他',
];

export const conditions = [
  '新品・未使用', '未使用に近い', '目立った傷や汚れなし', 'やや傷や汚れあり', '全体的に状態が悪い',
];
