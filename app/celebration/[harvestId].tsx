import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Mikan } from '@/components/art/Mikan';
import { NotFound } from '@/components/ui/NotFound';
import { fetchHarvestRing, type RingStep } from '@/lib/api/ring';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useMe } from '@/store/me';
import { success } from '@/lib/haptics';
import { playSfx } from '@/lib/sound';

/**
 * 収穫完了（お祝い）画面 — 2026-08-12 指示書 項目9。
 *
 * 玉突き交換は「A の物が B へ、B の物が C へ、C の物が A へ」と一周して初めて終わる。
 * 一人ひとりは自分の取引しか見ていないので、
 * 全体がどう繋がったのかを見せる場がここまで無かった。
 *
 * 種を一番上に置き、矢印で下へ辿れるようにして「1個の輪ができた」ことを示す。
 * 対象はこの輪に携わった人だけ（切り離された苗木は exchanges を持たないので入らない）。
 */
export default function Celebration() {
  const { harvestId } = useLocalSearchParams<{ harvestId: string }>();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [steps, setSteps] = useState<RingStep[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseEnabled || !harvestId) { setSteps([]); return; }
    try {
      setSteps(await fetchHarvestRing(harvestId));
    } catch {
      setFailed(true);
    }
  }, [harvestId]);

  useEffect(() => { load(); }, [load]);

  // 全員そろったときだけ祝う（途中で開いても進み具合として読める）
  const complete = !!steps?.length && steps.every((s) => s.received);
  useEffect(() => {
    if (complete) { success(); playSfx('pop'); }
  }, [complete]);

  if (failed) return <NotFound message="この収穫は見つかりませんでした" fallback="/exchange" />;

  if (!steps) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (!steps.length) {
    return <NotFound message="この収穫の輪は見られません" fallback="/exchange" />;
  }

  const people = new Set(steps.flatMap((s) => [s.giverId, s.receiverId])).size;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {/* 取引詳細から開いたのに取引一覧まで戻されるのが分かりにくかった（2026-08-13 指摘）。
            来た道が残っていれば1つ戻る。無ければ取引一覧へ */}
        <PressableScale
          onPress={() => (router.canGoBack() ? router.back() : router.dismissTo('/exchange'))}
          activeScale={0.9}
          style={styles.hBtn}
        >
          <Ionicons name={router.canGoBack() ? 'chevron-back' : 'close'} size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>{complete ? '収穫完了' : '輪のようす'}</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Animated.View entering={ZoomIn.duration(420)} style={styles.hero}>
          <Mikan size={72} />
          <Text style={styles.heroTitle}>
            {complete ? '1個の輪ができました！' : 'あと少しで輪が完成します'}
          </Text>
          <Text style={styles.heroSub}>
            {complete
              ? `${people}人の手をつないで、${steps.length}個の品物が新しい持ち主のもとへ渡りました。`
              : `${people}人が参加中。全員の受け取りが終わると輪が完成します。`}
          </Text>
        </Animated.View>

        <Text style={styles.sectionLabel}>品物のたどった道</Text>

        {steps.map((s, i) => (
          <Animated.View key={s.exchangeId} entering={FadeInDown.delay(i * 90).duration(360)}>
            <View style={[styles.card, shadows.soft, !s.received && styles.cardWaiting]}>
              <Thumb source={undefined} uri={s.itemImage ?? undefined} style={styles.thumb} radius={radius.md} markSize={22} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.itemName} numberOfLines={1}>{s.itemName}</Text>
                  {i === 0 && <View style={styles.seedTag}><Text style={styles.seedTagText}>タネ</Text></View>}
                </View>

                {/* 誰から誰へ渡ったか。ここが「獲得した人」の表示にあたる */}
                <View style={styles.flow}>
                  <Avatar uri={s.giverAvatar ?? undefined} name={s.giverName} size={20} />
                  <Text style={styles.person} numberOfLines={1}>{s.giverName}</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.orange} />
                  <Avatar uri={s.receiverAvatar ?? undefined} name={s.receiverName} size={20} />
                  <Text style={[styles.person, styles.personGot]} numberOfLines={1}>{s.receiverName}</Text>
                </View>

                <Text style={[styles.state, s.received && styles.stateDone]}>
                  {s.received
                    ? `${s.receiverName}さんが受け取りました`
                    : '受け取り待ち'}
                </Text>
              </View>
            </View>

            {/* 最後の1つは輪の閉じ目なので、矢印を上に返す */}
            {i < steps.length - 1 ? (
              <View style={styles.arrow}>
                <Ionicons name="arrow-down" size={18} color={colors.orange} />
              </View>
            ) : (
              <Animated.View entering={FadeIn.delay(steps.length * 90)} style={styles.loopBack}>
                <Ionicons name="repeat" size={16} color={colors.orange} />
                <Text style={styles.loopBackText}>ここで一周してタネに戻ります</Text>
              </Animated.View>
            )}
          </Animated.View>
        ))}

        {complete && (
          <View style={styles.thanks}>
            <Text style={styles.thanksText}>
              あなたのタネが、知らない誰かの「欲しい」につながりました。またタネを植えて、次の輪をはじめてみませんか？
            </Text>
          </View>
        )}

        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          {complete && (
            <Button title="次のタネを植える" onPress={() => router.dismissTo('/plant/seed')} />
          )}
          <PressableScale onPress={() => router.dismissTo('/exchange')} activeScale={0.97} style={styles.ghostBtn}>
            <Text style={styles.ghostText}>取引一覧へ</Text>
          </PressableScale>
        </View>

        {/* 自分がどこにいるか分からなくならないように一言添える */}
        <Text style={styles.meNote}>
          {steps.some((s) => s.receiverId === me.id)
            ? `${me.nickname}さんは「${steps.find((s) => s.receiverId === me.id)?.itemName}」を受け取りました。`
            : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },

  hero: {
    alignItems: 'center', gap: spacing.sm, backgroundColor: colors.orangeSoft,
    borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.xl,
    borderWidth: 1, borderColor: colors.orange,
  },
  heroTitle: { fontFamily: fonts.black, fontSize: 20, color: colors.orangeDeep, textAlign: 'center' },
  heroSub: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },

  sectionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md,
  },
  cardWaiting: { opacity: 0.6 },
  thumb: { width: 60, height: 60 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemName: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  seedTag: { backgroundColor: colors.greenSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  seedTagText: { fontFamily: fonts.bold, fontSize: 10, color: colors.greenDeep },
  flow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  person: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  personGot: { fontFamily: fonts.bold, color: colors.textPrimary },
  state: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  stateDone: { color: colors.green },

  arrow: { alignItems: 'center', paddingVertical: 4 },
  loopBack: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: spacing.md,
  },
  loopBackText: { fontFamily: fonts.bold, fontSize: 12, color: colors.orange },

  thanks: {
    backgroundColor: colors.greenSoft, borderRadius: radius.card, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.greenSoftBorder, marginTop: spacing.md,
  },
  // 短い一言は中央のまま。長い説明は左揃えにして行頭をそろえる（2026-08-21 指摘）
  thanksText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 22, color: colors.greenDeep },

  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, borderRadius: radius.pill, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  ghostText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  meNote: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
});
