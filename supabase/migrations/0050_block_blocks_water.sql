-- ブロックしている／されている相手には水やりできないようにする（テスト仕様 G-9）。
--
-- blocks テーブルはあったが、水やりの判定では一度も参照していなかった。
-- 一覧からは相手の出品が消えるので気づきにくいが、通知やしおり、URL を直接開けば
-- 商品画面には入れてしまい、そこから水やりできていた（2026-09-14 に自動テストで確認）。
--
-- can_water() に足す。water() は先頭で can_water() を見ているので、
-- サーバ側の入口はこれで閉じる。アプリ側の表示も同じ条件を持たせる。
--
-- 向きは両方を見る：
--   ・自分がブロックした相手 … 関わりたくないので当然不可
--   ・自分をブロックした相手 … 相手が拒んでいるので不可
--
-- 判定は「相手＝対象商品の持ち主」。木の持ち主まで広げると、
-- 途中の1人をブロックしただけで無関係な木すべてに入れなくなるため、
-- ここでは対象商品の持ち主だけを見る。

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
    )
    -- ブロックしている／されている相手の商品には水やりできない
    and not exists (
      select 1
      from blocks b
      join items t on t.id = p_target_id
      where (b.blocker_id = p_user_id and b.blocked_id = t.user_id)
         or (b.blocker_id = t.user_id and b.blocked_id = p_user_id)
    );
$$;

insert into public._gungun_migrations (name)
values ('0050_block_blocks_water.sql')
on conflict do nothing;
