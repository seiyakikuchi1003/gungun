-- ============================================================================
-- 0015_feedback_0805.sql — 2026-08-05 のフィードバック反映
--
-- 1. 種植えは0肥料に確定（無料で出品できる）
-- 2. 水やりの通知に「誰が」を入れる
-- ============================================================================

-- ── 1. 種植えは無料 ────────────────────────────────────────
-- plant_seed は元から肥料を引いていないが、設定値が 300 のままで
-- 「減るはずなのに減らない」と読めてしまうため、実態に合わせて 0 にする。
update app_settings set value = to_jsonb(0), updated_at = now() where key = 'seed_price_yen';

-- ── 2. 水やり通知に誰が水やりしたかを入れる ────────────────
-- これまでは「<商品名> に水やりがありました」だけで、相手が分からなかった。
-- 通知を開くまで誰か分からないのは不親切なので、ニックネームを添える。
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

  return v_id;
end;
$$;
