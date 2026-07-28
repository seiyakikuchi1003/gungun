-- ぐんぐん デモデータ（Supabase SQL Editor から service_role で流す用）
--
-- supabase/seed.sql は plant_seed() / water() RPC を経由する設計だが、
-- 0006 で「本人以外は出品できない」チェックを入れたため、
-- SQL Editor（auth.uid() = null）から呼ぶと弾かれる。
--
-- こちらは INSERT 直挿し版。トリガ set_item_tree() が root_id/depth を
-- 自動でセットするので、木の親子付けは変わらない。
-- 何度実行しても増えないよう、既存データを一度消してから入れ直す。

-- ── デモ用ユーザーの固定UUID ────────────────────────────────
-- 実運用のユーザーと分離するため、prefix を 000000... で揃える
--   はる      = ...a1
--   めたん    = ...a2
--   さくら    = ...a3
--   ゆう      = ...a4
--   たくさん  = ...a5
--   けんた    = ...a6

-- 一度消す（依存を持つ子テーブルは CASCADE で連鎖）
do $$
declare
  demo_ids uuid[] := array[
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-0000000000a4',
    '00000000-0000-0000-0000-0000000000a5',
    '00000000-0000-0000-0000-0000000000a6'
  ]::uuid[];
begin
  -- fertilizer_ledger.related_item_id は items を参照している（cascade なし）ので
  -- items を消す前にリンクを外す。デモユーザー分だけ NULL 化する。
  update fertilizer_ledger set related_item_id = null
   where user_id = any(demo_ids) or related_item_id in (select id from items where user_id = any(demo_ids));

  delete from items where user_id = any(demo_ids);
  delete from board_posts where user_id = any(demo_ids);
  -- auth.users を消せば profiles / fertilizer_ledger 等は cascade で消える
  delete from auth.users where id = any(demo_ids);
end $$;

-- ── ユーザー6人 ────────────────────────────────────────────
-- 必須列のみ。残りは Supabase 側の既定値に任せる。
-- handle_new_user トリガが raw_user_meta_data.nickname を見て profiles を作る。
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'haru@example.com',    crypt('password', gen_salt('bf')), now(), '{"nickname":"はる"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'metan@example.com',   crypt('password', gen_salt('bf')), now(), '{"nickname":"めたん"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'sakura@example.com',  crypt('password', gen_salt('bf')), now(), '{"nickname":"さくら"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'yu@example.com',      crypt('password', gen_salt('bf')), now(), '{"nickname":"ゆう"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'takusan@example.com', crypt('password', gen_salt('bf')), now(), '{"nickname":"たくさん"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'kenta@example.com',   crypt('password', gen_salt('bf')), now(), '{"nickname":"けんた"}');

-- profiles はトリガ handle_new_user が作る。肥料を追加で盛る
update profiles set fertilizer = 2000 where id in (
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4',
  '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a6'
);

-- ── スピーカーの木 ─────────────────────────────────────────
-- items 直挿し。root_id / depth はトリガが埋める。

-- 種：はる → ワイヤレススピーカー
insert into items (id, user_id, name, description, category, condition) values
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000a1',
   'ワイヤレススピーカー', '防水対応。箱付き。', '家電', '未使用に近い');

-- depth 1
insert into items (id, user_id, name, description, category, condition, parent_id) values
  ('b1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000000a2',
   'キャンバストートバッグ', '無地のキャンバストート。数回使用のみ。', 'レディース', '目立った傷や汚れなし',
   'b1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000a3',
   'マグカップ', 'いただきもの。使わないのでお譲りします。', 'インテリア', '未使用に近い',
   'b1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-0000000000a6',
   'ギフト券 5,000円分', '有効期限まだあります。', 'チケット', '新品・未使用',
   'b1000000-0000-4000-8000-000000000001');

-- depth 2
insert into items (id, user_id, name, description, category, condition, parent_id) values
  ('b1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-0000000000a4',
   'ミラーレスカメラ', 'レンズキット付き。シャッター回数少なめ。', 'スマホ・家電', '目立った傷や汚れなし',
   'b1000000-0000-4000-8000-000000000003'),
  ('b1000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-0000000000a3',
   '文庫本セット', '人気作家の文庫本8冊セット。', '本・音楽', '目立った傷や汚れなし',
   'b1000000-0000-4000-8000-000000000004');

-- depth 3
insert into items (id, user_id, name, description, category, condition, parent_id) values
  ('b1000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-0000000000a5',
   '腕時計', '電池交換済み。カメラが欲しくて水やり。', 'メンズ', '未使用に近い',
   'b1000000-0000-4000-8000-000000000005');

-- 別の独立した種（一覧に並べる用）
insert into items (id, user_id, name, description, category, condition) values
  ('b1000000-0000-4000-8000-000000000010', '00000000-0000-0000-0000-0000000000a6',
   'Nintendo Switch', '本体＋ドック。動作確認済み。', 'ゲーム・おもちゃ', 'やや傷や汚れあり'),
  ('b1000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-0000000000a3',
   '香水（未開封）', '頂き物ですが好みに合わず。', 'コスメ', '新品・未使用'),
  ('b1000000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-0000000000a1',
   'AirPods Pro（第2世代）', '純正ケース付き。動作良好。', 'スマホ・家電', '目立った傷や汚れなし');

-- ── 商品画像 ─────────────────────────────────────────────
-- GitHub の raw URL を使う（リポジトリと一緒に画像も管理される。永続的で無料）
insert into item_images (item_id, url, sort_order) values
  ('b1000000-0000-4000-8000-000000000001', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/speaker.jpg', 0),
  ('b1000000-0000-4000-8000-000000000002', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/bag.jpg', 0),
  ('b1000000-0000-4000-8000-000000000003', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/coffee.jpg', 0),
  ('b1000000-0000-4000-8000-000000000004', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/giftcard.jpg', 0),
  ('b1000000-0000-4000-8000-000000000005', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/camera.jpg', 0),
  ('b1000000-0000-4000-8000-000000000006', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/books.jpg', 0),
  ('b1000000-0000-4000-8000-000000000007', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/watch.jpg', 0),
  ('b1000000-0000-4000-8000-000000000010', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/switch.jpg', 0),
  ('b1000000-0000-4000-8000-000000000011', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/perfume.jpg', 0),
  ('b1000000-0000-4000-8000-000000000012', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/airpods.jpg', 0);

-- ── 掲示板の投稿 ─────────────────────────────────────────
insert into board_posts (id, user_id, body, tag, image_url, pinned, created_at) values
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000a3',
   'はじめてぐんぐんで交換成立しました🌱 ずっと眠っていたバッグが、欲しかったカメラに。わらしべ長者みたいで本当に楽しい…！みなさんの水やり待ってます〜',
   'harvest', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/bag.jpg', true, now() - interval '10 minutes'),
  ('d1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000000a5',
   'Nintendo Switch のタネを植えました🎮 ゲーム好きな方、ぜひ水やりしてください！交換の輪を広げましょう。',
   'chat', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/switch.jpg', false, now() - interval '1 hour'),
  ('d1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000a1',
   'カメラが欲しいのですが、どんな商品を植えると水やりされやすいですか？おすすめのカテゴリなどあれば教えてください🙏',
   'question', null, false, now() - interval '3 hours');

-- コメント
insert into board_comments (post_id, user_id, body, created_at) values
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000a5',
   'おめでとうございます！自分も頑張ります🌱', now() - interval '8 minutes'),
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000a4',
   '交換の輪、いいですね！', now() - interval '5 minutes'),
  ('d1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000a3',
   '家電やコスメは人気だと思います！', now() - interval '2 hours');
