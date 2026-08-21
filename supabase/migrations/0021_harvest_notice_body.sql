-- ============================================================================
-- 0021_harvest_notice_body.sql — 収穫通知にタネの名前を入れる（2026-08-12）
--
-- 「収穫が成立しました。発送をお願いします」だけでは、どのタネの話か分からなかった。
-- 0020 で用意した harvest_notice_body() を使って「「〇〇」の収穫が成立しました」にする。
-- 関数の中身は現行定義をそのまま引き継ぎ、通知の1行だけを差し替えている。
-- ============================================================================

CREATE OR REPLACE FUNCTION public.harvest_unchecked(p_root_id uuid, p_target_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_path uuid[];
  v_harvest_id uuid;
  v_len int;
  i int;
  v_from record;
  v_to record;
begin
  -- 1) root → target の一本道を取得（祖先を辿って深さ順）
  select array_agg(id order by depth) into v_path from get_ancestors(p_target_id);

  v_len := array_length(v_path, 1);
  if v_len is null or v_path[1] <> p_root_id then
    raise exception 'この商品はそのタネの木に含まれていません';
  end if;

  -- 2) 収穫レコード（unique 制約で1種1収穫を担保）
  insert into harvests (root_item_id, harvested_item_id)
  values (p_root_id, p_target_id) returning id into v_harvest_id;

  -- 3) パス外の枝を切り離す（＝新しい種として独立）
  for i in 1 .. v_len loop
    perform detach_children(v_path[i], case when i < v_len then v_path[i + 1] else null end);
  end loop;
  perform detach_children(p_target_id);

  -- 4) パス上のノードを取引中に
  update items set status = 'trading' where id = any(v_path);

  -- 5) 玉突きの輪
  for i in 1 .. v_len loop
    select * into v_from from items where id = v_path[i];
    select * into v_to   from items where id = v_path[ case when i = v_len then 1 else i + 1 end ];

    insert into exchanges (harvest_id, item_id, from_user_id, to_user_id, position)
    values (v_harvest_id, v_from.id, v_from.user_id, v_to.user_id, i - 1);
  end loop;

  -- 6) 発送義務の通知
  insert into notifications (user_id, type, body, related_id)
  select from_user_id, 'harvested', harvest_notice_body(v_harvest_id), v_harvest_id
  from exchanges where harvest_id = v_harvest_id;

  return v_harvest_id;
end $function$

