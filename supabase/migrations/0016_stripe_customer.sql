-- ============================================================================
-- 0016_stripe_customer.sql — プレミアムの解約導線に必要な顧客IDを保持する
--
-- 解約は Stripe のカスタマーポータル（Stripeが用意している管理画面）に飛ばす。
-- そこを開くには「この人の Stripe 上の顧客ID」が必要なので、
-- サブスクの支払いが通ったときに控えておく。
--
-- 解約処理を自前で作らない理由：
--   支払い方法の変更・請求書の確認・解約を Stripe 側が用意しており、
--   自前で作るより確実で、法令表示（特商法・返金）も Stripe 側で満たせる。
-- ============================================================================

alter table profiles add column if not exists stripe_customer_id text;

comment on column profiles.stripe_customer_id is
  'Stripe の顧客ID。プレミアムの解約・支払い方法の変更をカスタマーポータルで行うために保持する';

create index if not exists profiles_stripe_customer_idx
  on profiles (stripe_customer_id) where stripe_customer_id is not null;

-- webhook（service_role）から更新する。本人には見せる必要がないが、
-- 自分の行を読むぶんには害がないので RLS の既存ポリシーのままでよい。
