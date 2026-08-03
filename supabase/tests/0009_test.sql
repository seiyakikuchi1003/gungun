-- 0009 の検証（課金・プッシュ・移行台帳・運用の穴）
--
-- 使い方（ローカル Postgres に 0001〜0009 を流したあと）:
--   psql -d gungun -v ON_ERROR_STOP=1 -f supabase/tests/0009_test.sql
--
-- すべて assert で判定する。1つでも落ちたら例外で止まる。

\set QUIET on
\pset pager off

create or replace function t_assert(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_ok then
    raise notice 'PASS  %', p_label;
  else
    raise exception 'FAIL  %', p_label;
  end if;
end $$;

-- テスト用ユーザーを2人つくる（auth.users → トリガで profiles ができる）
--
-- 何度でも流せるように、前回のテストデータを先に消しておく。
-- テスト用のメールは 't_' で始めているので、それを目印にまとめて消す。
do $$
begin
  delete from auth.users where email like 't#_%@example.com' escape '#';
  delete from legacy_users where legacy_id like 'L-%';

  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), 't_a@example.com', '{"nickname":"Aさん"}'),
         (gen_random_uuid(), 't_b@example.com', '{"nickname":"Bさん"}');
end $$;

-- ============================================================================
-- 1. プレミアムの有効期限
-- ============================================================================

-- 期限切れのプレミアムは expire_premium() で落ちる
do $$
declare v_a uuid; v_n int;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  update profiles set is_premium = true, premium_until = now() - interval '1 day' where id = v_a;
  select expire_premium() into v_n;
  perform t_assert(v_n >= 1, '期限切れのプレミアムが落ちる（expire_premium）');
  perform t_assert((select not is_premium from profiles where id = v_a), '  → is_premium が false になっている');
end $$;

-- 期限内のプレミアムは落ちない
do $$
declare v_a uuid;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  update profiles set is_premium = true, premium_until = now() + interval '10 days' where id = v_a;
  perform expire_premium();
  perform t_assert((select is_premium from profiles where id = v_a), '期限内のプレミアムは残る');
end $$;

-- 期限なし（運営が手で付与）も落ちない
do $$
declare v_a uuid;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  update profiles set is_premium = true, premium_until = null where id = v_a;
  perform expire_premium();
  perform t_assert((select is_premium from profiles where id = v_a), '期限なしの運営付与は落ちない');
end $$;

-- ログインボーナス：期限切れなら通常額（40）になる
do $$
declare v_a uuid; v_got int;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  update profiles
     set is_premium = true, premium_until = now() - interval '1 hour',
         last_login_bonus_on = null, fertilizer = 0
   where id = v_a;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  select claim_login_bonus() into v_got;
  perform t_assert(v_got = 40, 'プレミアム期限切れのログインボーナスは通常額（実際: ' || v_got || '）');
  perform t_assert((select not is_premium from profiles where id = v_a), '  → その場で is_premium も落ちている');
end $$;

-- ログインボーナス：期限内ならプレミアム額（80）
do $$
declare v_a uuid; v_got int;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  update profiles
     set is_premium = true, premium_until = now() + interval '10 days',
         last_login_bonus_on = null, fertilizer = 0
   where id = v_a;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  select claim_login_bonus() into v_got;
  perform t_assert(v_got = 80, 'プレミアム期限内のログインボーナスは増量（実際: ' || v_got || '）');
end $$;

-- 同じ日に2回目は0
do $$
declare v_a uuid; v_got int;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  select claim_login_bonus() into v_got;
  perform t_assert(v_got = 0, '同じ日の2回目は0');
end $$;

-- ============================================================================
-- 2. 課金レシート（二重付与の防止）
-- ============================================================================

do $$
declare v_a uuid; v_first boolean; v_second boolean; v_fert int;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  update profiles set fertilizer = 0 where id = v_a;

  select redeem_purchase(v_a, 'ios', 'fertilizer', 'jp.gungun.fert1200', 'TX-0001', 1200, 0, 500, null)
    into v_first;
  perform t_assert(v_first, '肥料の購入が反映される');
  select fertilizer into v_fert from profiles where id = v_a;
  perform t_assert(v_fert = 1200, '  → 肥料が 1200 増えた（実際: ' || v_fert || '）');

  -- 同じレシートをもう一度（Apple の再送・アプリの再試行を想定）
  select redeem_purchase(v_a, 'ios', 'fertilizer', 'jp.gungun.fert1200', 'TX-0001', 1200, 0, 500, null)
    into v_second;
  perform t_assert(not v_second, '同じレシートの2回目は false を返す');
  select fertilizer into v_fert from profiles where id = v_a;
  perform t_assert(v_fert = 1200, '  → 二重付与されていない（実際: ' || v_fert || '）');

  perform t_assert((select count(*) = 1 from purchases where transaction_id = 'TX-0001'),
                   '  → purchases も1件だけ');
  perform t_assert((select count(*) = 1 from fertilizer_ledger
                     where user_id = v_a and reason = 'purchase'),
                   '  → 台帳も1件だけ');
end $$;

-- プレミアムの購入：期限が伸びる
do $$
declare v_b uuid; v_until1 timestamptz; v_until2 timestamptz;
begin
  select p.id into v_b from profiles p join auth.users u on u.id = p.id where u.email = 't_b@example.com';
  update profiles set is_premium = false, premium_until = null where id = v_b;

  perform redeem_purchase(v_b, 'ios', 'premium', 'jp.gungun.premium', 'TX-P-1', 0, 30, 480, null);
  select premium_until into v_until1 from profiles where id = v_b;
  perform t_assert((select is_premium from profiles where id = v_b), 'プレミアム購入で is_premium が true');
  perform t_assert(v_until1 > now() + interval '29 days', '  → 期限が約30日後になった');

  -- 更新（2か月目）
  perform redeem_purchase(v_b, 'ios', 'premium', 'jp.gungun.premium', 'TX-P-2', 0, 30, 480, null);
  select premium_until into v_until2 from profiles where id = v_b;
  perform t_assert(v_until2 > v_until1 + interval '29 days', '更新すると期限が積み増される');
end $$;

-- 期限が切れたあとの再加入は now() 起点（過去から積まない）
do $$
declare v_b uuid; v_until timestamptz;
begin
  select p.id into v_b from profiles p join auth.users u on u.id = p.id where u.email = 't_b@example.com';
  update profiles set is_premium = false, premium_until = now() - interval '100 days' where id = v_b;
  perform redeem_purchase(v_b, 'ios', 'premium', 'jp.gungun.premium', 'TX-P-3', 0, 30, 480, null);
  select premium_until into v_until from profiles where id = v_b;
  perform t_assert(v_until > now() + interval '29 days',
                   '期限切れ後の再加入は今日から30日（過去から積まない）');
end $$;

-- ============================================================================
-- 3. プッシュ通知のトークン
-- ============================================================================

do $$
declare v_a uuid; v_b uuid;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  select p.id into v_b from profiles p join auth.users u on u.id = p.id where u.email = 't_b@example.com';

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform register_push_token('ExponentPushToken[AAA]', 'ios');
  perform t_assert((select user_id = v_a from push_tokens where token = 'ExponentPushToken[AAA]'),
                   '端末トークンが登録される');

  -- 同じ端末で B がログインし直した
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform register_push_token('ExponentPushToken[AAA]', 'ios');
  perform t_assert((select user_id = v_b from push_tokens where token = 'ExponentPushToken[AAA]'),
                   '同じ端末で別の人がログインすると持ち主が入れ替わる');
  perform t_assert((select count(*) = 1 from push_tokens where token = 'ExponentPushToken[AAA]'),
                   '  → 行は増えない（前の人に通知が飛び続けない）');

  -- ログアウト
  perform unregister_push_token('ExponentPushToken[AAA]');
  perform t_assert((select count(*) = 0 from push_tokens where token = 'ExponentPushToken[AAA]'),
                   'ログアウトでトークンが外れる');
end $$;

-- 未送信の通知だけが送信キューに出る
do $$
declare v_a uuid; v_n1 uuid; v_n2 uuid;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  delete from push_tokens where user_id = v_a;
  delete from notifications where user_id = v_a;

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform register_push_token('ExponentPushToken[BBB]', 'ios');

  insert into notifications (user_id, type, body) values (v_a, 'watered', '未送信') returning id into v_n1;
  insert into notifications (user_id, type, body, pushed_at)
    values (v_a, 'watered', '送信済み', now()) returning id into v_n2;

  perform t_assert((select count(*) = 1 from notifications_to_push where user_id = v_a),
                   '送信キューには未送信ぶんだけ出る');
  perform t_assert((select id = v_n1 from notifications_to_push where user_id = v_a),
                   '  → 未送信の行が出ている');

  update notifications set pushed_at = now() where id = v_n1;
  perform t_assert((select count(*) = 0 from notifications_to_push where user_id = v_a),
                   'pushed_at を埋めるとキューから消える（二重送信しない）');
end $$;

-- ============================================================================
-- 4. 既存ユーザーの移行台帳
-- ============================================================================

do $$
declare v_new uuid;
begin
  delete from legacy_users where legacy_id in ('L-001', 'L-002');
  insert into legacy_users (legacy_id, email, nickname)
  values ('L-001', 'T_Legacy@Example.com', '旧めたん'),   -- 大文字混在でも一致すること
         ('L-002', 'nobody@example.com', '来ない人');

  update legacy_users set invited_at = now() where legacy_id in ('L-001', 'L-002');

  -- 名簿にいる人が新規登録した（nickname はアプリから渡していない想定）
  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), 't_legacy@example.com', '{}'::jsonb)
  returning id into v_new;

  perform t_assert((select migrated_at is not null from legacy_users where legacy_id = 'L-001'),
                   '旧名簿の人が登録すると移行済みになる（メールの大文字小文字は無視）');
  perform t_assert((select profile_id = v_new from legacy_users where legacy_id = 'L-001'),
                   '  → 新しい profile と紐づく');
  perform t_assert((select nickname = '旧めたん' from profiles where id = v_new),
                   '  → 旧サービスのニックネームを引き継ぐ');
  perform t_assert((select migrated_at is null from legacy_users where legacy_id = 'L-002'),
                   'まだ戻ってきていない人は未移行のまま');

  perform t_assert((select migrated = 1 and invited_not_yet = 1 from legacy_migration_status),
                   '進捗ビューが移行済み1件・案内済み未移行1件を返す');
end $$;

-- 名簿にいない人が登録しても壊れない
do $$
declare v_new uuid;
begin
  delete from auth.users where email = 't_stranger@example.com';
  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), 't_stranger@example.com', '{"nickname":"通りすがり"}')
  returning id into v_new;
  perform t_assert((select nickname = '通りすがり' from profiles where id = v_new),
                   '名簿に無い人の登録も通常どおり');
end $$;

-- 同じメールの二重登録は弾く
do $$
begin
  begin
    insert into legacy_users (legacy_id, email) values ('L-003', 'T_LEGACY@example.com');
    perform t_assert(false, '同じメールの名簿を二重登録できてしまった');
  exception when unique_violation then
    perform t_assert(true, '名簿の同じメールは二重登録できない');
  end;
end $$;

-- ============================================================================
-- 5. 運用の穴
-- ============================================================================

-- 同じ人が同じ対象を二重に通報できない（未対応のあいだ）
do $$
declare v_a uuid; v_target uuid := gen_random_uuid(); v_rep uuid;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  delete from reports where reporter_id = v_a;

  insert into reports (reporter_id, target_type, target_id, reason)
  values (v_a, 'item', v_target, '1回目') returning id into v_rep;

  begin
    insert into reports (reporter_id, target_type, target_id, reason)
    values (v_a, 'item', v_target, '2回目');
    perform t_assert(false, '未対応の通報を二重に出せてしまった');
  exception when unique_violation then
    perform t_assert(true, '未対応のあいだは同じ対象を二重通報できない');
  end;

  -- 運営が対応済みにしたら、再発は受け付ける
  update reports set status = 'resolved', handled_at = now() where id = v_rep;
  insert into reports (reporter_id, target_type, target_id, reason)
  values (v_a, 'item', v_target, '再発');
  perform t_assert((select count(*) = 2 from reports where reporter_id = v_a and target_id = v_target),
                   '対応済みになった後の再通報は受け付ける');
end $$;

-- items.updated_at が編集で動く
--
-- 注意：now() はトランザクション開始時刻なので、1つの DO ブロック内では進まない。
-- そこで updated_at をいったん過去に落としてから編集し、現在時刻に戻ることを見る。
do $$
declare v_a uuid; v_item uuid; v_after timestamptz;
begin
  select p.id into v_a from profiles p join auth.users u on u.id = p.id where u.email = 't_a@example.com';
  insert into items (user_id, name, category, condition, root_id)
  values (v_a, 'テスト品', '家電', '未使用に近い', gen_random_uuid())
  returning id into v_item;
  perform t_assert((select updated_at is not null from items where id = v_item),
                   '出品時に updated_at が入る');

  update items set updated_at = timestamptz '2020-01-01' where id = v_item;
  update items set name = 'テスト品（改）' where id = v_item;
  select updated_at into v_after from items where id = v_item;
  perform t_assert(v_after > timestamptz '2020-01-02',
                   '出品を編集すると updated_at が現在時刻に更新される');
end $$;

-- ============================================================================
-- 6. 権限：アプリから課金を自分に付与できないこと
-- ============================================================================

do $$
begin
  perform t_assert(
    not has_function_privilege('authenticated',
      'redeem_purchase(uuid, purchase_platform, purchase_kind, text, text, int, int, int, jsonb)',
      'execute'),
    'アプリ（authenticated）は redeem_purchase を呼べない');
  perform t_assert(
    has_function_privilege('service_role',
      'redeem_purchase(uuid, purchase_platform, purchase_kind, text, text, int, int, int, jsonb)',
      'execute'),
    'サーバ（service_role）は redeem_purchase を呼べる');
  perform t_assert(
    not has_function_privilege('authenticated', 'expire_premium()', 'execute'),
    'アプリは expire_premium を呼べない');
  perform t_assert(
    has_function_privilege('authenticated', 'register_push_token(text, text)', 'execute'),
    'アプリは自分の端末トークンを登録できる');
end $$;

-- 旧名簿はアプリから読めない（ポリシーが無い＝全拒否）
do $$
begin
  perform t_assert((select relrowsecurity from pg_class where relname = 'legacy_users'),
                   'legacy_users は RLS 有効');
  perform t_assert((select count(*) = 0 from pg_policies where tablename = 'legacy_users'),
                   '  → ポリシーが無い＝アプリからは1行も読めない');
end $$;

-- ============================================================================
-- 7. 退会（外部キーで失敗しないこと）
-- ============================================================================
--
-- 修正前は、取引・メッセージ・評価・通報のどれかがあると
-- exchanges_from_user_id_fkey などに引っかかって退会できなかった。

do $$
declare v_x uuid; v_y uuid; v_it uuid; v_h uuid; v_ex uuid;
begin
  delete from auth.users where email in ('t_del_x@example.com', 't_del_y@example.com');
  insert into auth.users (id, email) values (gen_random_uuid(), 't_del_x@example.com') returning id into v_x;
  insert into auth.users (id, email) values (gen_random_uuid(), 't_del_y@example.com') returning id into v_y;

  -- ふつうに使った状態をつくる（相手 Y との取引・会話・評価、それに通報）
  insert into items (user_id, name, category, condition, root_id)
  values (v_y, '交換品', '家電', '未使用に近い', gen_random_uuid()) returning id into v_it;
  insert into harvests (root_item_id, harvested_item_id) values (v_it, v_it) returning id into v_h;
  insert into exchanges (harvest_id, item_id, from_user_id, to_user_id, position)
  values (v_h, v_it, v_x, v_y, 0) returning id into v_ex;
  insert into messages (exchange_id, sender_id, body) values (v_ex, v_x, 'よろしくお願いします');
  insert into ratings (exchange_id, rater_id, ratee_id, type, score)
  values (v_ex, v_x, v_y, 'quality', 5);
  insert into reports (reporter_id, target_type, target_id, reason)
  values (v_x, 'item', v_it, 'テスト通報');

  -- 退会する
  perform set_config('request.jwt.claim.sub', v_x::text, true);
  perform delete_own_account();
  perform t_assert(true, '取引・会話・評価・通報がある人でも退会できる');

  perform t_assert((select count(*) = 0 from profiles where id = v_x),
                   '  → profiles から消えている');

  -- 相手側の記録は残っていること（cascade で巻き込んで消していない）
  perform t_assert((select count(*) = 1 from exchanges where id = v_ex),
                   '  → 相手の取引記録は残る');
  perform t_assert((select from_user_id is null from exchanges where id = v_ex),
                   '  → 退会した側の参照だけ NULL になる');
  perform t_assert((select to_user_id = v_y from exchanges where id = v_ex),
                   '  → 相手の参照はそのまま');
  perform t_assert((select count(*) = 1 from messages where exchange_id = v_ex),
                   '  → 会話も残る');
  perform t_assert((select count(*) = 1 from ratings where exchange_id = v_ex),
                   '  → 相手に付いた評価も残る');
  perform t_assert((select ratee_id = v_y from ratings where exchange_id = v_ex),
                   '  → 評価された側の参照はそのまま');
  perform t_assert((select count(*) = 1 from reports where target_id = v_it),
                   '  → 運営の通報対応履歴も残る');
  perform t_assert((select reporter_id is null from reports where target_id = v_it),
                   '  → 通報者だけ分からなくなる');
end $$;

-- 種の持ち主側の退会（収穫済み・水やりされた種を持っている）
--
-- items を参照する外部キー（harvests / exchanges / fertilizer_ledger）が
-- NO ACTION だと、ここで失敗していた。
do $$
declare v_o uuid; v_w uuid; v_seed uuid; v_h uuid; v_ex uuid;
begin
  delete from auth.users where email in ('t_own@example.com', 't_wat@example.com');
  insert into auth.users (id, email) values (gen_random_uuid(), 't_own@example.com') returning id into v_o;
  insert into auth.users (id, email) values (gen_random_uuid(), 't_wat@example.com') returning id into v_w;

  -- O が種を植え、W が水やりし（W の台帳が O の種を指す）、収穫まで済んだ状態
  insert into items (user_id, name, category, condition, root_id)
  values (v_o, 'Oのタネ', '家電', '未使用に近い', gen_random_uuid()) returning id into v_seed;
  insert into fertilizer_ledger (user_id, amount, reason, related_item_id)
  values (v_w, -200, 'watering', v_seed);
  insert into harvests (root_item_id, harvested_item_id) values (v_seed, v_seed) returning id into v_h;
  insert into exchanges (harvest_id, item_id, from_user_id, to_user_id, position)
  values (v_h, v_seed, v_o, v_w, 0) returning id into v_ex;

  -- 種の持ち主が退会する
  perform set_config('request.jwt.claim.sub', v_o::text, true);
  perform delete_own_account();
  perform t_assert(true, '収穫済み・水やりされた種を持つ人でも退会できる');

  perform t_assert((select count(*) = 0 from items where id = v_seed),
                   '  → 出品は消える');
  perform t_assert((select count(*) = 1 from harvests where id = v_h),
                   '  → 収穫の記録は残る');
  perform t_assert((select root_item_id is null from harvests where id = v_h),
                   '  → 商品への参照だけ NULL');
  perform t_assert((select count(*) = 1 from exchanges where id = v_ex),
                   '  → 相手の取引記録は残る');
  perform t_assert((select count(*) = 1 from fertilizer_ledger
                     where user_id = v_w and reason = 'watering'),
                   '  → 水やりした人の肥料台帳は残る（金額の履歴は消さない）');
  perform t_assert((select related_item_id is null from fertilizer_ledger
                     where user_id = v_w and reason = 'watering'),
                   '  → 台帳の商品参照だけ NULL');
end $$;

-- 何も使っていない人も普通に退会できる
do $$
declare v_z uuid;
begin
  delete from auth.users where email = 't_del_z@example.com';
  insert into auth.users (id, email) values (gen_random_uuid(), 't_del_z@example.com') returning id into v_z;
  perform set_config('request.jwt.claim.sub', v_z::text, true);
  perform delete_own_account();
  perform t_assert((select count(*) = 0 from profiles where id = v_z), '未使用のユーザーも退会できる');
end $$;

drop function t_assert(boolean, text);
select '0009 のテストは全項目 PASS' as result;
