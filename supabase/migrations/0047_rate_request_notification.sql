-- ============================================================================
-- 0047_rate_request_notification.sql — 受け取ったら「評価をお願いします」を出す
--
-- 2026-09-09 の会議の指摘：
--   「受け取るで評価していなくても、おそらく対応完了みたいになっているので、
--     しっかり評価もそのフローに入れてほしい」
--
-- これまで受け取りの通知は「相手が受け取りました」を送り手に出すだけで、
-- 受け取った本人には何も出ていなかった。評価は取引の最後の手順なので、
-- 受け取った時点で本人あてに通知を出し、通知一覧から評価画面へ行けるようにする。
--
-- 0046 で足した notification_type 'rate_request' を使う（enum の追加値は
-- 同じトランザクションでは使えないのでファイルを分けている）。
-- 関数の他の部分は 0033 のままで、通知を1本足しただけ。
-- ============================================================================

create or replace function receive_exchange(p_exchange_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e exchanges;
  v_mine exchanges;
  v_who text;
  v_item text;
  v_partner text;
  v_remaining int;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e.id is null then raise exception '取引が見つかりません'; end if;
  if e.to_user_id <> auth.uid() then raise exception '自分の受け取りではありません'; end if;

  -- すでに受け取り済みなら、それは失敗ではない。二重タップ・再送信で普通に起きる
  if e.status = 'received' then return; end if;
  if e.status = 'pending' then
    raise exception 'まだ相手が発送していません。発送されると通知が届きます';
  end if;

  -- 自分が発送していないうちは受け取れない（滞留防止）
  select * into v_mine from exchanges
   where harvest_id = e.harvest_id and from_user_id = auth.uid();
  if v_mine.id is not null and v_mine.status = 'pending' then
    raise exception '先にご自身の発送を完了してください';
  end if;

  update exchanges set status = 'received', received_at = now() where id = p_exchange_id;

  select nickname into v_who from profiles where id = e.to_user_id;
  select name into v_item from items where id = e.item_id;
  insert into notifications (user_id, type, body, related_id)
  values (
    e.from_user_id, 'received',
    coalesce(v_who, '相手') || 'さんが「' || coalesce(v_item, '商品') || '」を受け取りました',
    p_exchange_id
  );

  -- 受け取った本人に、評価をお願いする（2026-09-09 指摘）。
  -- すでに評価が入っていれば出さない。受け取りは一度きりなので普通は起きないが、
  -- 運用でデータを直したときに二重に出るのを防ぐ
  if not exists (
    select 1 from ratings
     where exchange_id = p_exchange_id and rater_id = e.to_user_id
  ) then
    select nickname into v_partner from profiles where id = e.from_user_id;
    insert into notifications (user_id, type, body, related_id)
    values (
      e.to_user_id, 'rate_request',
      coalesce(v_partner, '相手') || 'さんの評価をお願いします。取引の最後の手順です',
      p_exchange_id
    );
  end if;

  -- 輪の全員が受け取り終わったら、その輪の商品を完了にする（0028）
  select count(*) into v_remaining
    from exchanges where harvest_id = e.harvest_id and status <> 'received';

  if v_remaining = 0 then
    update items set status = 'completed'
     where id in (select item_id from exchanges where harvest_id = e.harvest_id)
       and status = 'trading';
  end if;
end $$;
