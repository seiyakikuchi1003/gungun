#!/bin/bash
SP="$(cd "$(dirname "$0")" && pwd)"
P="psql -h /tmp -p 55432 -U postgres -q -v ON_ERROR_STOP=1"
cd "$SP/../.."
$P -d postgres -c "drop database if exists gungun with (force);" -c "create database gungun;" || exit 1
$P -d gungun -f $SP/00_supabase_shim.sql || exit 1
for f in 0001_schema 0002_functions 0003_rls 0004_admin 0005_auth 0006_app 0007_item_comments; do
  $P -d gungun -f supabase/migrations/$f.sql || { echo "✗ $f で失敗"; exit 1; }
done
echo "マイグレーション 0001〜0006 適用OK"
echo ""
psql -h /tmp -p 55432 -U postgres -d gungun -f $SP/01_app_test.sql 2>&1 | sed 's/^psql:[^ ]*: //'
