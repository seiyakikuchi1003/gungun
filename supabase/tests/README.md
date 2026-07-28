# DB のテスト

マイグレーション（`supabase/migrations/*.sql`）をローカル PostgreSQL に流して、
アプリの業務ルールが実際に守られるかを確かめる。**Supabase に接続せずに実行できる。**

```bash
supabase/tests/run.sh
```

`=== すべてのテストに合格 ===` が出れば OK。1つでも崩れると途中で止まる。

## 中身

| ファイル | 役割 |
| --- | --- |
| `00_supabase_shim.sql` | `auth.users` / `auth.uid()` / `storage` など Supabase 固有の部分をローカルに再現する。`login_as(uuid)` で「誰としてログインしているか」を切り替えられる |
| `01_app_test.sql` | 47項目の検証。植える・水やり・収穫の輪・発送/受取・評価・掲示板・通知・肥料・権限まわり |

## 準備（初回のみ）

PostgreSQL 16 をポート 55432 で起動しておく。

```bash
D=/var/lib/postgresql/gungun
sudo -u postgres initdb -D $D -U postgres --auth=trust
sudo -u postgres pg_ctl -D $D -o '-p 55432 -k /tmp' -l $D/log.txt start
```

## 確かめていること（抜粋）

- 種は `parent_id=null` / `depth=0`、水やりで子が生え `depth` が1つ増える
- 水やりで肥料が `app_settings.water_cost` ぶん減り、台帳と通知が残る
- 自分の出品・すでに参加している枝には水やりできない
- **収穫の輪は「起点から選んだ商品までの一本道」だけ**。外れた枝は新しい種として独立する
- 1つの種で収穫できるのは1回だけ、収穫できるのは種の持ち主だけ
- 全員が受け取ると商品が完了になる
- 他人の出品は編集・削除できない、なりすまして出品できない
- 停止中のユーザーは出品できない
- ログインボーナスは1日1回まで
