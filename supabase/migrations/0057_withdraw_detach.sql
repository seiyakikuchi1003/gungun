-- 退会で他の人の商品が壊れた状態で残るのを直す（2026-09-28）
--
-- delete_own_account() は auth.users を消すだけだった。items.parent_id は
-- on delete set null なので、退会者の種・枝に水やりしていた他の人の商品は
-- 「親が消えたのに root_id / depth は消えた根を指したまま」になり、
-- 木の表示・水やりの判定（can_water）・収穫の経路が崩れる。
-- 本番のテストデータ整理で実際に1件見つかった。
--
-- 収穫・削除と同じく detach_children で子を新しい根（苗木）に昇格させてから消す。
-- 苗木になった持ち主には detach_children が通知を出す。
--
-- あわせて、発送・受け取りが終わっていない取引がある間は退会させない。
-- 相手が消えると取引が宙ぶらりんになり、相手の商品が「取引中」のまま
-- 動かせなくなる（同じ整理で1件見つかった）。利用規約 第13条の
-- 「進行中の取引がある場合は、発送など必要な対応を済ませてから退会」を仕組みで担保する。

create or replace function delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  r record;
begin
  if v_uid is null then
    raise exception 'ログインしていません';
  end if;

  if exists (
    select 1 from exchanges
     where (from_user_id = v_uid or to_user_id = v_uid)
       and status in ('pending', 'shipped')
  ) then
    raise exception '進行中の取引があります。発送と受け取りを済ませてから退会してください';
  end if;

  -- 自分の商品にぶら下がっている他の人の商品を、苗木として独り立ちさせる
  for r in select id from items where user_id = v_uid loop
    perform detach_children(r.id);
  end loop;

  select coalesce(array_agg(id), '{}') into v_ids from items where user_id = v_uid;

  delete from auth.users where id = v_uid;

  -- detach_children は「育っている」子だけを扱う。取引が終わった子などが
  -- 消えた根を指したまま残らないよう、自分で根になってもらう
  update items
     set parent_id = null, root_id = id, depth = 0
   where root_id = any(v_ids) or parent_id = any(v_ids);
end $$;

revoke all on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;
