-- 管理画面（admin/）が必要とする列とテーブル
--
-- 方針：管理画面は service_role キーで RLS を越えて読み書きするため、
-- ここで足すのは「運営が状態を持つための列」だけ。アプリ側の RLS は変更しない。

-- ── 通報の対応状況 ─────────────────────────────────────────
create type report_status as enum ('open', 'resolved', 'dismissed');

alter table reports
  add column status      report_status not null default 'open',
  add column handled_at  timestamptz,
  add column handled_note text;

create index on reports (status);
create index on reports (created_at desc);

-- ── ユーザーの利用停止 ─────────────────────────────────────
-- 停止中は出品・水やり・投稿ができない（RPC 側で弾く）。閲覧は可能。
alter table profiles
  add column is_suspended boolean not null default false,
  add column suspended_reason text;

-- 出品系 RPC は停止ユーザーを弾く
create or replace function assert_not_suspended(p_user uuid)
returns void language plpgsql as $$
begin
  if exists (select 1 from profiles where id = p_user and is_suspended) then
    raise exception '利用が停止されているため、この操作はできません';
  end if;
end $$;

-- ── 運営操作の監査ログ ─────────────────────────────────────
-- 誰が何をしたかを残す。お客様アカウントへ引き継いだ後も追跡できるようにする。
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,             -- 管理画面のログイン名（v1 は 'admin' 固定）
  action text not null,            -- 'suspend_user' | 'delete_item' | 'resolve_report' | 'update_setting' など
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on admin_audit_log (created_at desc);

alter table admin_audit_log enable row level security;
-- 一般ユーザーには一切見せない（service_role のみ RLS をバイパスして読み書きする）

-- ── 管理画面から編集する設定の既定値を追加 ──────────────────
insert into app_settings (key, value) values
  ('premium_price_yen',   '480'::jsonb),
  ('seed_price_yen',      '300'::jsonb),
  ('max_images_per_item', '4'::jsonb)
on conflict (key) do nothing;
