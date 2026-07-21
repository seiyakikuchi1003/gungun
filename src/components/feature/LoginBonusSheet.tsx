import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, ZoomIn, BounceIn } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';
import { WateringCan } from '@/components/art/WateringCan';
import { Sprout } from '@/components/art/Sprout';
import { settings } from '@/config/settings';

type Props = {
  visible: boolean;
  claimedToday: boolean; // 受け取り済みか
  onClose: () => void;
};

/**
 * ログインボーナスのポップアップ（スタンプカレンダー）。
 * 「受け取る」とカレンダーの今日のマスにじょうろのスタンプが
 * ポンッと押される（BounceIn）。連続ログインでボーナスが増える。
 */

// 21日サイクルのボーナステーブル（金額は設定基準の暫定。本実装では app_settings から）
const BONUS: number[] = [
  40, 40, 40, 40, 40, 40, 40,
  40, 40, 50, 50, 60, 60, 70,
  70, 80, 80, 90, 90, 100, 120,
];
const TODAY = 8; // デモ：連続8日目
const WEEK = ['月', '火', '水', '木', '金', '土', '日'];

export function LoginBonusSheet({ visible, claimedToday, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const cardW = Math.min(width - 24, 480);
  const cell = (cardW - 32 - 6 * 6) / 7;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop}>
        <Animated.View entering={ZoomIn.springify().damping(14).duration(350)} style={[styles.card, { width: cardW, maxHeight: height * 0.88 }]}>
          {/* 閉じる */}
          <PressableScale onPress={onClose} activeScale={0.85} style={styles.close}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </PressableScale>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {/* ヘッダー */}
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>ログインボーナス</Text>
                <Text style={styles.subtitle}>毎日ログインして肥料をもらおう！</Text>
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
                    <Text style={styles.todayAmount}>+{settings.dailyLoginBonus}</Text>
                    <Text style={styles.todayUnit}>肥料</Text>
                  </View>
                </View>
              </View>
              <View style={styles.todayRight}>
                {claimedToday ? (
                  <>
                    <Text style={styles.claimedText}>受け取りました！</Text>
                    <Animated.View entering={BounceIn.delay(250).duration(500)} style={styles.checkCircle}>
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
              <Text style={styles.calNote}>連続ログインでボーナスUP！</Text>
            </View>

            <View style={styles.week}>
              {WEEK.map((w, i) => (
                <Text key={w} style={[styles.weekText, { width: cell }, i === 6 && { color: '#E4574C' }]}>{w}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {BONUS.map((amount, i) => {
                const day = i + 1;
                const stamped = day < TODAY || (day === TODAY && claimedToday);
                const isToday = day === TODAY;
                const isMax = day === BONUS.length;
                return (
                  <View key={day} style={[styles.cellWrap, { width: cell }]}>
                    <View style={[styles.cell, { width: cell, height: cell }, stamped ? styles.cellStamped : styles.cellFuture]}>
                      <Text style={[styles.cellDay, stamped && styles.cellDayStamped]}>{day}</Text>
                      {stamped ? (
                        isToday ? (
                          <Animated.View entering={BounceIn.delay(350).duration(550)}>
                            <WateringCan size={cell * 0.62} />
                          </Animated.View>
                        ) : (
                          <WateringCan size={cell * 0.62} />
                        )
                      ) : (
                        <View style={{ opacity: 0.45 }}>
                          <Sprout size={cell * 0.4} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.cellBonus, isMax && styles.cellBonusMax]}>+{amount}</Text>
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
  calTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  calNote: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.orangeDeep },
  week: { flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: colors.border, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 7, marginBottom: spacing.sm },
  weekText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cellWrap: { alignItems: 'center', marginBottom: 4 },
  cell: { borderRadius: 999, justifyContent: 'center', alignItems: 'center', paddingTop: 2 },
  cellStamped: { borderWidth: 1.5, borderColor: colors.green, backgroundColor: '#F2F8EC' },
  cellFuture: { borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.6)' },
  cellDay: { position: 'absolute', top: 3, fontFamily: fonts.bold, fontSize: 9, color: colors.textSecondary },
  cellDayStamped: { color: colors.green },
  cellBonus: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textSecondary, marginTop: 3 },
  cellBonusMax: { color: colors.orangeDeep, fontFamily: fonts.black },
  footer: { marginTop: spacing.md },
  mascotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  speech: { backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, ...shadows.soft },
  speechText: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 17, color: colors.textPrimary },
  closeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 50, borderRadius: radius.pill, backgroundColor: colors.green },
  closeBtnText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
});
