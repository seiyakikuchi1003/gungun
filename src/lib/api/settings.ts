import { requireSupabase } from '@/lib/supabase';
import { settings as fallback } from '@/config/settings';

/**
 * アプリ設定（金額・肥料量）を DB から読む。
 *
 * 仕様の「ハードコード禁止」に対応する部分。管理画面で値を変えると
 * ここ経由でアプリに反映される（アプリの更新は不要）。
 * 取得に失敗したときは src/config/settings.ts の既定値で動かす。
 */

export type AppSettings = {
  waterCost: number;
  dailyLoginBonus: number;
  firstSeedFree: boolean;
  premiumMonthly: number | null;
  seedPriceYen: number | null;
  maxImagesPerItem: number;
};

export const defaultSettings: AppSettings = {
  waterCost: fallback.waterCost,
  dailyLoginBonus: fallback.dailyLoginBonus,
  firstSeedFree: fallback.firstSeedFree,
  premiumMonthly: fallback.premiumMonthly,
  seedPriceYen: null,
  maxImagesPerItem: 4,
};

function num(v: unknown, d: number): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : d;
}

export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await requireSupabase().from('app_settings').select('key, value');
  if (error) throw error;

  const map = new Map<string, unknown>((data ?? []).map((r: any) => [r.key, r.value]));
  return {
    waterCost: num(map.get('water_cost'), defaultSettings.waterCost),
    dailyLoginBonus: num(map.get('daily_login_bonus'), defaultSettings.dailyLoginBonus),
    firstSeedFree: map.has('first_seed_free')
      ? Boolean(map.get('first_seed_free'))
      : defaultSettings.firstSeedFree,
    premiumMonthly: map.has('premium_price_yen')
      ? num(map.get('premium_price_yen'), 0)
      : defaultSettings.premiumMonthly,
    seedPriceYen: map.has('seed_price_yen') ? num(map.get('seed_price_yen'), 0) : null,
    maxImagesPerItem: num(map.get('max_images_per_item'), defaultSettings.maxImagesPerItem),
  };
}
