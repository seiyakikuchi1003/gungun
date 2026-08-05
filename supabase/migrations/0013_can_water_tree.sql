-- ============================================================================
-- 0013_can_water_tree.sql — 水やり可否を「木全体」で判定する（2026-08-05 変更）
--
-- 【変更前】target の祖先ライン（target自身〜root）に自分の item があれば不可。
--           → 同じ木でも、自分と交わらない別の枝には水やりできた。
--
-- 【変更後】target が属する木（同じ root_id）に自分の item が1つでもあれば不可。
--           → 1ユーザーは1つの木につき1回だけ水やりできる。
--
-- 【なぜ deleted を除くか】
--   delete_item は物理削除せず status='deleted' にする（子は detach_children で
--   新しい種として独立）。削除した本人はもうその木にいないので、
--   除外しないと「一度出して消したら二度とその木に入れない」ことになってしまう。
--
-- 【収穫後のリセットについて】
--   収穫すると残った枝が新しい種になり root_id が変わる（detach_children）。
--   root_id で判定しているので、以前その木にいた人も新しい木には改めて水やりできる。
--   特別な処理は要らない。
-- ============================================================================

create or replace function can_water(p_user_id uuid, p_target_id uuid)
returns boolean language sql stable as $$
  select
    (select status from items where id = p_target_id) = 'growing'
    and not exists (
      select 1
      from items i
      where i.root_id = (select root_id from items where id = p_target_id)
        and i.user_id = p_user_id
        and i.status <> 'deleted'
    );
$$;
