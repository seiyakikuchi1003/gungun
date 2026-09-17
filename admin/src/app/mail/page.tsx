export const runtime = "edge";

import Link from 'next/link';
import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { Icon } from '@/components/Icon';
import { Pill, Section } from '@/components/ui';
import { MailComposer, type Recipient } from '@/components/MailComposer';
import { isConnected, rows } from '@/lib/supabase';
import { mailStatus, sendMail } from '@/lib/actions';
import { redirectWithResult } from '@/lib/result';
import { jst, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * メール配信（2026-09-17 新設）。
 *
 * 指摘（T-8）：利用者に一斉メールを送れない。
 * これまで管理画面にメールを送る機能そのものが無かった。
 *
 * 宛先を選んで、件名と本文を書いて送る。送った記録は下に残る。
 * 実際の送信は Supabase の admin-mail（Resend 経由）が行う。
 */

async function sendAction(formData: FormData) {
  'use server';
  const ids = String(formData.get('ids') ?? '').split(',').filter(Boolean);
  const res = await sendMail(ids, String(formData.get('subject') ?? ''), String(formData.get('body') ?? ''));
  const okMsg =
    res.failed && res.failed > 0
      ? `${res.sent}人に送りました（${res.failed}人は送れませんでした）`
      : `${res.sent ?? ids.length}人にメールを送りました`;
  redirectWithResult('/mail', res, okMsg);
}

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; to?: string; f?: string; q?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;

  if (!isConnected) {
    return (
      <Shell title="メール配信" current="/mail">
        <NotConnected />
      </Shell>
    );
  }

  const [status, { data: people, error: dbError }, { data: logs }] = await Promise.all([
    mailStatus(),
    rows<any>((db) =>
      db.from('admin_user_cards').select('id, nickname, email, is_premium, is_suspended, reported_count').order('created_at', { ascending: false }).limit(5000)
    ),
    rows<any>((db) => db.from('admin_mail_log').select('*').order('created_at', { ascending: false }).limit(20)),
  ]);

  // ユーザー一覧から来たとき、選んだ人（ids）または絞り込み条件（to=filter）を宛先の初期値にする
  let initialIds: string[] = [];
  if (sp.ids) initialIds = sp.ids.split(',').filter(Boolean);
  else if (sp.to === 'filter') {
    const q = (sp.q ?? '').toLowerCase();
    initialIds = people
      .filter((p) => {
        if (sp.f === 'premium' && !p.is_premium) return false;
        if (sp.f === 'suspended' && !p.is_suspended) return false;
        if (sp.f === 'reported' && !(Number(p.reported_count) > 0)) return false;
        if (q && !`${p.nickname ?? ''} ${p.email ?? ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .map((p) => p.id);
  }

  const recipients: Recipient[] = people.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    email: p.email,
    is_premium: !!p.is_premium,
    is_suspended: !!p.is_suspended,
  }));

  return (
    <Shell
      title="メール配信"
      description="利用者にメールでお知らせを送ります。宛先を選び、件名と本文を書いて送ってください。"
      current="/mail"
    >
      <Banner error={sp.error ?? dbError} ok={sp.ok} />

      {/* 送信元の状態。送れないときは理由とやることを先に見せる */}
      {status.ready ? (
        <div className="card px-5 py-3 mb-6 flex items-center gap-3 text-sm border-l-4 border-l-green">
          <Icon name="check" className="w-4 h-4 text-green" />
          <span>
            送信元 <span className="font-bold">{status.from}</span> から送れます
          </span>
        </div>
      ) : (
        <div className="card p-5 mb-6 border-l-4 border-l-mikan">
          <div className="flex items-start gap-3">
            <Icon name="alert" className="w-5 h-5 text-mikan shrink-0 mt-0.5" />
            <div className="min-w-0 text-sm">
              <p className="font-black">いまはメールを送れません</p>
              <p className="text-muted mt-1">{status.reason}</p>
              <ol className="list-decimal pl-5 mt-3 space-y-1 text-[13px]">
                <li>
                  メールの送信サービス（Resend）に、送信に使うドメイン（例：わらしべぐんぐん.com）を登録し、DNS の設定を済ませる
                  <span className="text-muted">（テスト項目 W-7「通知メール用の独自ドメインを設定する」）</span>
                </li>
                <li>
                  <Link href="/settings" className="font-bold text-green underline">アプリ設定</Link>
                  の「メールの送信元」に、そのドメインのアドレスを入れる（例：<code className="text-xs bg-cream px-1 rounded">ぐんぐん &lt;info@example.com&gt;</code>）
                </li>
              </ol>
              {status.domains.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 items-center text-xs">
                  <span className="text-muted">Resend に登録済みのドメイン：</span>
                  {status.domains.map((d) => (
                    <Pill key={d.name} tone={d.status === 'verified' ? 'green' : 'mikan'}>
                      {d.name}（{d.status === 'verified' ? '認証済み' : '未認証'}）
                    </Pill>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted mt-3">宛先の選択と本文の作成は、この状態でも試せます。</p>
            </div>
          </div>
        </div>
      )}

      <MailComposer people={recipients} initialIds={initialIds} ready={status.ready} action={sendAction} />

      <div className="mt-8">
        <Section title="これまでに送ったメール" note="新しい順に20件まで" flush>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">件名</th>
                <th className="th num">宛先</th>
                <th className="th num">届いた</th>
                <th className="th">送った日時</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="td">
                    <div className="font-bold">{l.subject}</div>
                    <div className="text-xs text-muted line-clamp-1">{l.body}</div>
                    {l.error && <div className="text-xs text-danger mt-0.5">{l.error}</div>}
                  </td>
                  <td className="td num">{num(l.recipient_count)}人</td>
                  <td className="td num">
                    {num(l.sent_count)}人
                    {l.failed_count > 0 && <div className="text-xs text-danger">失敗 {num(l.failed_count)}</div>}
                  </td>
                  <td className="td text-muted text-xs whitespace-nowrap">{jst(l.created_at)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td className="td text-center text-muted py-8" colSpan={4}>まだ送ったメールはありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>
      </div>
    </Shell>
  );
}
