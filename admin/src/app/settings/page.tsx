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
 *
 * 【表示の作り】
 * 以前は全項目を同じ幅の1行入力で並べていたため、
 * 利用規約のような長文や JSON がまともに編集できなかった（2026-08-17 指摘）。
 * 値の性質ごとに入力欄を変え、運営が触ってよいものを先に出す。
 */
type Kind = 'number' | 'bool' | 'text' | 'longtext' | 'json';

const KNOWN: Record<string, { label: string; hint: string; kind: Kind; unit?: string }> = {
  water_cost: {
    label: '水やり1回の肥料', kind: 'number', unit: '肥料',
    hint: '他の人の出品に「水やり」するときに消費する量',
  },
  daily_login_bonus: {
    label: 'ログインボーナス（通常）', kind: 'number', unit: '肥料',
    hint: '通常会員が1日1回もらえる量',
  },
  daily_login_bonus_premium: {
    label: 'ログインボーナス（プレミアム）', kind: 'number', unit: '肥料',
    hint: 'プレミアム会員が1日1回もらえる量',
  },
  premium_price_yen: {
    label: 'プレミアム月額', kind: 'number', unit: '円',
    hint: 'アプリ内の表示に使う金額。Stripe 側の価格も合わせて変更が必要',
  },
  seed_price_yen: {
    label: 'タネの出品料', kind: 'number', unit: '円',
    hint: '2回目以降の出品にかかる金額。0 なら無料',
  },
  max_images_per_item: {
    label: '商品画像の上限枚数', kind: 'number', unit: '枚',
    hint: '出品時にアップロードできる枚数',
  },
  first_seed_free: {
    label: '初回のタネを無料にする', kind: 'bool',
    hint: 'はじめての出品を無料にするかどうか',
  },
  contact_email: {
    label: 'お問い合わせ先', kind: 'text',
    hint: 'アプリの「お問い合わせ」から送られる宛先',
  },
  charge_plans: {
    label: '肥料の販売プラン', kind: 'json',
    hint: 'アプリのチャージ画面に並ぶ内容。id / fertilizer / price / badge',
  },
  premium_product: {
    label: 'プレミアムの商品設定', kind: 'json',
    hint: 'Stripe の商品ID など。触る前に開発側へ確認してください',
  },
  functions_base_url: {
    label: 'Edge Function の URL', kind: 'text',
    hint: '決済・通知の送信先。変更するとアプリが動かなくなります',
  },
  terms_of_service: {
    label: '利用規約 本文', kind: 'longtext',
    hint: 'アプリ内の規約表示に使う。「■ 」で始めた行は見出し、「・」で始めた行は箇条書きになります',
  },
  privacy_policy: {
    label: 'プライバシーポリシー 本文', kind: 'longtext',
    hint: '書き方は利用規約と同じ',
  },
};

/** 運営がよく触るものから並べる。ここに無いキーは最後に回す */
const ORDER = [
  'water_cost', 'daily_login_bonus', 'daily_login_bonus_premium', 'first_seed_free',
  'seed_price_yen', 'max_images_per_item',
  'premium_price_yen', 'charge_plans',
  'contact_email', 'terms_of_service', 'privacy_policy',
  'premium_product', 'functions_base_url',
];

const GROUPS: { title: string; note: string; keys: string[] }[] = [
  {
    title: '肥料とボーナス',
    note: '水やりに必要な量と、毎日配る量',
    keys: ['water_cost', 'daily_login_bonus', 'daily_login_bonus_premium'],
  },
  {
    title: '出品のルール',
    note: '出品にかかる費用と写真の枚数',
    keys: ['first_seed_free', 'seed_price_yen', 'max_images_per_item'],
  },
  {
    title: '課金',
    note: '金額を変えるときは Stripe 側の設定も合わせてください',
    keys: ['premium_price_yen', 'charge_plans'],
  },
  {
    title: '文章・連絡先',
    note: 'アプリ内に表示される文章です',
    keys: ['contact_email', 'terms_of_service', 'privacy_policy'],
  },
  {
    title: '開発向け',
    note: '変更するとアプリが動かなくなることがあります',
    keys: ['premium_product', 'functions_base_url'],
  },
];

async function saveAction(formData: FormData) {
  'use server';
  const key = String(formData.get('key'));
  const res = await saveSetting(key, String(formData.get('value') ?? ''));
  const label = KNOWN[key]?.label ?? key;
  redirectWithResult('/settings', res, `「${label}」を保存しました`);
}

/** JSON は1行だと読めないので、整形して複数行で見せる */
function pretty(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function Field({ row }: { row: any }) {
  const meta = KNOWN[row.key];
  const kind: Kind = meta?.kind ?? (typeof row.value === 'object' ? 'json' : 'text');
  const current = kind === 'json' ? pretty(row.value) : typeof row.value === 'string' ? row.value : String(row.value);
  const long = kind === 'longtext' || kind === 'json';

  return (
    <div className="border-t border-line first:border-t-0 py-4">
      <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
        <span className="font-bold text-sm">{meta?.label ?? row.key}</span>
        <span className="text-[11px] font-mono text-muted">{row.key}</span>
        <span className="text-[11px] text-muted ml-auto">更新 {jst(row.updated_at)}</span>
      </div>
      {meta?.hint && <p className="text-xs text-muted mb-2 leading-relaxed">{meta.hint}</p>}

      <form action={saveAction} className={long ? 'flex flex-col gap-2' : 'flex items-center gap-2 flex-wrap'}>
        <input type="hidden" name="key" value={row.key} />

        {kind === 'bool' ? (
          <select name="value" defaultValue={current} className="input h-9 w-40">
            <option value="true">有効にする</option>
            <option value="false">無効にする</option>
          </select>
        ) : long ? (
          <textarea
            name="value"
            defaultValue={current}
            rows={kind === 'json' ? 8 : 14}
            spellCheck={false}
            className={`textarea leading-relaxed ${kind === 'json' ? 'font-mono text-xs' : 'text-sm'}`}
          />
        ) : (
          <div className="flex items-center gap-2">
            <input
              name="value"
              defaultValue={current}
              inputMode={kind === 'number' ? 'numeric' : undefined}
              className={`input h-9 ${kind === 'number' ? 'w-32 text-right' : 'w-80'}`}
            />
            {meta?.unit && <span className="text-xs text-muted">{meta.unit}</span>}
          </div>
        )}

        <button className={`btn-primary h-9 ${long ? 'self-start' : ''}`}>保存</button>
      </form>
    </div>
  );
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
  const byKey = new Map(settings.map((s) => [s.key, s]));
  const grouped = new Set(ORDER);
  const others = settings.filter((s) => !grouped.has(s.key));

  return (
    <Shell title="アプリ設定">
      <Banner error={error ?? dbError} ok={ok} />

      <p className="text-sm text-muted leading-relaxed mb-5 max-w-2xl">
        ここで変えた内容は、アプリを更新しなくても次にデータを読み込んだ時点で反映されます。
        金額や肥料量はアプリに直接書かず、すべてこの画面から変更します。
      </p>

      {settings.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          設定がありません。<code className="px-1 bg-cream rounded">supabase/apply_all.sql</code> を Supabase の SQL Editor で実行してください。
        </div>
      ) : (
        <div className="flex flex-col gap-5 max-w-3xl">
          {GROUPS.map((g) => {
            const list = g.keys.map((k) => byKey.get(k)).filter(Boolean);
            if (!list.length) return null;
            return (
              <section key={g.title} className="card p-5">
                <h2 className="font-black text-sm mb-0.5">{g.title}</h2>
                <p className="text-xs text-muted mb-2">{g.note}</p>
                <div>
                  {list.map((row: any) => (
                    <Field key={row.key} row={row} />
                  ))}
                </div>
              </section>
            );
          })}

          {others.length > 0 && (
            <section className="card p-5">
              <h2 className="font-black text-sm mb-0.5">その他</h2>
              <p className="text-xs text-muted mb-2">分類していない設定です</p>
              <div>
                {others.map((row: any) => (
                  <Field key={row.key} row={row} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Shell>
  );
}
