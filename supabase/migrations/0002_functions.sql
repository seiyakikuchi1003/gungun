-- ぐんぐん コアロジック（ツリー操作）
-- docs/gungun-spec.md 3-1〜3-4 に忠実。ツリーの親子付けは必ずDB側（RPC）で行う。
-- アプリからは呼ぶだけ（トランザクション整合性のため）。

-- ── 設定ヘルパー（app_settings から int を読む。ハードコード禁止対応）──
create or replace function get_setting_int(p_key text)
returns int language sql stable as $$
  select (value #>> '{}')::int from app_settings where key = p_key;
$$;

-- ── ツリー自動設定トリガ ───────────────────────────────────
-- 種（parent_id=null）: root_id=自分自身, depth=0
-- 水やり（parent_id指定）: root_id=親のroot_id, depth=親.depth+1
-- ※ id は列デフォルト(gen_random_uuid)で BEFORE INSERT 時点で既に確定している
create or replace function set_item_tree()
returns trigger language plpgsql as $$
begin
  if new.parent_id is null then
    new.root_id := new.id;
    new.depth := 0;
  else
    select p.root_id, p.depth + 1 into new.root_id, new.depth
    from items p where p.id = new.parent_id;
    if new.root_id is null then
      raise exception 'parent item % not found', new.parent_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_set_item_tree
  before insert on items
  for each row execute function set_item_tree();

-- ── 3-1. 祖先ラインの取得（target を含む、root までの祖先）──
create or replace function get_ancestors(target_id uuid)
returns setof items language sql stable as $$
  with recursive line as (
    select * from items where id = target_id
    union all
    select i.* from items i join line l on i.id = l.parent_id
  )
  select * from line;
$$;

-- ── 3-2. 水やり可否の判定 ──────────────────────────────────
-- target の祖先ライン（target自身〜root）に自分のitemが1つでもあれば不可。
create or replace function can_water(p_user_id uuid, p_target_id uuid)
returns boolean language sql stable as $$
  select
    (select status from items where id = p_target_id) = 'growing'
    and not exists (
      select 1 from get_ancestors(p_target_id) a
      where a.user_id = p_user_id
    );
$$;

-- ── 3-3. ノード離脱＝子孫の新root化（収穫・削除・植え直しで共通）──
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
  end loop;
end;
$$;

-- ── 種を植える（出品）─────────────────────────────────────
-- parent_id=null の item を作成。root_id/depth はトリガが設定。
create or replace function plant_seed(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_condition text,
  p_images text[] default '{}'
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
  i int;
begin
  insert into items (user_id, name, description, category, condition)
  values (p_user_id, p_name, p_description, p_category, p_condition)
  returning id into v_id;

  if p_images is not null then
    for i in 1 .. coalesce(array_length(p_images, 1), 0) loop
      insert into item_images (item_id, url, sort_order)
      values (v_id, p_images[i], i - 1);
    end loop;
  end if;

  return v_id;
end;
$$;

-- ── 水やり（＝自分の商品を対象の子として出品）───────────────
-- watering-fix 指示書の核心：水やりは必ず自分の商品の出品を伴う。
-- 1) can_water で可否判定 2) 肥料残高チェック（設定から読む）
-- 3) 子ノード作成 4) 画像 5) 肥料消費＋台帳 6) 対象出品者へ通知
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

  -- 対象商品の出品者へ通知
  insert into notifications (user_id, type, body, related_id)
  values (v_target.user_id, 'watered',
          v_target.name || ' に水やりがありました', v_id);

  return v_id;
end;
$$;

-- ── 3-4. 収穫（玉突き交換の生成）──────────────────────────
create or replace function harvest(p_root_id uuid, p_target_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_path uuid[];
  v_harvest_id uuid;
  v_len int;
  i int;
  v_from record;
  v_to record;
begin
  -- 1) root → target の一本道を取得（祖先を辿って深さ順）
  select array_agg(id order by depth) into v_path
  from get_ancestors(p_target_id);

  v_len := array_length(v_path, 1);
  if v_path[1] <> p_root_id then
    raise exception 'target is not in this tree';
  end if;

  -- 2) 収穫レコード（unique制約で1種1収穫を担保）
  insert into harvests (root_item_id, harvested_item_id)
  values (p_root_id, p_target_id) returning id into v_harvest_id;

  -- 3) パス外の枝を切り離す（＝新しい種として独立）
  for i in 1 .. v_len loop
    perform detach_children(v_path[i], case when i < v_len then v_path[i + 1] else null end);
  end loop;
  -- target自身の子も全部切り離す
  perform detach_children(p_target_id);

  -- 4) パス上のノードを取引中に（他ルートから非表示・水やり不可）
  update items set status = 'trading' where id = any(v_path);

  -- 5) 玉突きの輪：path[i]の品 → path[i+1]の人／最後は path[len]の品 → path[1]の人
  for i in 1 .. v_len loop
    select * into v_from from items where id = v_path[i];
    select * into v_to   from items where id = v_path[ case when i = v_len then 1 else i + 1 end ];

    insert into exchanges (harvest_id, item_id, from_user_id, to_user_id, position)
    values (v_harvest_id, v_from.id, v_from.user_id, v_to.user_id, i - 1);
  end loop;

  -- 6) 発送義務の通知
  insert into notifications (user_id, type, body, related_id)
  select from_user_id, 'harvested', '収穫が成立しました。発送をお願いします', v_harvest_id
  from exchanges where harvest_id = v_harvest_id;

  return v_harvest_id;
end;
$$;
