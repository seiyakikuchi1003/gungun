import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';

/**
 * プレミアムのお知らせ（2026-08-13 指摘）。
 *
 * タネを植える・水やりをするときは「もっと使いたい」と思っている瞬間なので、
 * そこでだけ案内する。ただし毎回出すと邪魔なので、
 * 「今日はもう表示しない」を選べるようにして、選んだらその日は出さない。
 *
 * ここで登録させきる必要はない。マイページからいつでも見られることを伝えて、
 * 決めるのは後でもいい、という置き方にする。
 */

const KEY = 'premium-nudge-hidden-until';

/** 今日はもう出さない、と言われたかどうか */
async function isSnoozed(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return !!v && new Date(v).getTime() > Date.now();
  } catch {
    return false;
  }
}

async function snoozeToday(): Promise<void> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  try {
    await AsyncStorage.setItem(KEY, end.toISOString());
  } catch {
    // 保存できなくても致命ではない（次回また出るだけ）
  }
}

/**
 * 呼び出し側は `trigger` を true にするだけでよい。
 * すでにプレミアムの人・その日は見ないと言った人には出ない。
 */
export function PremiumNudge({ trigger, isPremium, onClose }: {
  trigger: boolean;
  isPremium: boolean;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!trigger || isPremium) return;
    isSnoozed().then((skip) => {
      if (!alive) return;
      if (skip) onClose();
      else setVisible(true);
    });
    return () => { alive = false; };
  }, [trigger, isPremium, onClose]);

  const close = async () => {
    if (dontShow) await snoozeToday();
    setVisible(false);
    setDontShow(false);
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={close}>
      <View style={styles.head}>
        <Mikan size={56} />
        <Text style={styles.title}>プレミアムにしませんか？</Text>
        <Text style={styles.sub}>
          もっとたくさん水やりしたい人向けのプランです。{'\n'}
          マイページからいつでも内容を確認できます。
        </Text>
      </View>

      <View style={styles.perks}>
        {[
          { icon: 'water', text: '毎月の肥料がもらえる' },
          { icon: 'sparkles', text: '広告なしで使える' },
          { icon: 'ribbon', text: 'プレミアムバッジがつく' },
        ].map((p) => (
          <View key={p.text} style={styles.perk}>
            <Ionicons name={p.icon as never} size={16} color={colors.premium} />
            <Text style={styles.perkText}>{p.text}</Text>
          </View>
        ))}
      </View>

      <PressableScale
        onPress={() => { close(); router.push('/premium'); }}
        activeScale={0.97}
        style={[styles.cta, shadows.button]}
      >
        <Ionicons name="diamond" size={17} color={colors.white} />
        <Text style={styles.ctaText}>内容を見る</Text>
      </PressableScale>

      <PressableScale activeScale={0.98} onPress={() => setDontShow((v) => !v)} style={styles.checkRow}>
        <View style={[styles.box, dontShow && styles.boxOn]}>
          {dontShow && <Ionicons name="checkmark" size={13} color={colors.white} />}
        </View>
        <Text style={styles.checkText}>今日はもう表示しない</Text>
      </PressableScale>

      <PressableScale onPress={close} activeScale={0.98} style={styles.cancel}>
        <Text style={styles.cancelText}>閉じる</Text>
      </PressableScale>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  title: { fontFamily: fonts.black, fontSize: 19, color: colors.textPrimary },
  sub: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  perks: { gap: spacing.sm, backgroundColor: colors.bgWarm, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.lg },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  perkText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    height: 52, borderRadius: radius.pill, backgroundColor: colors.premium,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', paddingVertical: spacing.lg },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  boxOn: { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
  checkText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  cancel: { alignItems: 'center', paddingBottom: spacing.md },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
});
