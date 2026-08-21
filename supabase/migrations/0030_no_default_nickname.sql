-- ============================================================================
-- 0030_no_default_nickname.sql — 勝手にローマ字の名前が入るのをやめる（項目23）
--
-- 【何が起きていたか】
-- 新規登録でニックネームを渡さなかった場合、メールアドレスの @ より前
-- （例：seiya.kikuchi）をそのまま名前にしていた。
-- 本人が入れた覚えのないローマ字名がプロフィールに出るため、
-- 「勝手に更新される」と受け取られていた。
--
-- 【直し方】
-- 名乗りが無いときは空のままにする。表示側は空を「名前未設定」と出す。
-- 旧名簿（legacy_users）に本人の名前があるときは、今までどおり引き継ぐ
-- ＝ 既存160名の移行は変わらない。
-- ============================================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nickname text;
  v_legacy   legacy_users;
begin
  -- 旧名簿にいる人なら、そのニックネームを引き継ぐ
  select * into v_legacy
    from legacy_users
   where lower(email) = lower(new.email)
   limit 1;

  -- メールのローカル部での仮置きはしない（本人が入れていない名前は出さない）
  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    nullif(trim(v_legacy.nickname), ''),
    ''
  );

  insert into profiles (id, nickname)
  values (new.id, left(v_nickname, 20))
  on conflict (id) do nothing;

  -- 移行完了として記録
  if v_legacy.legacy_id is not null then
    update legacy_users
       set profile_id = new.id,
           migrated_at = coalesce(migrated_at, now())
     where legacy_id = v_legacy.legacy_id;
  end if;

  return new;
end $$;
