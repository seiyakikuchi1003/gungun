import React, { useEffect, useMemo } from 'react';
import { useMe } from '@/store/me';
import { View, Text, StyleSheet, Modal, ScrollView, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  FadeIn,
  FadeInDown,
  BounceIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';
import { WateringCan } from '@/components/art/WateringCan';
import { Sprout } from '@/components/art/Sprout';
import { settings } from '@/config/settings';
import { success } from '@/lib/haptics';
import { playSfx } from '@/lib/sound';
import { lh } from '@/lib/fontScale';

type Props = {
  visible: boolean;
  claimedToday: boolean; // 受け取り済みか
  /** 今日もらえる肥料（プレミアムなら増量後の値）。未指定なら既定値 */
  amount?: number;
  onClose: () => void;
};

/**
 * ログインボーナスのポップアップ（スタンプカレンダー）。
 * 「受け取る」とカレンダーの今日のマスにじょうろのスタンプが
 * ポンッと押される（BounceIn）。カレンダーは実際の日付・曜日に連動する。
 */

// 日曜始まり。カレンダーアプリの並びに合わせる（2026-08-21 指摘）
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * カレンダーを実際の日付に合わせる（2026-07-28 MTG めたん様のご質問対応）。
 *
 * 以前は「連続◯日目」の通し番号を 1〜21 で並べていただけで、
 * 見出しの曜日とマスの中身が一致していなかった。
 * ここでは **今週の日曜から3週間ぶんの実日付** を作り、
 * 曜日の列と実際の曜日が必ず揃うようにする。
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function buildCalendar(now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // JS の getDay() は日曜=0。そのまま引けば日曜始まりになる
  const sundayOffset = today.getDay();
  const start = new Date(today.getTime() - sundayOffset * DAY_MS);

  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY_MS);
    const diff = Math.round((d.getTime() - today.getTime()) / DAY_MS);
    return {
      date: d,
      dayNum: d.getDate(),
      isToday: diff === 0,
      isPast: diff < 0,
      isFuture: diff > 0,
      // 月初は「7/1」のように月も出す
      label: d.getDate() === 1 ? `${d.getMonth() + 1}/1` : String(d.getDate()),
    };
  });
  return { today, days };
}

// スタンプ演出のタイミング（ポップアップ表示後）
const STAMP_DELAY = 650; // 大きなスタンプが降り始めるまで
const RING_DELAY = STAMP_DELAY + 330; // 着地の瞬間に波紋
const FLOAT_DELAY = RING_DELAY + 120; // 「+40」がふわっと浮かぶ

/**
 * 今日のマスの「スタンプが押される」演出。
 * 大きなじょうろが上から降ってきて縮みながらガシャンと着地 →
 * 緑の波紋が広がる → 「+◯◯」が浮かび上がる。
 */
function TodayStamp({ size, bonus, active }: { size: number; bonus: number; active: boolean }) {
  const scale = useSharedValue(2.6);
  const opacity = useSharedValue(0);
  const ringScale = useSharedValue(0.5);
  const ringOpacity = useSharedValue(0);
  const floatY = useSharedValue(0);
  const floatOpacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      scale.value = 2.6; opacity.value = 0;
      ringScale.value = 0.5; ringOpacity.value = 0;
      floatY.value = 0; floatOpacity.value = 0;
      return;
    }
    // 1) スタンプ：大きく現れて押し込まれ、スプリングで定位置に
    opacity.value = withDelay(STAMP_DELAY, withTiming(1, { duration: 90 }));
    scale.value = withDelay(
      STAMP_DELAY,
      withSequence(
        withTiming(0.78, { duration: 300, easing: Easing.in(Easing.cubic) }),
        withSpring(1, { damping: 8, stiffness: 210 })
      )
    );
    // 2) 波紋：着地の瞬間に広がって消える（同時に成功バイブ＋「ポンッ」）
    const buzz = setTimeout(() => { success(); playSfx('stamp'); }, RING_DELAY);
    ringOpacity.value = withDelay(RING_DELAY, withSequence(withTiming(0.75, { duration: 60 }), withTiming(0, { duration: 480 })));
    ringScale.value = withDelay(RING_DELAY, withTiming(2.0, { duration: 540, easing: Easing.out(Easing.quad) }));
    // 3) +40 がふわっと浮かんで消える
    floatOpacity.value = withDelay(FLOAT_DELAY, withSequence(withTiming(1, { duration: 160 }), withDelay(650, withTiming(0, { duration: 260 }))));
    floatY.value = withDelay(FLOAT_DELAY, withTiming(-size * 0.62, { duration: 950, easing: Easing.out(Easing.quad) }));
    return () => clearTimeout(buzz);
  }, [active]);

  const stampStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOpacity.value, transform: [{ scale: ringScale.value }] }));
  const floatStyle = useAnimatedStyle(() => ({ opacity: floatOpacity.value, transform: [{ translateY: floatY.value }] }));

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* 波紋 */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: colors.green }, ringStyle]} />
      {/* スタンプ本体 */}
      <Animated.View style={stampStyle}>
        <WateringCan size={size * 0.62} />
      </Animated.View>
      {/* 浮かぶ +◯◯ */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, floatStyle]}>
        <Text style={{ fontFamily: fonts.black, fontSize: 15, color: colors.orangeDeep }}>+{bonus}</Text>
      </Animated.View>
    </View>
  );
}

export function LoginBonusSheet({ visible, claimedToday, amount, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const cardW = Math.min(width - 24, 480);
  const cell = (cardW - 32 - 6 * 6) / 7;
  // 実際の日付でカレンダーを組む（シートを開いた時点の日付で固定）
  const { days } = useMemo(() => buildCalendar(new Date()), [visible]);
  const me = useMe();
  const daily = amount ?? settings.dailyLoginBonus;
  // 受け取り前は「今日を足したら何日目か」を見せたいので、未受取なら +1 して出す
  const streak = me.loginStreak + (claimedToday ? 0 : me.loginStreak > 0 ? 1 : 1);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop}>
        <Animated.View entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))} style={[styles.card, { width: cardW, maxHeight: height * 0.88 }]}>
          {/* 閉じる */}
          <PressableScale onPress={onClose} activeScale={0.85} style={styles.close}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </PressableScale>

          <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {/* ヘッダー */}
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>ログインボーナス</Text>
                <Text style={styles.subtitle}>毎日ログインして肥料をもらおう！</Text>
                {/* 何日続いているかを出す。積み上がっている感じが分かるように（2026-08-21 指摘） */}
                {streak > 0 && (
                  <View style={styles.streakPill}>
                    <Text style={styles.streakFire}>🔥</Text>
                    <Text style={styles.streakText}>
                      <Text style={styles.streakNum}>{streak}</Text>日連続
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.headArt}>
                <WateringCan size={54} />
                <Mikan size={56} />
              </View>
            </View>

            {/* 今日のボーナス */}
            <View style={[styles.todayCard, shadows.soft]}>
              <View style={styles.todayLeft}>
                <View style={styles.leafIcon}>
                  <Ionicons name="leaf" size={20} color={colors.orangeDeep} />
                </View>
                <View>
                  <Text style={styles.todayLabel}>今日のログインボーナス</Text>
                  <View style={styles.todayAmountRow}>
                    <Text style={styles.todayAmount}>+{daily}</Text>
                    <Text style={styles.todayUnit}>肥料</Text>
                  </View>
                </View>
              </View>
              <View style={styles.todayRight}>
                {claimedToday ? (
                  <>
                    <Text style={styles.claimedText}>受け取りました！</Text>
                    <Animated.View entering={BounceIn.delay(RING_DELAY + 320).duration(500)} style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={20} color={colors.white} />
                    </Animated.View>
                  </>
                ) : (
                  <Text style={styles.claimedText}>タップで受け取り</Text>
                )}
              </View>
            </View>

            {/* カレンダー */}
            <View style={styles.calHead}>
              <View style={styles.calTitleRow}>
                <Sprout size={15} base />
                <Text style={styles.calTitle}>ログインカレンダー</Text>
              </View>
              <Text style={styles.calNote}>毎日 +{daily} 肥料</Text>
            </View>

            <View style={styles.week}>
              {WEEK.map((w, i) => (
                <Text key={w} style={[styles.weekText, { width: cell }, i === 6 && { color: '#E4574C' }]}>{w}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {days.map((d) => {
                // 今日より前＝受け取り済みの想定、今日＝受け取ったらスタンプ、先＝これから
                const stamped = d.isPast || (d.isToday && claimedToday);
                return (
                  <View key={d.date.toISOString()} style={[styles.cellWrap, { width: cell }]}>
                    <View
                      style={[
                        styles.cell,
                        { width: cell, height: cell },
                        stamped ? styles.cellStamped : styles.cellFuture,
                        d.isToday && styles.cellToday,
                      ]}
                    >
                      <Text style={[styles.cellDay, stamped && styles.cellDayStamped]}>{d.label}</Text>
                      {stamped ? (
                        d.isToday ? (
                          <TodayStamp size={cell} bonus={daily} active={visible && claimedToday} />
                        ) : (
                          <WateringCan size={cell * 0.62} />
                        )
                      ) : (
                        <View style={{ opacity: 0.45 }}>
                          <Sprout size={cell * 0.4} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.cellBonus, d.isToday && styles.cellBonusMax]}>+{daily}</Text>
                  </View>
                );
              })}
            </View>

            {/* フッター：マスコット＋閉じる */}
            <View style={styles.footer}>
              <View style={styles.mascotRow}>
                <Mikan size={46} />
                <View style={styles.speech}>
                  <Text style={styles.speechText}>明日もログインして{'\n'}ぐんぐん育てよう！</Text>
                </View>
              </View>
              <PressableScale onPress={onClose} activeScale={0.96} style={[styles.closeBtn, shadows.button]}>
                <Sprout size={16} color={colors.white} />
                <Text style={styles.closeBtnText}>閉じる</Text>
              </PressableScale>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(45,40,30,0.5)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  card: { backgroundColor: '#FBF7EA', borderRadius: 24, paddingHorizontal: 16, paddingTop: spacing.xl, overflow: 'hidden' },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', ...shadows.soft },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, paddingRight: 24 },
  title: { fontFamily: fonts.black, fontSize: 24, color: colors.green },
  subtitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary, marginTop: 4 },
  headArt: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  todayCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.lg },
  todayLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  leafIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orangeSoft, justifyContent: 'center', alignItems: 'center' },
  todayLabel: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary },
  todayAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 1 },
  todayAmount: { fontFamily: fonts.black, fontSize: 22, color: colors.orangeDeep },
  todayUnit: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.green },
  todayRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderLeftWidth: 1, borderLeftColor: colors.divider, paddingLeft: spacing.md },
  claimedText: { fontFamily: fonts.black, fontSize: 13, color: colors.textPrimary },
  checkCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  calTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center',
    backgroundColor: colors.orangeSoft, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: 6,
  },
  streakFire: { fontSize: 13 },
  streakText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.orangeDeep },
  streakNum: { fontFamily: fonts.black, fontSize: 15 },
  calTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  calNote: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.orangeDeep },
  week: { flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: colors.border, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 7, marginBottom: spacing.sm },
  weekText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cellWrap: { alignItems: 'center', marginBottom: 4 },
  cell: { borderRadius: 999, justifyContent: 'center', alignItems: 'center', paddingTop: 2 },
  cellStamped: { borderWidth: 1.5, borderColor: colors.green, backgroundColor: '#F2F8EC' },
  cellFuture: { borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.6)' },
  cellToday: { borderWidth: 2.5, borderColor: colors.orange, backgroundColor: '#FDF3E0' },
  cellDay: { position: 'absolute', top: 3, fontFamily: fonts.bold, fontSize: 9, color: colors.textSecondary },
  cellDayStamped: { color: colors.green },
  cellBonus: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textSecondary, marginTop: 3 },
  cellBonusMax: { color: colors.orangeDeep, fontFamily: fonts.black },
  footer: { marginTop: spacing.md },
  mascotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  speech: { backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, ...shadows.soft },
  speechText: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: lh(17), color: colors.textPrimary },
  closeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 50, borderRadius: radius.pill, backgroundColor: colors.green, paddingVertical: 8, paddingHorizontal: 14 },
  closeBtnText: { flexShrink: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.white, },
});
