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
-- パスワードはすべて password。
-- handle_new_user トリガが raw_user_meta_data.nickname を見て profiles を作る。
--
-- ★ auth.users を直挿しするときは、GoTrue（認証基盤）が読む列をすべて埋めること。
--   2026-08-05、埋め忘れで以下の2段階のエラーを実際に踏んだ：
--     1. aud / role / instance_id が NULL
--        → GoTrue はこの3つで絞り込むので「ユーザーが存在しない」扱い
--          → Invalid login credentials
--     2. raw_app_meta_data / created_at / updated_at が NULL
--        → GoTrue が構造体に読み込めず 500 Database error querying schema
--   トークン列も NULL ではなく空文字にする（Go 側が文字列として読むため）。
insert into auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  v.id::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
  v.email, crypt('password', gen_salt('bf')), now(),
  v.meta::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now(),
  '', '', '', '', '', '', '', ''
from (values
  ('00000000-0000-0000-0000-0000000000a1', 'haru@example.com',    '{"nickname":"はる"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'metan@example.com',   '{"nickname":"めたん"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'sakura@example.com',  '{"nickname":"さくら"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'yu@example.com',      '{"nickname":"ゆう"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'takusan@example.com', '{"nickname":"たくさん"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'kenta@example.com',   '{"nickname":"けんた"}')
) as v(id, email, meta);

-- ★ auth.identities も必須。
--   いまの GoTrue はメール＋パスワードのログイン時に identities（provider='email'）を
--   引くため、この行が無いと auth.users があってもログインできない
--   （2026-08-05：aud/role を直したあとも Invalid login credentials が続いた原因）。
insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  now(), now(), now()
from auth.users u
where u.id in (
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4',
  '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a6'
);

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

-- ── めたん様がすぐ収穫を試せる木 ───────────────────────────
-- 種の持ち主が「めたん」でないと収穫を試せない（収穫できるのは種の持ち主だけ）。
-- めたん → たくさん → けんた の一本道にしてあるので、
-- metan@example.com でログインして「収穫」タブから3人の輪をすぐ作れる。
insert into items (id, user_id, name, description, category, condition) values
  ('b1000000-0000-4000-8000-000000000020', '00000000-0000-0000-0000-0000000000a2',
   'スニーカー', '数回履いただけです。箱あり。', 'メンズ', '目立った傷や汚れなし');

insert into items (id, user_id, name, description, category, condition, parent_id) values
  ('b1000000-0000-4000-8000-000000000021', '00000000-0000-0000-0000-0000000000a5',
   'iPhone 15', 'バッテリー最大容量92%。初期化して発送します。', 'スマホ・家電', '目立った傷や汚れなし',
   'b1000000-0000-4000-8000-000000000020');

insert into items (id, user_id, name, description, category, condition, parent_id) values
  ('b1000000-0000-4000-8000-000000000022', '00000000-0000-0000-0000-0000000000a6',
   'ブランド財布', 'いただきものですが使わないため。', 'メンズ', '未使用に近い',
   'b1000000-0000-4000-8000-000000000021');

-- 収穫の一本道から外れる枝。収穫すると新しいタネとして独立する（苗木機能の確認用）
insert into items (id, user_id, name, description, category, condition, parent_id) values
  ('b1000000-0000-4000-8000-000000000023', '00000000-0000-0000-0000-0000000000a3',
   'ワイヤレスコントローラー', '数回使用のみ。箱・ケーブル付き。', 'ゲーム・おもちゃ', '目立った傷や汚れなし',
   'b1000000-0000-4000-8000-000000000020');

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
  ('b1000000-0000-4000-8000-000000000012', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/airpods.jpg', 0),
  ('b1000000-0000-4000-8000-000000000020', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/sneaker.jpg', 0),
  ('b1000000-0000-4000-8000-000000000021', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/iphone.jpg', 0),
  ('b1000000-0000-4000-8000-000000000022', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/wallet.jpg', 0),
  ('b1000000-0000-4000-8000-000000000023', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/controller.jpg', 0);

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
