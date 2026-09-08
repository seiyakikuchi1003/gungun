-- ============================================================================
-- 0044_meeting_0821_notify.sql — 2026-08-21 会議の通知まわり
--
-- 0043 で足した notification_type 'sapling' を使う（enum の追加値は
-- 同じトランザクション内では使えないため、0026→0027 と同じくファイルを分ける）。
--
-- 1. 苗木になったことが分からない
--    「実際取引成立して、俺、苗木になったじゃん。通知が来てないんだよ」
--    収穫のパスから外れた枝は新しい種（苗木）として独立するが、
--    持ち主には何も届かず、自分の商品がどうなったか分からなかった。
--
-- 2. 3段目以降の水やりが種の持ち主に届かない
--    「その木に対して水やりしたものに関しては、その種を植えた人には全部来ること」
--    これまでは水やりされた商品の持ち主（＝直接の親）にしか通知していないため、
--    2段目・3段目に水やりが付いても、木を育てている種の持ち主は気づけなかった。
-- ============================================================================

-- ── 1. 苗木として独立したら、その持ち主に知らせる ──────────
create or replace function detach_children(p_item_id uuid, p_exclude_id uuid default null)
returns void language plpgsql as $$
declare c record;
begin
  for c in
    select * from items
    where parent_id = p_item_id
      and (p_exclude_id is null or id <> p_exclude_id)
      and status = 'growing'
  loop
    -- 子を根に昇格
    update items set parent_id = null, root_id = c.id, depth = 0 where id = c.id;

    -- その子孫の root_id / depth を付け替え
    with recursive d as (
      select id, 0 as lvl from items where id = c.id
      union all
      select i.id, d.lvl + 1 from items i join d on i.parent_id = d.id
    )
    update items i set root_id = c.id, depth = d.lvl
    from d where i.id = d.id and i.id <> c.id;

    -- 苗木になったことを持ち主に伝える（2026-08-21 指摘）。
    -- 自分の操作で自分の商品が外れた場合は、結果が分かっているので出さない。
    if c.user_id is distinct from auth.uid() then
      insert into notifications (user_id, type, body, related_id)
      values (
        c.user_id,
        'sapling',
        '「' || c.name || '」が苗木になりました。あなたのタネとして育てられます',
        c.id
      );
    end if;
  end loop;
end;
$$;

-- ── 2. 水やりは、木の持ち主にも届くようにする ───────────────
create or replace function water(
  p_user_id uuid,
  p_target_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_condition text,
  p_images text[] default '{}'
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
  v_cost int;
  v_balance int;
  v_target items;
  v_root items;
  v_who text;
  i int;
begin
  if not can_water(p_user_id, p_target_id) then
    raise exception 'cannot water this item (can_water=false)';
  end if;

  select * into v_target from items where id = p_target_id;

  v_cost := coalesce(get_setting_int('water_cost'), 0);
  select fertilizer into v_balance from profiles where id = p_user_id;
  if v_balance < v_cost then
    raise exception 'insufficient fertilizer: balance=% cost=%', v_balance, v_cost;
  end if;

  -- 子ノード作成（root_id/depth はトリガが親から継承）
  insert into items (user_id, name, description, category, condition, parent_id)
  values (p_user_id, p_name, p_description, p_category, p_condition, p_target_id)
  returning id into v_id;

  if p_images is not null then
    for i in 1 .. coalesce(array_length(p_images, 1), 0) loop
      insert into item_images (item_id, url, sort_order)
      values (v_id, p_images[i], i - 1);
    end loop;
  end if;

  -- 肥料消費＋台帳
  update profiles set fertilizer = fertilizer - v_cost where id = p_user_id;
  insert into fertilizer_ledger (user_id, amount, reason, related_item_id)
  values (p_user_id, -v_cost, 'watering', v_id);

  -- 対象商品の出品者へ通知（誰が水やりしたかを入れる）
  select nickname into v_who from profiles where id = p_user_id;
  insert into notifications (user_id, type, body, related_id)
  values (
    v_target.user_id,
    'watered',
    coalesce(v_who, '誰か') || 'さんが「' || v_target.name || '」に水やりしました',
    v_id
  );

  -- 木の持ち主（種を植えた人）にも届ける（2026-08-21 指摘）。
  -- 2段目・3段目に付いた水やりは、これまで種の持ち主に届いていなかった。
  -- 直接の親が種そのものだった場合は、上の通知と同じ相手になるので出さない。
  -- 自分の木に自分で水やりすることはない（can_water で弾かれる）が、念のため除く。
  select * into v_root from items where id = v_target.root_id;
  if v_root.id is not null
     and v_root.id <> v_target.id
     and v_root.user_id <> v_target.user_id
     and v_root.user_id <> p_user_id
  then
    insert into notifications (user_id, type, body, related_id)
    values (
      v_root.user_id,
      'watered',
      coalesce(v_who, '誰か') || 'さんが、あなたの木の「' || v_target.name || '」に水やりしました',
      v_id
    );
  end if;

  return v_id;
end;
$$;
