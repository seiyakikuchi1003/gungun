-- 残りロードマップ（課金・プッシュ通知・既存ユーザー移行）に必要な土台
--
-- ここまでの 0001〜0008 で「アプリが今動かしている機能」のスキーマは揃っている。
-- このマイグレーションは、まだ実装に入っていない次の3つを受け止める器を先に作る。
--
--   1. プレミアムの有効期限      … 解約しても永久にプレミアムのままになる穴を塞ぐ
--   2. 課金レシート（IAP）        … 二重付与を DB 側で防ぐ
--   3. プッシュ通知のトークン     … 端末を跨いだ付け替えと二重送信を防ぐ
--   4. 既存160人の移行台帳        … 何度流しても壊れない移行にする
--
-- ＋ 運用で困る細かい穴を2つ（通報の重複、items の更新日時）。
-- ＋ 【不具合修正】取引・評価・通報をしたことがある人が退会できない（下記 7）。


-- ============================================================================
-- 1. プレミアムの有効期限
-- ============================================================================
--
-- これまで profiles.is_premium は boolean 1つだけだった。
-- サブスクは「期限が来たら自動で切れる」必要があるが、boolean だけでは
-- 誰かが手で false にするまで永久にプレミアムのままになる。
--
-- 【役割分担】
--   is_premium    … アプリ・管理画面が読む「いまプレミアムか」。これが正。
--   premium_until … いつ切れるか。NULL は「期限なし」（運営が手で付与した場合）。
--
-- 期限切れの反映は expire_premium() が行う。
-- ログインボーナスの計算前に必ず呼ぶので、特典が余分に出ることはない。

alter table profiles
  add column if not exists premium_until timestamptz;

comment on column profiles.premium_until is
  'プレミアムの期限。NULL は期限なし（運営付与）。期限切れは expire_premium() が is_premium=false にする';

create index if not exists profiles_premium_until_idx
  on profiles (premium_until) where is_premium;

-- 期限切れのプレミアムを落とす。戻り値は落とした人数。
-- pg_cron から1日1回呼ぶのが理想だが、呼ばれなくても
-- claim_login_bonus() の中から都度呼ぶので特典計算は必ず正しくなる。
create or replace function expire_premium()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update profiles
     set is_premium = false
   where is_premium
     and premium_until is not null
     and premium_until <= now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function expire_premium() from public;
grant execute on function expire_premium() to service_role;

-- claim_login_bonus を「期限切れを反映してから判定する」形に差し替える。
-- 中身（金額の決め方・台帳への記録）は 0008 と同じ。
create or replace function claim_login_bonus()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last date;
  v_premium boolean;
  v_until timestamptz;
  v_amount int;
begin
  if v_uid is null then raise exception 'ログインしていません'; end if;

  select last_login_bonus_on, coalesce(is_premium, false), premium_until
    into v_last, v_premium, v_until
    from profiles where id = v_uid for update;

  if v_last = v_today then
    return 0;
  end if;

  -- 期限が切れていれば、この人のぶんだけ即座に落とす（cron を待たない）
  if v_premium and v_until is not null and v_until <= now() then
    v_premium := false;
    update profiles set is_premium = false where id = v_uid;
  end if;

  if v_premium then
    v_amount := coalesce(
      get_setting_int('daily_login_bonus_premium'),
      get_setting_int('daily_login_bonus'),
      0
    );
  else
    v_amount := coalesce(get_setting_int('daily_login_bonus'), 0);
  end if;

  update profiles
     set fertilizer = fertilizer + v_amount,
         last_login_bonus_on = v_today
   where id = v_uid;

  insert into fertilizer_ledger (user_id, amount, reason)
  values (v_uid, v_amount, 'login_bonus');

  return v_amount;
end $$;


-- ============================================================================
-- 2. 課金レシート（App Store の In-App Purchase）
-- ============================================================================
--
-- ⚠ レシートの検証は必ずサーバ側で行う。
--   アプリから「肥料を1200増やして」と言わせてはいけない（誰でも改造できる）。
--   流れ：
--     アプリ  … StoreKit で購入 → レシートをサーバへ送る
--     サーバ  … Apple に検証を投げる → 通ったら redeem_purchase() を service_role で呼ぶ
--     DB      … transaction_id が既にあれば何もしない（二重付与を防ぐ）
--
--   「サーバ」は Supabase Edge Function か管理画面（Next.js）の API を想定。
--   どちらにするかは課金方式の確定後に決める。

create type purchase_platform as enum ('ios', 'android', 'admin');
create type purchase_kind     as enum ('fertilizer', 'premium');

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  platform purchase_platform not null,
  kind purchase_kind not null,
  product_id text not null,            -- App Store Connect の商品ID
  transaction_id text not null,        -- レシートの一意ID。再送・リプレイの判定に使う
  fertilizer_amount int not null default 0,   -- kind='fertilizer' のとき付与する肥料
  premium_days int not null default 0,        -- kind='premium' のとき延ばす日数
  price_jpy int,                       -- 記録用。金額は app_settings が正
  raw jsonb,                           -- 検証したレシート全文（問い合わせ対応用）
  created_at timestamptz not null default now(),

  -- 同じレシートで二度付与できない。これが二重付与を防ぐ最後の砦。
  unique (platform, transaction_id)
);
create index on purchases (user_id, created_at desc);

comment on table purchases is
  'IAPのレシート。付与は redeem_purchase() 経由のみ。(platform, transaction_id) の一意制約が二重付与を防ぐ';

-- 肥料の増減理由に「サブスク由来」を足す（既存の 'purchase' は肥料の単発購入）
alter type fertilizer_reason add value if not exists 'subscription';

-- レシート1件を反映する。既に処理済みなら何もせず false を返す（冪等）。
--
-- p_premium_days > 0 のときは、いまの期限（切れていれば now()）から積み増す。
-- 更新のたびに呼べば自然に延びていく。
create or replace function redeem_purchase(
  p_user           uuid,
  p_platform       purchase_platform,
  p_kind           purchase_kind,
  p_product_id     text,
  p_transaction_id text,
  p_fertilizer     int  default 0,
  p_premium_days   int  default 0,
  p_price_jpy      int  default null,
  p_raw            jsonb default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_inserted boolean := false;
begin
  if p_user is null then raise exception 'user が指定されていません'; end if;

  insert into purchases (
    user_id, platform, kind, product_id, transaction_id,
    fertilizer_amount, premium_days, price_jpy, raw
  ) values (
    p_user, p_platform, p_kind, p_product_id, p_transaction_id,
    greatest(coalesce(p_fertilizer, 0), 0),
    greatest(coalesce(p_premium_days, 0), 0),
    p_price_jpy, p_raw
  )
  on conflict (platform, transaction_id) do nothing;

  -- 挿入できなかった＝このレシートは既に処理済み
  if not found then
    return false;
  end if;
  v_inserted := true;

  if p_kind = 'fertilizer' and coalesce(p_fertilizer, 0) > 0 then
    update profiles
       set fertilizer = fertilizer + p_fertilizer
     where id = p_user;

    insert into fertilizer_ledger (user_id, amount, reason)
    values (p_user, p_fertilizer, 'purchase');
  end if;

  if p_kind = 'premium' and coalesce(p_premium_days, 0) > 0 then
    update profiles
       set is_premium = true,
           -- 期限が切れている（または未設定）なら now() を起点に積む
           premium_until = greatest(coalesce(premium_until, now()), now())
                           + make_interval(days => p_premium_days)
     where id = p_user;
  end if;

  return v_inserted;
end $$;

-- ★ アプリからは絶対に呼べないようにする（サーバ検証を経たものだけ）
revoke all on function redeem_purchase(
  uuid, purchase_platform, purchase_kind, text, text, int, int, int, jsonb
) from public;
grant execute on function redeem_purchase(
  uuid, purchase_platform, purchase_kind, text, text, int, int, int, jsonb
) to service_role;


-- ============================================================================
-- 3. プッシュ通知のトークン
-- ============================================================================
--
-- 主キーをトークンにしている理由：
--   同じ端末で別アカウントにログインし直したとき、トークンの持ち主を
--   付け替えたい（前の人に通知が飛び続けるのを防ぐ）。upsert 一発で入れ替わる。

create table push_tokens (
  token text primary key,                       -- Expo Push Token
  user_id uuid not null references profiles on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index on push_tokens (user_id);

comment on table push_tokens is
  '端末のプッシュ通知トークン。主キーは token（端末の持ち主が変わったら付け替わる）';

-- 二重送信を防ぐため、送った通知には印を付ける
alter table notifications
  add column if not exists pushed_at timestamptz;

create index if not exists notifications_unpushed_idx
  on notifications (created_at) where pushed_at is null;

-- 送信側（サーバ）が拾う未送信ぶん。ブロック中の相手からの通知は送らない。
create or replace view notifications_to_push as
  select n.id,
         n.user_id,
         n.type,
         n.body,
         n.related_id,
         n.created_at,
         t.token,
         t.platform
    from notifications n
    join push_tokens t on t.user_id = n.user_id
   where n.pushed_at is null
     and n.read_at is null;

comment on view notifications_to_push is
  'まだプッシュしていない通知 × 端末トークン。送信後に notifications.pushed_at を埋める';

-- 自分の端末を登録する（アプリから呼ぶ）
create or replace function register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'ログインしていません'; end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'platform は ios か android を指定してください';
  end if;

  insert into push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_uid, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,          -- 端末の持ち主が変わったら付け替える
        platform = excluded.platform,
        updated_at = now();
end $$;

revoke all on function register_push_token(text, text) from public;
grant execute on function register_push_token(text, text) to authenticated;

-- ログアウト時に外す
create or replace function unregister_push_token(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'ログインしていません'; end if;
  delete from push_tokens where token = p_token and user_id = auth.uid();
end $$;

revoke all on function unregister_push_token(text) from public;
grant execute on function unregister_push_token(text) to authenticated;


-- ============================================================================
-- 4. 既存ユーザー（Click版・約160人）の移行台帳
-- ============================================================================
--
-- 旧サービスから名簿を入れておき、その人が新規登録したら自動で紐づける。
-- 「誰に案内メールを送ったか」「誰がまだ戻ってきていないか」を追える。
--
-- パスワードは移行できない（旧サービスのハッシュ形式が違う）ため、
-- 全員に「再登録のお願い」を送る運用になる。

create table legacy_users (
  legacy_id text primary key,             -- 旧サービスのユーザーID
  email text not null,
  nickname text,
  raw jsonb,                              -- 旧データそのまま（後から参照できるように）
  profile_id uuid references profiles on delete set null,
  invited_at timestamptz,                 -- 案内メールを送った日時
  migrated_at timestamptz,                -- 新サービスで登録が完了した日時
  created_at timestamptz not null default now()
);

-- 同じメールを二重に登録しない（大文字小文字は同一視）
create unique index legacy_users_email_key on legacy_users (lower(email));
create index on legacy_users (migrated_at);

comment on table legacy_users is
  'Click版からの移行名簿。新規登録時に handle_new_user() がメール一致で紐づける';

-- サインアップ時に、旧名簿と突き合わせて紐づける。
-- 0005 の handle_new_user を置き換える（profiles を作る部分は同じ）。
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nickname text;
  v_legacy   legacy_users;
begin
  -- 旧名簿にいる人なら、そのニックネームを引き継ぐ
  select * into v_legacy
    from legacy_users
   where lower(email) = lower(new.email)
   limit 1;

  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    nullif(trim(v_legacy.nickname), ''),
    split_part(new.email, '@', 1)
  );

  insert into profiles (id, nickname)
  values (new.id, left(v_nickname, 20))
  on conflict (id) do nothing;

  -- 移行完了として記録
  if v_legacy.legacy_id is not null then
    update legacy_users
       set profile_id = new.id,
           migrated_at = coalesce(migrated_at, now())
     where legacy_id = v_legacy.legacy_id;
  end if;

  return new;
end $$;

-- 移行の進捗（管理画面から見る用）
create or replace view legacy_migration_status as
  select count(*)                                          as total,
         count(*) filter (where migrated_at is not null)    as migrated,
         count(*) filter (where migrated_at is null
                            and invited_at is not null)     as invited_not_yet,
         count(*) filter (where invited_at is null)         as not_invited
    from legacy_users;


-- ============================================================================
-- 5. 運用で困る細かい穴
-- ============================================================================

-- 同じ人が同じ対象を何度も通報して、運営の一覧が埋まるのを防ぐ。
-- 対応済み（resolved / dismissed）になった後の再通報は許す
-- ＝「一度片付けた件の再発」は受け付けたいため、open のときだけ一意にする。
create unique index if not exists reports_open_unique
  on reports (reporter_id, target_type, target_id)
  where status = 'open';

-- 出品を編集したときの更新日時。管理画面の並び替えと、
-- 「編集された出品」の追跡に使う。
alter table items
  add column if not exists updated_at timestamptz not null default now();

create or replace function touch_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists items_touch_updated_at on items;
create trigger items_touch_updated_at
  before update on items
  for each row execute function touch_items_updated_at();


-- ============================================================================
-- 6. RLS（新しいテーブル）
-- ============================================================================

alter table purchases    enable row level security;
alter table push_tokens  enable row level security;
alter table legacy_users enable row level security;

-- 購入履歴は本人だけが読める。書き込みは RPC（service_role）のみ。
create policy read_own_purchases on purchases
  for select using (user_id = auth.uid());

-- 端末トークンは本人だけ。読み書きは RPC 経由だが、
-- 自分のぶんの確認・削除はできてよい。
create policy read_own_push_tokens on push_tokens
  for select using (user_id = auth.uid());
create policy delete_own_push_tokens on push_tokens
  for delete using (user_id = auth.uid());

-- 旧名簿はメールアドレスの一覧なので、アプリからは一切見せない。
-- 管理画面（service_role）だけが扱う。ポリシーを作らない＝誰も読めない。


-- ============================================================================
-- 7. 【不具合修正】退会できないユーザーがいる
-- ============================================================================
--
-- delete_own_account()（0005）は auth.users を消して profiles を cascade で消す設計。
-- ところが profiles を参照する6つの外部キーが NO ACTION のままだったため、
--
--   ・取引をしたことがある（exchanges）
--   ・取引メッセージを送ったことがある（messages）
--   ・評価をした / された（ratings）
--   ・通報したことがある（reports）
--
-- のいずれかに当てはまる人は退会が外部キー違反で失敗する。
-- ＝ ふつうに使った人ほど退会できない。アプリには退会ボタンが既にあるので実害あり。
--
-- 【直し方：cascade ではなく set null にする】
-- cascade で消すと、相手側の取引記録・評価履歴まで一緒に消えてしまう。
-- 「相手には取引があった事実が残り、退会した側の名前だけ消える」のが正しいので、
-- 参照を NULL にして行そのものは残す。画面では「退会したユーザー」と出す。

-- exchanges：相手の取引履歴を壊さないよう行は残す
alter table exchanges
  alter column from_user_id drop not null,
  alter column to_user_id   drop not null;
alter table exchanges drop constraint exchanges_from_user_id_fkey;
alter table exchanges drop constraint exchanges_to_user_id_fkey;
alter table exchanges
  add constraint exchanges_from_user_id_fkey
    foreign key (from_user_id) references profiles on delete set null,
  add constraint exchanges_to_user_id_fkey
    foreign key (to_user_id) references profiles on delete set null;

-- messages：会話は読めるまま残す
alter table messages alter column sender_id drop not null;
alter table messages drop constraint messages_sender_id_fkey;
alter table messages
  add constraint messages_sender_id_fkey
    foreign key (sender_id) references profiles on delete set null;

-- ratings：相手に付いた評価は消さない
alter table ratings
  alter column rater_id drop not null,
  alter column ratee_id drop not null;
alter table ratings drop constraint ratings_rater_id_fkey;
alter table ratings drop constraint ratings_ratee_id_fkey;
alter table ratings
  add constraint ratings_rater_id_fkey
    foreign key (rater_id) references profiles on delete set null,
  add constraint ratings_ratee_id_fkey
    foreign key (ratee_id) references profiles on delete set null;

-- reports：運営の対応履歴を消さない（誰が通報したかだけ分からなくなる）
alter table reports alter column reporter_id drop not null;
alter table reports drop constraint reports_reporter_id_fkey;
alter table reports
  add constraint reports_reporter_id_fkey
    foreign key (reporter_id) references profiles on delete set null;

comment on column exchanges.from_user_id is
  '発送者。退会すると NULL（画面では「退会したユーザー」と表示）';
comment on column reports.reporter_id is
  '通報者。退会すると NULL。運営の対応履歴を残すため行は消さない';

-- ── items 側にも同じ穴がある ────────────────────────────────
--
-- 退会すると profiles → items は cascade で消える。ところが items を参照する
-- 4つの外部キーが NO ACTION だったため、ここでも退会が失敗する。
--
--   harvests.root_item_id / harvested_item_id … 収穫したことがある種の持ち主
--   exchanges.item_id                          … 取引に出ている商品の持ち主
--   fertilizer_ledger.related_item_id          … 誰かに水やりされた種の持ち主
--                                                （他人の台帳が自分の種を指すため）
--
-- 最後のものが特に厄介で、「自分の種に誰かが水やりしただけ」で退会できなくなる。

-- harvests：収穫の記録は残す（商品への参照だけ外す）
-- unique (root_item_id) は NULL を複数許すので「1種1収穫」の担保は崩れない
alter table harvests
  alter column root_item_id      drop not null,
  alter column harvested_item_id drop not null;
alter table harvests drop constraint harvests_root_item_id_fkey;
alter table harvests drop constraint harvests_harvested_item_id_fkey;
alter table harvests
  add constraint harvests_root_item_id_fkey
    foreign key (root_item_id) references items on delete set null,
  add constraint harvests_harvested_item_id_fkey
    foreign key (harvested_item_id) references items on delete set null;

-- exchanges：相手の取引履歴を残す
alter table exchanges alter column item_id drop not null;
alter table exchanges drop constraint exchanges_item_id_fkey;
alter table exchanges
  add constraint exchanges_item_id_fkey
    foreign key (item_id) references items on delete set null;

-- fertilizer_ledger：金額の履歴が本体。どの商品だったかは失われてよい
alter table fertilizer_ledger drop constraint fertilizer_ledger_related_item_id_fkey;
alter table fertilizer_ledger
  add constraint fertilizer_ledger_related_item_id_fkey
    foreign key (related_item_id) references items on delete set null;


-- ============================================================================
-- 8. 課金の既定値（金額は未確定。管理画面から差し替える）
-- ============================================================================
--
-- ⚠ 金額と商品IDは「めたん様と方式を確定してから」入れる。
--   ここでは空の器だけ用意し、コードに直書きされないようにする。
--   （仕様書：金額・商品IDは環境変数／管理画面から差し替え可能にする）

insert into app_settings (key, value) values
  -- 肥料の購入プラン: [{ "product_id": "...", "fertilizer": 400, "price_jpy": 200 }, ...]
  ('charge_plans',      '[]'::jsonb),
  -- プレミアムの商品: { "product_id": "...", "price_jpy": 480, "days": 30 }
  ('premium_product',   '{}'::jsonb)
on conflict (key) do nothing;
