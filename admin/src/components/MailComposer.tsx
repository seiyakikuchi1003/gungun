'use client';

import { useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from './Icon';

/**
 * メールの宛先選びと本文（2026-09-17 新設）。
 *
 * 指摘（T-8）：利用者にメールを送れない。全員選択や複数選択ができず、
 * 一人ずつ探すしかないのが使いづらい。
 *
 * 宛先は「全員」「プレミアムだけ」などの絞り込みと、名前での検索を組み合わせて、
 * 表示されている人をまとめて選べるようにする。選んだ人数は常に見えるようにし、
 * 送る直前にもう一度確認を挟む（取り消せないため）。
 */

export type Recipient = {
  id: string;
  nickname: string | null;
  email: string | null;
  is_premium: boolean;
  is_suspended: boolean;
};

type Filter = 'all' | 'premium' | 'regular' | 'active';

export function MailComposer({
  people,
  initialIds,
  ready,
  action,
}: {
  people: Recipient[];
  initialIds: string[];
  /** 送信元の設定が済んでいるか。済んでいなければ送信ボタンを押せなくする */
  ready: boolean;
  action: (formData: FormData) => void;
}) {
  const withEmail = useMemo(() => people.filter((p) => !!p.email), [people]);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initialIds.filter((id) => withEmail.some((p) => p.id === id)))
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withEmail.filter((p) => {
      if (filter === 'premium' && !p.is_premium) return false;
      if (filter === 'regular' && p.is_premium) return false;
      if (filter === 'active' && p.is_suspended) return false;
      if (!q) return true;
      return (p.nickname ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q);
    });
  }, [withEmail, query, filter]);

  const allVisiblePicked = visible.length > 0 && visible.every((p) => picked.has(p.id));

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleVisible = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (allVisiblePicked) visible.forEach((p) => next.delete(p.id));
      else visible.forEach((p) => next.add(p.id));
      return next;
    });

  const noEmail = people.length - withEmail.length;
  const canSend = ready && picked.size > 0 && subject.trim() && body.trim();

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: '全員' },
    { key: 'active', label: '停止中を除く' },
    { key: 'premium', label: 'プレミアム' },
    { key: 'regular', label: 'プレミアム以外' },
  ];

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`${picked.size}人にメールを送ります。送ったメールは取り消せません。よろしいですか？`)) {
          e.preventDefault();
        }
      }}
      className="grid lg:grid-cols-[360px_1fr] gap-6 items-start"
    >
      <input type="hidden" name="ids" value={[...picked].join(',')} />

      {/* 左：宛先 */}
      <section className="card overflow-hidden lg:sticky lg:top-6">
        <div className="px-5 py-3.5 border-b border-line">
          <h2 className="font-black text-[15px]">宛先</h2>
          <p className="text-[12px] mt-0.5">
            <span className="font-black text-green text-base">{picked.size}</span>
            <span className="text-muted"> 人を選んでいます</span>
            {picked.size > 0 && (
              <button type="button" onClick={() => setPicked(new Set())} className="ml-2 text-xs text-muted underline">
                すべてはずす
              </button>
            )}
          </p>
        </div>

        <div className="p-4 border-b border-line flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={`text-xs font-bold rounded-full px-3 h-7 ${
                  filter === t.key ? 'bg-green text-white' : 'bg-cream text-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <Icon name="search" className="w-4 h-4" />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="名前・メールで絞り込む"
              className="input pl-9 h-9"
            />
          </label>
          <button
            type="button"
            onClick={toggleVisible}
            disabled={visible.length === 0}
            className="btn-ghost h-9 w-full disabled:opacity-40"
          >
            {allVisiblePicked ? `表示中の${visible.length}人をはずす` : `表示中の${visible.length}人をまとめて選ぶ`}
          </button>
        </div>

        <ul className="max-h-[420px] overflow-y-auto divide-y divide-line/60">
          {visible.map((p) => {
            const on = picked.has(p.id);
            return (
              <li key={p.id}>
                <label className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${on ? 'bg-green-soft/50' : 'hover:bg-cream/60'}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="w-4 h-4 accent-green" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold truncate">
                      {p.nickname?.trim() || <span className="text-muted font-normal">名前未設定</span>}
                      {p.is_premium && <span className="ml-1.5 text-[10px] font-black text-mikan">★</span>}
                      {p.is_suspended && <span className="ml-1.5 text-[10px] font-black text-danger">停止中</span>}
                    </span>
                    <span className="block text-[11px] text-muted truncate">{p.email}</span>
                  </span>
                </label>
              </li>
            );
          })}
          {visible.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">あてはまる人はいません</li>}
        </ul>
        {noEmail > 0 && (
          <p className="px-4 py-2.5 text-[11px] text-muted border-t border-line">
            メールアドレスが無い {noEmail}人 は一覧に出していません
          </p>
        )}
      </section>

      {/* 右：本文 */}
      <section className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line">
          <h2 className="font-black text-[15px]">内容</h2>
          <p className="text-[11.5px] text-muted mt-0.5">1人ずつ別々に届きます（他の人のアドレスは見えません）</p>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-muted">件名</span>
            <input
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="例：【ぐんぐん】メンテナンスのお知らせ"
              className="input"
              maxLength={120}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-muted">本文</span>
            <textarea
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="textarea leading-relaxed"
              placeholder={'いつもぐんぐんをご利用いただきありがとうございます。\n\n（本文）\n\nぐんぐん運営事務局'}
            />
            <span className="text-[11px] text-muted">空行で段落が分かれます。末尾に「ぐんぐん運営事務局からお送りしています」が自動で入ります。</span>
          </label>

          {/* 受け取る人に見える形。送る前に崩れていないかを確かめられる */}
          {(subject || body) && (
            <div>
              <div className="text-xs font-bold text-muted mb-1.5">受け取る人にはこう見えます</div>
              <div className="rounded-xl border border-line bg-cream/40 p-4">
                <div className="text-sm font-black mb-2">{subject || '（件名なし）'}</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{body}</div>
                <hr className="border-line my-3" />
                <div className="text-[11px] text-muted">このメールは ぐんぐん 運営事務局からお送りしています。</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap pt-1">
            <SubmitButton disabled={!canSend} count={picked.size} />
            {!ready && <span className="text-xs text-danger font-bold">送信元の設定が済むまで送れません（上の案内を確認してください）</span>}
            {ready && picked.size === 0 && <span className="text-xs text-muted">左で宛先を選んでください</span>}
          </div>
        </div>
      </section>
    </form>
  );
}

function SubmitButton({ disabled, count }: { disabled: boolean; count: number }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={disabled || pending} className="btn-primary h-11 px-6 disabled:opacity-40 disabled:cursor-not-allowed">
      <Icon name="send" className="w-4 h-4" />
      {pending ? '送っています…' : `${count}人に送る`}
    </button>
  );
}
