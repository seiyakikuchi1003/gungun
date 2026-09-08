-- ============================================================================
-- 0045_click_categories.sql — 出品カテゴリーを現行 Click のものに揃える
--
-- 2026-08-21 の会議で「クリックのカテゴリーをそのまま持ってくること」という
-- 指摘があり、Click の10区分をもらったので既存データを寄せる。
-- アプリ側の一覧（src/data/mock.ts の categories）もこの10件に差し替え済み。
--
-- Click には「その他」が無い。どれにも当てはまらない既存商品は、
-- いちばん近い「日用品・雑貨・文具」に寄せる（テスト投稿ばかりのため）。
--
-- 「チケット」は同じ会議で廃止した区分。金券性のあるものは物々交換ではなく
-- 金銭のやり取りになってしまうため、該当商品は出品を取り下げる。
-- ============================================================================

begin;

update items set category =
  'ファッション・アクセサリー'
where category in ('メンズ', 'レディース');

update items set category =
  '家電・デジタルガジェット'
where category in ('スマホ・家電', '家電');

update items set category =
  '本・漫画・CD・DVD'
where category = '本・音楽';

update items set category =
  '趣味・サブカル'
where category = 'ゲーム・おもちゃ';

-- 「コスメ」という表記ゆれが1件あった
update items set category = 'コスメ・美容'
where category in ('コスメ', 'コスメ・美容');

update items set category =
  '日用品・雑貨・文具'
where category = 'インテリア';

-- めがねは小物なのでアクセサリー側に置く
update items set category =
  'ファッション・アクセサリー'
where name = 'めがね';

-- 空・その他など、Click に対応する区分が無いもの
update items set category =
  '日用品・雑貨・文具'
where category is null
   or btrim(category) = ''
   or category = 'その他';

-- 金券類は出品不可（2026-08-21）。行は残し、一覧から下げるだけにする
update items set status = 'deleted'
where category = 'チケット'
   or name like '%ギフト券%';

commit;

insert into public._gungun_migrations (name)
values ('0045_click_categories.sql')
on conflict do nothing;

-- 移行後の確認
select category, count(*) as n
from items
where status <> 'deleted'
group by category
order by n desc;
