-- ============================================================================
-- 0038_login_streak.sql — 連続ログイン日数を数える（2026-08-21 指摘）
--
-- カレンダーに日付が並ぶだけで「何日続いているか」が分からなかった。
-- 今後この日数に応じてボーナスを増やす想定があるので、記録だけ先に用意する。
--
-- 数え方は素直に：前回の受け取りが「昨日」なら +1、それより前なら 1 に戻す。
-- 日付の境目は日本時間で判定する（既存の claim_login_bonus と合わせる）。
-- ============================================================================

alter table profiles
  add column if not exists login_streak int not null default 0,
  add column if not exists login_streak_best int not null default 0;

comment on column profiles.login_streak is '連続ログインボーナス受け取り日数';
comment on column profiles.login_streak_best is 'これまでの最長記録';

create or replace function claim_login_bonus()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last date;
  v_premium boolean;
  v_until timestamptz;
  v_amount int;
  v_streak int;
begin
  if v_uid is null then raise exception 'ログインしていません'; end if;

  select last_login_bonus_on, coalesce(is_premium, false), premium_until, coalesce(login_streak, 0)
    into v_last, v_premium, v_until, v_streak
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

  -- 昨日も受け取っていれば続き、そうでなければ1日目から
  if v_last = v_today - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  update profiles
     set fertilizer = fertilizer + v_amount,
         last_login_bonus_on = v_today,
         login_streak = v_streak,
         login_streak_best = greatest(coalesce(login_streak_best, 0), v_streak)
   where id = v_uid;

  insert into fertilizer_ledger (user_id, amount, reason)
  values (v_uid, v_amount, 'login_bonus');

  return v_amount;
end $$;
