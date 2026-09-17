-- ============================================================================
-- 0055_moderation.sql — 管理画面から「非表示」「警告」「停止」を実際に効かせる
--
-- 2026-09-17 の指摘：
--   ・通報の「対応済み」が何を指すのか分からない。対応されたユーザーがどうなるのか
--     分からない。一般的なアプリと同じ作りにしてほしい
--   ・掲示板の投稿を確認・管理する場所が無い
--   ・一斉メールが送れない
--
-- これまで「対応済み」は通報の状態を書き換えるだけで、相手には何も起きなかった。
-- 対応の中身（非表示・警告・停止・問題なし）を選んで、実際に効かせる。
-- ============================================================================

-- ── 1. 掲示板の投稿・コメント、商品へのコメントを非表示にできるようにする ──
--
-- 消さずに隠す。通報の記録と突き合わせられるように、本文は残しておく。
alter table board_posts    add column if not exists hidden_at timestamptz;
alter table board_posts    add column if not exists hidden_reason text;
alter table board_comments add column if not exists hidden_at timestamptz;
alter table board_comments add column if not exists hidden_reason text;
alter table item_comments  add column if not exists hidden_at timestamptz;
alter table item_comments  add column if not exists hidden_reason text;

-- アプリからは非表示のものを読めなくする。
-- board_cards ビューは security_invoker なので、ここを変えれば一覧とコメント数にも効く。
-- 管理画面は service_role で読むので、RLS を越えて非表示のものも見える。
drop policy if exists read_all_board_posts on board_posts;
create policy read_all_board_posts on board_posts
  for select using (hidden_at is null);

drop policy if exists read_all_board_comments on board_comments;
create policy read_all_board_comments on board_comments
  for select using (hidden_at is null);

drop policy if exists read_all_item_comments on item_comments;
create policy read_all_item_comments on item_comments
  for select using (hidden_at is null);

-- ── 2. 通報に「何をしたか」を残す ────────────────────────────
--
-- 状態（open / resolved / dismissed）だけでは、対応済みの中身が後から追えない。
--   hide_content  … 通報された投稿・商品を非表示にした
--   warn_user     … 投稿者に警告を送った
--   suspend_user  … 投稿者の利用を停止した
--   none          … 問題なしとして閉じた
alter table reports add column if not exists action_taken text;

-- ── 3. 利用停止の日時 ───────────────────────────────────────
alter table profiles add column if not exists suspended_at timestamptz;

-- ── 4. 運営から送ったメールの記録 ───────────────────────────
create table if not exists admin_mail_log (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null,
  body            text not null,
  recipient_count int  not null default 0,
  sent_count      int  not null default 0,
  failed_count    int  not null default 0,
  error           text,
  created_at      timestamptz not null default now()
);
-- 運営専用。アプリ（anon / authenticated）からは一切触れない
alter table admin_mail_log enable row level security;
revoke all on admin_mail_log from anon, authenticated;
