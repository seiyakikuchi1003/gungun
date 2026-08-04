export const runtime = "edge";

import { Shell, NotConnected } from '@/components/Shell';
import { Banner } from '@/components/Banner';
import { isConnected, rows } from '@/lib/supabase';
import { saveSetting } from '@/lib/actions';
import { redirectWithResult } from '@/lib/result';
import { jst } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * 仕様上「金額・肥料量はハードコード禁止」なので、値はすべて app_settings に置き
 * ここから変更できるようにする。アプリの再ビルドは不要。
 */
const KNOWN: Record<string, { label: string; hint: string }> = {
  water_cost: { label: '水やり1回の肥料', hint: '「ほしい！」を送るときに消費する肥料の量' },
  daily_login_bonus: { label: 'ログインボーナス（通常）', hint: '通常会員が1日1回もらえる肥料の量' },
  daily_login_bonus_premium: {
    label: 'ログインボーナス（プレミアム）',
    hint: 'プレミアム会員が1日1回もらえる肥料の量（2026-07-28 MTGで復活）',
  },
  first_seed_free: { label: '初回の種を無料にする', hint: 'true / false' },
  premium_price_yen: { label: 'プレミアム月額（円）', hint: 'ストア表示に使う金額' },
  seed_price_yen: { label: '種の出品料（円）', hint: '2回目以降の出品にかかる金額' },
  max_images_per_item: { label: '商品画像の上限枚数', hint: '出品時にアップロードできる枚数' },
  terms_of_service: { label: '利用規約 本文', hint: 'アプリ内の規約表示に使う。改行そのまま' },
  privacy_policy: { label: 'プライバシーポリシー 本文', hint: 'アプリ内のポリシー表示に使う' },
};

async function saveAction(formData: FormData) {
  'use server';
  const key = String(formData.get('key'));
  const res = await saveSetting(key, String(formData.get('value') ?? ''));
  redirectWithResult('/settings', res, `${key} を保存しました`);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  if (!isConnected) {
    return (
      <Shell title="アプリ設定">
        <NotConnected />
      </Shell>
    );
  }

  const { data: settings, error: dbError } = await rows<any>((db) => db.from('app_settings').select('*').order('key'));

  return (
    <Shell title="アプリ設定">
      <Banner error={error ?? dbError} ok={ok} />

      <p className="text-sm text-muted leading-relaxed mb-5 max-w-2xl">
        アプリ内の金額・肥料量はここから変更します。保存すると次回のデータ取得からアプリに反映されます（アプリの更新は不要です）。
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr>
              <th className="th">設定</th>
              <th className="th">キー</th>
              <th className="th">値</th>
              <th className="th">最終更新</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => {
              const meta = KNOWN[s.key];
              const current = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
              return (
                <tr key={s.key}>
                  <td className="td">
                    <div className="font-bold">{meta?.label ?? s.key}</div>
                    {meta ? <div className="text-xs text-muted">{meta.hint}</div> : null}
                  </td>
                  <td className="td text-xs font-mono text-muted">{s.key}</td>
                  <td className="td">
                    <form action={saveAction} className="flex items-center gap-2">
                      <input type="hidden" name="key" value={s.key} />
                      <input name="value" defaultValue={current} className="input w-40 h-9" />
                      <button className="btn-primary h-9">保存</button>
                    </form>
                  </td>
                  <td className="td text-muted text-xs whitespace-nowrap">{jst(s.updated_at)}</td>
                </tr>
              );
            })}
            {settings.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={4}>
                  設定がありません。<code className="px-1 bg-cream rounded">supabase/apply_all.sql</code> を Supabase の SQL Editor で実行してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
