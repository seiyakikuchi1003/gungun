-- ぐんぐん デモ用シード
-- 現行モック（src/data/mock.ts）の「スピーカーの木」を再現する。
-- ★ items を直接 insert せず、plant_seed()/water() RPC 経由で作ることで
--   関数自体の動作確認も兼ねる。再実行可能（既存ユーザーはスキップ）。

-- ── テストユーザー（auth.users + profiles）──────────────────
-- 固定UUIDで冪等に。パスワードは 'password'（開発用）。
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-0000-0000-0000000000a1'::uuid, 'haru@example.com',    'はる'),
      ('00000000-0000-0000-0000-0000000000a2'::uuid, 'metan@example.com',   'めたん'),
      ('00000000-0000-0000-0000-0000000000a3'::uuid, 'sakura@example.com',  'さくら'),
      ('00000000-0000-0000-0000-0000000000a4'::uuid, 'yu@example.com',      'ゆう'),
      ('00000000-0000-0000-0000-0000000000a5'::uuid, 'takusan@example.com', 'たくさん'),
      ('00000000-0000-0000-0000-0000000000a6'::uuid, 'kenta@example.com',   'けんた'),
      ('00000000-0000-0000-0000-0000000000a7'::uuid, 'you@example.com',     'あなた')
    ) as t(id, email, nickname)
  loop
    -- auth.users（既存ならスキップ）
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      u.email, crypt('password', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      false, '', '', '', ''
    ) on conflict (id) do nothing;

    -- profiles（肥料は水やりできるよう多めに付与）
    insert into profiles (id, nickname, fertilizer)
    values (u.id, u.nickname, 2000)
    on conflict (id) do nothing;
  end loop;
end $$;

-- ── スピーカーの木を RPC で構築 ─────────────────────────────
-- 既に構築済み（items が存在）なら二重投入しない。
do $$
declare
  haru    uuid := '00000000-0000-0000-0000-0000000000a1';
  metan   uuid := '00000000-0000-0000-0000-0000000000a2';
  sakura  uuid := '00000000-0000-0000-0000-0000000000a3';
  yu      uuid := '00000000-0000-0000-0000-0000000000a4';
  takusan uuid := '00000000-0000-0000-0000-0000000000a5';
  kenta   uuid := '00000000-0000-0000-0000-0000000000a6';
  v_speaker uuid;
  v_mug uuid;
  v_cam uuid;
  v_gift uuid;
begin
  if exists (select 1 from items limit 1) then
    return; -- 既にシード済み
  end if;

  -- 種：はるがワイヤレススピーカーを植える（root）
  v_speaker := plant_seed(haru, 'ワイヤレススピーカー', '防水対応。箱付き。', '家電', '未使用に近い',
    array['https://placehold.co/600x600?text=speaker']);

  -- 水やり（depth1）：めたん → トートバッグ
  perform water(metan, v_speaker, 'キャンバストートバッグ', '無地のキャンバストート。数回使用のみ。',
    'レディース', '目立った傷や汚れなし', array['https://placehold.co/600x600?text=tote']);

  -- 水やり（depth1）：さくら → マグカップ
  v_mug := water(sakura, v_speaker, 'マグカップ', 'いただきもの。使わないのでお譲りします。',
    'インテリア', '未使用に近い', array['https://placehold.co/600x600?text=mug']);

  -- 水やり（depth2）：ゆう → ミラーレスカメラ（マグに水やり）
  v_cam := water(yu, v_mug, 'ミラーレスカメラ', 'レンズキット付き。シャッター回数少なめ。',
    'スマホ・家電', '目立った傷や汚れなし', array['https://placehold.co/600x600?text=camera']);

  -- 水やり（depth3）：たくさん → 腕時計（カメラに水やり）
  perform water(takusan, v_cam, '腕時計', '電池交換済み。カメラが欲しくて水やり。',
    'メンズ', '未使用に近い', array['https://placehold.co/600x600?text=watch']);

  -- 水やり（depth1）：けんた → ギフト券
  v_gift := water(kenta, v_speaker, 'ギフト券 5,000円分', '有効期限まだあります。',
    'チケット', '新品・未使用', array['https://placehold.co/600x600?text=gift']);

  -- 水やり（depth2）：さくら → 文庫本セット（ギフト券に水やり）
  perform water(sakura, v_gift, '文庫本セット', '人気作家の文庫本8冊セット。',
    '本・音楽', '目立った傷や汚れなし', array['https://placehold.co/600x600?text=books']);
end $$;
