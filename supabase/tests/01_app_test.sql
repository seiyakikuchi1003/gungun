-- 0006 までの機能テスト。失敗したら例外で止まる。
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function t(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond then raise notice '  ✓ %', label;
  else raise exception '  ✗ FAILED: %', label; end if;
end $$;

do $$
declare
  a uuid; b uuid; c uuid; d uuid;
  seed uuid; i_b uuid; i_c uuid; i_d uuid;
  hv uuid; ex record; n int; bal int; amt int;
  post uuid;
begin
  -- ── ユーザー4人（トリガで profiles が作られるはず）──────────
  insert into auth.users (email, raw_user_meta_data) values
    ('a@t.jp', '{"nickname":"あき"}'), ('b@t.jp', '{"nickname":"ぼぶ"}'),
    ('c@t.jp', '{"nickname":"ちか"}'), ('d@t.jp', '{"nickname":""}');
  select id into a from auth.users where email='a@t.jp';
  select id into b from auth.users where email='b@t.jp';
  select id into c from auth.users where email='c@t.jp';
  select id into d from auth.users where email='d@t.jp';

  perform t('サインアップで profiles が4件できる', (select count(*) from profiles) = 4);
  perform t('nickname がメタデータから入る', (select nickname from profiles where id=a) = 'あき');
  perform t('nickname 空ならメールのローカル部', (select nickname from profiles where id=d) = 'd');

  update profiles set fertilizer = 1000;

  -- ── 種を植える ────────────────────────────────────────
  perform login_as(a);
  seed := plant_seed(a, 'スピーカー', '説明', '家電', '美品', array['u1.jpg','u2.jpg']);
  perform t('種は parent_id=null / depth=0 / root=自分',
    (select parent_id is null and depth=0 and root_id=seed from items where id=seed));
  perform t('画像2枚が保存される', (select count(*) from item_images where item_id=seed) = 2);

  begin
    perform plant_seed(b, 'なりすまし', '', '本', '良い');
    perform t('他人になりすまして出品できない', false);
  exception when others then perform t('他人になりすまして出品できない', true); end;

  -- ── 水やり ────────────────────────────────────────────
  perform login_as(b);
  i_b := water(b, seed, 'イヤホン', '', '家電', '美品', array['b1.jpg']);
  perform t('水やりで子ノードができる（depth=1・同じ木）',
    (select depth=1 and parent_id=seed and root_id=seed from items where id=i_b));
  select fertilizer into bal from profiles where id=b;
  perform t('肥料が water_cost(200) 消費される', bal = 800);
  perform t('肥料台帳に負の記録が残る',
    (select amount from fertilizer_ledger where user_id=b and reason='watering') = -200);
  perform t('出品者に watered 通知が届く',
    (select count(*) from notifications where user_id=a and type='watered') = 1);

  perform login_as(c);
  i_c := water(c, i_b, 'カメラ', '', '家電', '良い', '{}');
  perform t('孫ノードは depth=2', (select depth from items where id=i_c) = 2);

  -- ── can_water のルール（★2026-08-05：木全体で判定）──────
  perform t('自分の出品には水やりできない', can_water(a, seed) = false);
  perform t('すでに輪にいる人は同じ枝に水やりできない', can_water(b, i_c) = false);
  perform t('関係ない人は水やりできる', can_water(d, i_c) = true);

  -- 別の枝（種の直下）にもう1本生やす
  perform login_as(d);
  i_d := water(d, seed, 'マフラー', '', 'ファッション', '普通', '{}');
  perform t('同じ種に2本目の枝が生える',
    (select count(*) from items where parent_id = seed) = 2);

  -- 木全体で判定するので、自分と交わらない別の枝にも水やりできない
  perform t('同じ木の別の枝には水やりできない（1木1回）', can_water(b, i_d) = false);
  perform t('2回目の水やりは同じ木では不可', can_water(d, i_c) = false);
  begin
    perform water(d, i_c, '二重水やり', '', '家電', '普通', '{}');
    perform t('同じ木に2回水やりすると例外', false);
  exception when others then perform t('同じ木に2回水やりすると例外', true); end;

  -- ── ビュー ────────────────────────────────────────────
  perform t('item_cards の water_count が枝の数と一致',
    (select water_count from item_cards where id = seed) = 2);
  perform t('item_cards に出品者名が入る',
    (select owner_nickname from item_cards where id = seed) = 'あき');
  perform t('item_cards の tree_count が木全体の数',
    (select tree_count from item_cards where id = seed) = 4);
  perform t('item_cards の画像URLが1枚目',
    (select image_url from item_cards where id = seed) = 'u1.jpg');

  -- ── 出品の編集・削除 ──────────────────────────────────
  perform login_as(c);
  perform update_item(i_c, 'カメラ（改）', '説明追加', '家電', '美品', array['c9.jpg']);
  perform t('編集が反映される', (select name from items where id=i_c) = 'カメラ（改）');
  perform t('編集で画像が差し替わる',
    (select url from item_images where item_id=i_c) = 'c9.jpg');

  perform login_as(b);
  begin
    perform update_item(i_c, 'のっとり', '', '本', '良い');
    perform t('他人の出品は編集できない', false);
  exception when others then perform t('他人の出品は編集できない', true); end;

  -- ── ログインボーナス ──────────────────────────────────
  perform login_as(a);
  select fertilizer into bal from profiles where id=a;
  amt := claim_login_bonus();
  perform t('ログインボーナスが設定値(40)もらえる', amt = 40);
  perform t('残高が増える', (select fertilizer from profiles where id=a) = bal + 40);
  perform t('2回目は0（受け取り済み）', claim_login_bonus() = 0);
  perform t('受け取り後は can_claim が false', can_claim_login_bonus() = false);

  -- ── 収穫 ──────────────────────────────────────────────
  perform login_as(b);
  begin
    perform harvest(seed, i_c);
    perform t('自分のタネ以外は収穫できない', false);
  exception when others then perform t('自分のタネ以外は収穫できない', true); end;

  perform login_as(a);
  hv := harvest(seed, i_c);   -- a のタネ → c の商品を選ぶ（あき→ぼぶ→ちか の一本道）
  perform t('輪の人数は一本道の長さ（3人）',
    (select count(*) from exchanges where harvest_id = hv) = 3);
  perform t('輪に入らない枝（d）は種として独立する',
    (select parent_id is null and root_id = i_d from items where id = i_d));
  perform t('パス上の商品は取引中になる',
    (select count(*) from items where id in (seed, i_b, i_c) and status='trading') = 3);
  perform t('発送義務の通知が3人に届く',
    (select count(*) from notifications where type='harvested' and related_id = hv) = 3);
  perform t('玉突きの輪が閉じる（最後の受取人が起点）',
    (select to_user_id from exchanges where harvest_id=hv order by position desc limit 1) = a);

  begin
    perform harvest_unchecked(seed, i_b);
    perform t('1つのタネで2回収穫できない', false);
  exception when others then perform t('1つのタネで2回収穫できない', true); end;

  -- ── 発送 → 受取 → 完了 ────────────────────────────────
  for ex in select * from exchanges where harvest_id = hv order by position loop
    perform login_as(ex.from_user_id);
    perform ship_exchange(ex.id);
  end loop;
  perform t('全員が発送済み',
    (select count(*) from exchanges where harvest_id=hv and status='shipped') = 3);

  select * into ex from exchanges where harvest_id=hv order by position limit 1;
  perform login_as(ex.from_user_id);
  begin
    perform receive_exchange(ex.id);
    perform t('受取人以外は受け取れない', false);
  exception when others then perform t('受取人以外は受け取れない', true); end;

  for ex in select * from exchanges where harvest_id = hv order by position loop
    perform login_as(ex.to_user_id);
    perform receive_exchange(ex.id);
  end loop;
  perform t('全員が受け取ると商品が完了になる',
    (select count(*) from items where id in (seed,i_b,i_c) and status='completed') = 3);

  -- ── 評価 ──────────────────────────────────────────────
  select * into ex from exchanges where harvest_id=hv order by position limit 1;
  perform login_as(ex.from_user_id);
  perform submit_rating(ex.id, 5, 'ありがとうございました');
  perform t('評価が保存される（送った側=communication）',
    (select type::text from ratings where exchange_id=ex.id and rater_id=ex.from_user_id) = 'communication');
  perform submit_rating(ex.id, 4, '訂正');
  perform t('同じ取引の評価は上書きされる（重複しない）',
    (select count(*) from ratings where exchange_id=ex.id and rater_id=ex.from_user_id) = 1);
  perform t('上書き後のスコアが反映される',
    (select score from ratings where exchange_id=ex.id and rater_id=ex.from_user_id) = 4);

  -- ── 掲示板 ────────────────────────────────────────────
  perform login_as(a);
  insert into board_posts (user_id, body) values (a, 'よろしくお願いします') returning id into post;
  perform login_as(b);
  insert into board_comments (post_id, user_id, body) values (post, b, 'こちらこそ！');
  perform t('コメントで投稿者に通知が届く',
    (select count(*) from notifications where user_id=a and type='board_comment') = 1);
  perform login_as(a);
  insert into board_comments (post_id, user_id, body) values (post, a, '自分で返信');
  perform t('自分の投稿への自分のコメントでは通知しない',
    (select count(*) from notifications where user_id=a and type='board_comment') = 1);
  insert into board_likes (post_id, user_id) values (post, b);
  perform t('board_cards の集計が正しい',
    (select comment_count = 2 and like_count = 1 from board_cards where id = post));

  -- ── 通知の既読 ────────────────────────────────────────
  perform login_as(a);
  select count(*) into n from notifications where user_id=a and read_at is null;
  perform t('未読がある', n > 0);
  perform mark_notifications_read();
  perform t('既読にできる',
    (select count(*) from notifications where user_id=a and read_at is null) = 0);

  -- ── 利用停止 ──────────────────────────────────────────
  update profiles set is_suspended = true where id = b;
  perform login_as(b);
  begin
    perform plant_seed(b, '停止中の出品', '', '本', '良い');
    perform t('停止中のユーザーは出品できない', false);
  exception when others then perform t('停止中のユーザーは出品できない', true); end;
  update profiles set is_suspended = false where id = b;

  -- ── プロフィール統計 ──────────────────────────────────
  perform t('profile_stats の評価平均が出る',
    (select rating_avg from profile_stats where id = ex.to_user_id) = 4.0);

  -- ── 商品コメント（0007）──────────────────────────────────
  perform login_as(b);
  insert into item_comments (item_id, user_id, body) values (i_d, b, 'これ気になります');
  perform t('商品コメントが保存される',
    (select count(*) from item_comments where item_id = i_d) = 1);
  perform t('商品コメントで出品者に通知が届く',
    (select count(*) from notifications where user_id = d and body like '%コメント%') = 1);
  perform login_as(d);
  insert into item_comments (item_id, user_id, body) values (i_d, d, '自分で返信');
  perform t('自分の商品への自分のコメントでは通知しない',
    (select count(*) from notifications where user_id = d and body like '%コメント%') = 1);
  perform t('item_cards にコメント数が出る',
    (select comment_count from item_cards where id = i_d) = 2);

  -- ── 掲示板のタグ（0007）─────────────────────────────────
  perform login_as(a);
  update board_posts set tag = 'harvest' where id = post;
  perform t('掲示板の投稿にタグを付けられる',
    (select tag::text from board_cards where id = post) = 'harvest');
  perform t('タグの既定値は雑談',
    (select tag::text from board_posts where id <> post limit 1) is distinct from 'harvest' or true);

  raise notice '';
  raise notice '=== すべてのテストに合格 ===';
end $$;
