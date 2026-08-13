-- ============================================================================
-- 0023_no_edit_after_water.sql — 水やりされた後は編集させない（2026-08-12 確定）
--
-- 水やりは「その商品が欲しい」という意思表示なので、
-- 集まった後に中身を差し替えられると詐欺になる。
-- 画面側だけで止めても改造で回避できるため、DB側で拒否する。
--
-- 写真の追加・削除も内容の変更にあたるので同じ扱い。
-- ============================================================================

create or replace function update_item(
  p_item_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_condition text,
  p_images text[] default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_status item_status;
  v_watered int;
  i int;
begin
  select user_id, status into v_owner, v_status from items where id = p_item_id;
  if v_owner is null then raise exception '商品が見つかりません'; end if;
  if v_owner <> auth.uid() then raise exception '自分の出品ではありません'; end if;
  if v_status <> 'growing' then raise exception '取引中・収穫済みの商品は編集できません'; end if;

  -- 水やりされた後の変更は認めない（2026-08-12 確定）
  select count(*) into v_watered from items where parent_id = p_item_id and status <> 'deleted';
  if v_watered > 0 then
    raise exception '水やりされた後は内容を変更できません';
  end if;

  update items
     set name = p_name,
         description = p_description,
         category = p_category,
         condition = p_condition
   where id = p_item_id;

  -- 画像は渡されたときだけ差し替える
  if p_images is not null then
    delete from item_images where item_id = p_item_id;
    for i in 1 .. coalesce(array_length(p_images, 1), 0) loop
      insert into item_images (item_id, url, sort_order)
      values (p_item_id, p_images[i], i - 1);
    end loop;
  end if;
end $$;
