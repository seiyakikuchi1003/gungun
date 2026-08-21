-- サインアップと profiles の連動
--
-- profiles は auth.users を参照する。アプリ側から insert させると
-- 「登録はできたがプロフィールが無い」状態が生まれうるので、
-- ユーザー作成のタイミングで DB 側が必ず1行作る。
-- （0003 の RLS には profiles への insert ポリシーが無い＝クライアントからは作れない設計）

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nickname text;
begin
  -- サインアップ時に渡した nickname を使う。無ければメールのローカル部で仮置き。
  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    split_part(new.email, '@', 1)
  );

  insert into profiles (id, nickname)
  values (new.id, left(v_nickname, 20))
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 退会（自分のアカウントを消す）────────────────────────
-- auth.users を消せば profiles は cascade で消える。
-- クライアントは auth.users を直接触れないので RPC 経由にする。
create or replace function delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'ログインしていません';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;

-- ── 自分のプロフィールを取る（RLS 下でも1発で引けるように）──
create or replace function my_profile()
returns profiles language sql stable as $$
  select * from profiles where id = auth.uid();
$$;
