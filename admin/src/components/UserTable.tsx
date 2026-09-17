'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Icon } from './Icon';

/**
 * ユーザー一覧の表（選んでまとめて操作できる）。
 *
 * 2026-09-17 の指摘：全員選択や複数選択ができず、一人ずつ探すしかなくて使いづらい。
 * 行の左にチェックを置き、選ぶと下にバーが出て「選んだ人にメールを送る」ができる。
 * 行そのものを押すとその人の詳細へ行く（操作は詳細画面にまとめた）。
 */

export type UserRow = {
  id: string;
  nickname: string | null;
  email: string | null;
  avatar_url: string | null;
  fertilizer: number;
  item_count: number;
  trade_count: number;
  reported_count: number;
  is_premium: boolean;
  is_suspended: boolean;
  created_at: string;
  created_label: string;
};

export function UserTable({
  rows,
  /** 今の絞り込みに合う全員に送るためのリンク（ページをまたいだ全員） */
  allMatchingHref,
  allMatchingCount,
}: {
  rows: UserRow[];
  allMatchingHref: string;
  allMatchingCount: number;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const allOnPage = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const someOnPage = rows.some((r) => picked.has(r.id));

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (allOnPage) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });

  const mailHref = useMemo(() => `/mail?ids=${[...picked].join(',')}`, [picked]);

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="th w-10 pr-0">
                <input
                  type="checkbox"
                  aria-label="このページの全員を選ぶ"
                  className="w-4 h-4 accent-green align-middle cursor-pointer"
                  checked={allOnPage}
                  ref={(el) => {
                    if (el) el.indeterminate = !allOnPage && someOnPage;
                  }}
                  onChange={togglePage}
                />
              </th>
              <th className="th">ユーザー</th>
              <th className="th">状態</th>
              <th className="th num">肥料</th>
              <th className="th num">出品</th>
              <th className="th num">取引</th>
              <th className="th">登録日</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const on = picked.has(u.id);
              return (
                <tr key={u.id} className={on ? '!bg-green-soft/60' : ''}>
                  <td className="td w-10 pr-0">
                    <input
                      type="checkbox"
                      aria-label={`${u.nickname ?? 'このユーザー'}を選ぶ`}
                      className="w-4 h-4 accent-green align-middle cursor-pointer"
                      checked={on}
                      onChange={() => toggle(u.id)}
                    />
                  </td>
                  <td className="td">
                    <Link href={`/users/${u.id}`} className="flex items-center gap-3 group">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover bg-cream shrink-0" />
                      ) : (
                        <span className="w-9 h-9 rounded-full bg-cream grid place-items-center text-muted font-black text-sm shrink-0">
                          {(u.nickname?.trim() || '?').slice(0, 1)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block font-bold group-hover:text-green truncate">
                          {u.nickname?.trim() || <span className="text-muted font-normal">名前未設定</span>}
                        </span>
                        <span className="block text-[11.5px] text-muted truncate">{u.email ?? 'メール未登録'}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {u.is_suspended && <span className="pill bg-danger/10 text-danger">停止中</span>}
                      {u.is_premium && <span className="pill bg-mikan-soft text-mikan">★ プレミアム</span>}
                      {u.reported_count > 0 && <span className="pill bg-cream text-muted">通報 {u.reported_count}</span>}
                      {!u.is_suspended && !u.is_premium && !u.reported_count && (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="td num">{u.fertilizer.toLocaleString('ja-JP')}</td>
                  <td className="td num">{u.item_count || <span className="text-muted">0</span>}</td>
                  <td className="td num">{u.trade_count || <span className="text-muted">0</span>}</td>
                  <td className="td text-muted text-xs whitespace-nowrap">{u.created_label}</td>
                  <td className="td w-10">
                    <Link href={`/users/${u.id}`} className="text-muted hover:text-green" aria-label="詳細を見る">
                      <Icon name="chevron-right" className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="td text-muted text-center py-10" colSpan={8}>
                  該当する人はいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 選んでいる間だけ出るバー。何人選んでいて、何ができるかを1か所で見せる。
          出していない間は場所も取らない（透明にするだけだと表の下に空白が残っていた） */}
      {picked.size > 0 && (
        <div className="sticky bottom-4 mt-4 z-10">
          <div className="card px-4 py-3 flex items-center gap-3 flex-wrap shadow-lg border-green/30">
            <span className="text-sm font-black">
              <span className="text-green">{picked.size}人</span> を選んでいます
            </span>
            <button type="button" onClick={() => setPicked(new Set())} className="text-xs font-bold text-muted underline">
              選択をはずす
            </button>
            <Link href={mailHref} className="btn-primary ml-auto">
              <Icon name="mail" className="w-4 h-4" />
              選んだ人にメールを送る
            </Link>
          </div>
        </div>
      )}

      {/* ページをまたいだ全員に送る導線は、選択とは別に常に出しておく */}
      {allMatchingCount > 0 && (
        <p className="text-xs text-muted mt-3">
          ページをまたいで条件に合う全員（{allMatchingCount}人）に送るときは{' '}
          <Link href={allMatchingHref} className="font-bold text-green underline">
            こちら
          </Link>
          。
        </p>
      )}
    </>
  );
}
