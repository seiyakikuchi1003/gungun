-- ブロックされている相手の出品も、一覧から消えるようにする（テスト仕様 G-9 の続き）。
--
-- 0050 で「ブロックしている／されている相手には水やりできない」を塞いだが、
-- 実機で触ると、相手の出品は一覧に出たままで水やりのボタンも見えている。
-- 押しても進めないだけなので、理由が分からず壊れているように見える
-- （2026-09-15 指摘）。ブロックした側と同じく、そもそも見えないようにする。
--
-- アプリからは「誰が自分をブロックしたか」が読めない。blocks の RLS は
-- blocker_id = auth.uid() の行しか見せないためで、これは正しい。
-- そこで、両方向をまとめた「見せない相手の id」だけを返す関数を置く。
-- 誰がどちらの向きでブロックしたかは返さない。
create or replace function hidden_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when b.blocker_id = auth.uid() then b.blocked_id else b.blocker_id end
  from blocks b
  where b.blocker_id = auth.uid() or b.blocked_id = auth.uid();
$$;

revoke all on function hidden_user_ids() from public;
grant execute on function hidden_user_ids() to authenticated;

insert into public._gungun_migrations (name)
values ('0051_hidden_users.sql')
on conflict do nothing;
