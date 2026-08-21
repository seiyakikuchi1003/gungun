-- ============================================================================
-- 0041_admin_user_cards.sql — 管理画面のユーザー一覧を見やすくする（2026-08-21）
--
-- 一覧にニックネームしか出ておらず、同名の人を見分けられなかった。
-- IDの先頭を添えてみたものの、デモ用のIDが揃っていて役に立っていない。
-- 運営が本当に必要とするのはメールアドレスなので、それを引けるようにする。
--
-- ⚠ メールアドレスは auth.users にあり、通常のキーでは読めない。
--   このビューは service_role（管理画面のサーバー側）からのみ使う。
--   アプリ（anon キー）からは読めないよう、明示的に権限を絞る。
-- ============================================================================

-- security_invoker にすると呼び出し側の権限で auth.users を読むことになり、
-- service_role でも「permission denied for table users」で弾かれた。
-- 定義者（postgres）の権限で動かし、参照できる相手を service_role だけに絞る。
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
    (select count(*) from reports r where r.target_type = 'user' and r.target_id = p.id) as reported_count
  from profiles p
  left join auth.users u on u.id = p.id;

revoke all on admin_user_cards from anon, authenticated;
grant select on admin_user_cards to service_role;

comment on view admin_user_cards is
  '管理画面のユーザー一覧。メールや件数を添える。service_role 専用';
