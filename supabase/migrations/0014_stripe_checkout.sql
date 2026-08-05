-- ============================================================================
-- 0014_stripe_checkout.sql — Stripe 決済の受け皿（2026-08-05）
--
-- 決済方式は Stripe Checkout に決定（2026-08-05）。
-- 肥料＝都度決済、プレミアム＝サブスクリプション。
--
-- 【流れ】
--   アプリ  … Edge Function create-checkout-session を呼ぶ（自分のJWTで）
--   関数    … app_settings の charge_plans から金額を引いて Checkout を作る
--             ★金額はアプリから受け取らない。受け取ると改造で1円にできてしまう
--   ブラウザ… Stripe の決済画面で支払う
--   Stripe  … webhook で Edge Function stripe-webhook を叩く
--   関数    … 署名を検証 → redeem_purchase() を service_role で呼ぶ
--   DB      … (platform, transaction_id) の一意制約で二重付与を防ぐ（0009）
--
-- ⚠ App Store 審査ガイドライン 3.1.1 では、アプリ内で消費するデジタル財は
--   In-App Purchase が必須とされる。Stripe のままだと差し戻しの可能性がある。
--   決済部分は差し替えられる形にしてあるので、審査提出前に再検討すること。
-- ============================================================================

-- 購入元に stripe を足す（0009 は ios / android / admin のみだった）
-- ※ 追加した値はこのトランザクション内では使えないため、ここでは使わない
alter type purchase_platform add value if not exists 'stripe';

-- ── 販売プラン（管理画面から変更できる。ハードコード禁止）────────────
-- fertilizer … 付与する肥料
-- price      … 円（税込）
-- badge      … 画面に出すラベル（空なら出さない）
insert into app_settings (key, value)
values ('charge_plans', '[
  {"id": "c1", "fertilizer": 1000, "price": 500,  "badge": ""},
  {"id": "c2", "fertilizer": 3000, "price": 1200, "badge": "お得"},
  {"id": "c3", "fertilizer": 7000, "price": 2500, "badge": "人気"}
]'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- プレミアムの商品定義（月額。日数はサブスクの1周期ぶん）
insert into app_settings (key, value)
values ('premium_product', '{"days": 30}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
