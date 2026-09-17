-- ============================================================================
-- 0056_admin_user_cards_suspended_at.sql — ユーザー詳細に停止日を出す
--
-- 0055 で profiles.suspended_at を足したが、管理画面が読む admin_user_cards
-- （0041）は列を名指しで並べているので、足しただけでは出てこない。
-- create or replace view は「末尾に列を足す」だけなら作り直さずに済む。
-- ============================================================================

create or replace view admin_user_cards as
  select
    p.id,
    p.nickname,
    p.avatar_url,
    p.fertilizer,
    p.is_premium,
    p.premium_until,
    p.is_suspended,
    p.suspended_reason,
    p.created_at,
    u.email,
    u.last_sign_in_at,
    (select count(*) from items i where i.user_id = p.id and i.status <> 'deleted') as item_count,
    (select count(*) from exchanges e where p.id in (e.from_user_id, e.to_user_id)) as trade_count,
    (select count(*) from reports r where r.target_type = 'user' and r.target_id = p.id) as reported_count,
    p.suspended_at
  from profiles p
  left join auth.users u on u.id = p.id;

revoke all on admin_user_cards from anon, authenticated;
grant select on admin_user_cards to service_role;
