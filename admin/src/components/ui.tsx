import Link from 'next/link';
import { Icon, type IconName } from './Icon';

/**
 * 管理画面で繰り返し使う小さな部品。
 *
 * 画面ごとに見た目を組むと、同じ「非表示」でも色や言い方がばらつき、
 * 運営の方が画面をまたいだときに読み替えが要る。ここに寄せて揃える。
 */

/** 状態を表すラベル */
export function Pill({
  tone = 'gray',
  children,
}: {
  tone?: 'green' | 'mikan' | 'gray' | 'danger' | 'water';
  children: React.ReactNode;
}) {
  const cls = {
    green: 'bg-green-soft text-green-deep',
    mikan: 'bg-mikan-soft text-mikan',
    gray: 'bg-cream text-muted',
    danger: 'bg-danger/10 text-danger',
    water: 'bg-water/10 text-water',
  }[tone];
  return <span className={`pill ${cls}`}>{children}</span>;
}

/** 数字を1つ大きく見せるカード */
export function StatCard({
  label,
  value,
  note,
  href,
  tone,
  icon,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
  tone?: 'green' | 'mikan' | 'danger';
  icon?: IconName;
}) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'mikan' ? 'text-mikan' : tone === 'green' ? 'text-green' : 'text-ink';
  const body = (
    <div className="card p-4 h-full flex flex-col">
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
        {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
        {label}
      </div>
      <div className={`text-[26px] font-black leading-none mt-2 tabular-nums ${color}`}>{value}</div>
      {note && <div className="text-[11px] text-muted leading-snug mt-1.5">{note}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:-translate-y-px hover:shadow-md rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

/** 絞り込みのタブ（リンクで切り替える） */
export function Tabs({
  items,
  current,
}: {
  items: { key: string; label: string; href: string; count?: number }[];
  current: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 bg-white border border-line rounded-full p-1">
      {items.map((t) => {
        const on = t.key === current;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`text-[13px] font-bold rounded-full px-3.5 h-8 inline-flex items-center gap-1.5 transition-colors ${
              on ? 'bg-green text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[11px] tabular-nums ${on ? 'text-white/80' : 'text-muted/80'}`}>{t.count}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** 検索窓。今の絞り込みを保ったまま検索する */
export function SearchBox({
  q,
  placeholder,
  keep,
}: {
  q: string;
  placeholder: string;
  /** 検索しても消さずに残したいクエリ */
  keep?: Record<string, string>;
}) {
  return (
    <form className="flex gap-2 grow max-w-md">
      <label className="relative grow">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <Icon name="search" className="w-4 h-4" />
        </span>
        <input name="q" defaultValue={q} placeholder={placeholder} className="input pl-9" />
      </label>
      {Object.entries(keep ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className="btn-primary shrink-0">検索</button>
    </form>
  );
}

/** ページ送り */
export function Pager({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center gap-3 mt-4 text-sm">
      <span className="text-muted text-xs">
        {total.toLocaleString('ja-JP')}件中 {from}〜{to}件
      </span>
      <div className="ml-auto flex gap-1">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="btn-ghost h-8 px-3">前へ</Link>
        ) : (
          <span className="btn h-8 px-3 border border-line text-muted/40">前へ</span>
        )}
        <span className="h-8 px-3 inline-flex items-center text-xs font-bold text-muted">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className="btn-ghost h-8 px-3">次へ</Link>
        ) : (
          <span className="btn h-8 px-3 border border-line text-muted/40">次へ</span>
        )}
      </div>
    </div>
  );
}

/** 詳細画面の「項目：値」 */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2.5 border-b border-line/70 last:border-b-0 text-sm">
      <dt className="w-28 shrink-0 text-muted text-xs font-bold pt-0.5">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}

/** 見出し付きの白い箱 */
export function Section({
  title,
  note,
  actions,
  children,
  flush,
}: {
  title: string;
  note?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** 中身を端まで広げる（表を入れるとき） */
  flush?: boolean;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-line flex items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-black text-[15px]">{title}</h2>
          {note && <p className="text-[11.5px] text-muted mt-0.5">{note}</p>}
        </div>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

/** 名前が未設定のときの見せ方を揃える */
export function Nickname({ name }: { name?: string | null }) {
  return name?.trim() ? <>{name}</> : <span className="text-muted font-normal">名前未設定</span>;
}
