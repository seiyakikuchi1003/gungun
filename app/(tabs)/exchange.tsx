import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { TopTabs } from '@/components/ui/TopTabs';
import { Thumb } from '@/components/ui/Thumb';
import { Avatar } from '@/components/ui/Avatar';
import { useExchanges, type UITrade } from '@/hooks/useExchanges';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

/** 2ステップの進捗（発送→受取）。done は完了段階。 */
function Steps({ labels, done, accent }: { labels: [string, string]; done: number; accent: string }) {
  return (
    <View style={styles.steps}>
      {labels.map((l, i) => {
        const complete = i < done;
        const current = i === done;
        return (
          <React.Fragment key={i}>
            <View style={styles.step}>
              <View style={[styles.stepDot, complete && { backgroundColor: accent, borderColor: accent }, current && { borderColor: accent }]}>
                {complete ? <Ionicons name="checkmark" size={11} color={colors.white} /> : <Text style={[styles.stepNum, current && { color: accent }]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, (complete || current) && { color: colors.textPrimary, fontFamily: fonts.bold }]}>{l}</Text>
            </View>
            {i === 0 && <View style={[styles.stepLine, done > 0 && { backgroundColor: accent }]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function actionHint(t: UITrade): string {
  if (t.dir === 'receive') return t.status === 'received' ? '取引完了・評価済み' : t.status === 'shipped' ? '届いたら受け取り報告を' : '相手の発送を待っています';
  return t.status === 'received' ? '取引完了' : t.status === 'shipped' ? '相手の受け取りを待っています' : '発送して報告しましょう';
}

export default function ExchangeScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'receive' | 'send'>('receive');
  const { list: all, loading, reload } = useExchanges();
  // 画面に戻ったとき・アプリを前面に戻したときに最新を取り直す
  useAutoRefresh(reload);
  // 引っ張って更新（他の画面と同じ操作で最新にできるように）
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch {
      // 取得に失敗しても画面は保つ
    }
    setRefreshing(false);
  }, [reload]);
  const list = all.filter((t) => t.dir === tab);
  const accent = tab === 'receive' ? colors.green : colors.orange;
  const actionCount = list.filter((t) => (tab === 'receive' ? t.status === 'shipped' : t.status === 'pending')).length;
  // 「送る商品3件」と「1件が対応待ち」が並ぶと、数が食い違って見えた（2026-08-13 指摘）。
  // 見出しは進行中の件数にして、対応待ちはその内訳として書く
  const ongoing = list.filter((t) => t.status !== 'received').length;
  const finished = list.length - ongoing;
  // タブごとの「あなたの対応待ち」件数（表示中でない側も数える）
  const needReceive = all.filter((t) => t.dir === 'receive' && t.status === 'shipped').length;
  const needSend = all.filter((t) => t.dir === 'send' && t.status === 'pending').length;

  // 左にはらう＝次のタブ、右にはらう＝前のタブ。縦スクロールと競合しないよう Fling を使う
  const swipe = Gesture.Race(
    Gesture.Fling().direction(Directions.LEFT).onEnd(() => setTab('send')).runOnJS(true),
    Gesture.Fling().direction(Directions.RIGHT).onEnd(() => setTab('receive')).runOnJS(true)
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>取引</Text>
        <View style={styles.hBtn} />
      </View>

      <TopTabs
        tabs={[
          // 見ていない側のタブにも用事があると気づけるよう、対応待ちの件数を出す
          { key: 'receive', label: '受け取る', color: colors.green, alert: needReceive },
          { key: 'send', label: '送る', color: colors.orange, alert: needSend },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'receive' | 'send')}
      />

      {/* 横にはらうとタブが切り替わる。指で行き来できた方が自然（2026-08-05 指摘） */}
      <GestureDetector gesture={swipe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.green]} tintColor={colors.green} />}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        <View style={[styles.summary, { backgroundColor: tab === 'receive' ? colors.greenSoft : colors.orangeSoft }]}>
          <View style={[styles.summaryIcon, { backgroundColor: accent }]}>
            <Ionicons name={tab === 'receive' ? 'download' : 'send'} size={18} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryTitle, { color: accent }]}>
              {tab === 'receive' ? '受け取る商品' : '送る商品'} 進行中 {ongoing}件
            </Text>
            <Text style={styles.summarySub}>
              {actionCount > 0
                ? `うち${actionCount}件があなたの対応待ちです`
                : ongoing > 0
                  ? '相手の対応を待っています'
                  : finished > 0
                    ? `対応待ちはありません（完了 ${finished}件）`
                    : '進行中の取引はありません'}
            </Text>
          </View>
        </View>

        {list.map((t) => {
          // 商品名・相手名は取引の行が持っている（実DBでは UUID から引けない）
          const it = { name: t.itemName, image: t.itemImage ?? '', local: t.itemLocal };
          const u = { nickname: t.partnerName, avatar: t.partnerAvatar };
          if (!it) return null;
          const done = t.status === 'received' ? 2 : t.status === 'shipped' ? 1 : 0;
          const labels: [string, string] = t.dir === 'receive' ? ['相手が発送', '受け取り'] : ['発送', '相手が受け取り'];
          const needAction = tab === 'receive' ? t.status === 'shipped' : t.status === 'pending';
          return (
            <PressableScale key={t.id} activeScale={0.98} onPress={() => router.push(`/exchange/${t.id}`)} style={[styles.card, shadows.card, { borderLeftColor: accent }]}>
              <View style={styles.cardTop}>
                <Thumb source={it.local} uri={it.image} style={styles.thumb} radius={radius.md} markSize={24} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{it.name}</Text>
                  <View style={styles.ownerRow}>
                    <Avatar uri={u.avatar} name={u.nickname} size={18} />
                    <Text style={styles.owner}>{u.nickname}さん{t.dir === 'receive' ? 'から' : 'へ'}</Text>
                  </View>
                </View>
                {needAction && <View style={[styles.actionDot, { backgroundColor: accent }]} />}
              </View>
              <Steps labels={labels} done={done} accent={accent} />
              <View style={styles.cardFoot}>
                <Ionicons name="ellipse" size={7} color={needAction ? accent : colors.border} />
                <Text style={[styles.hint, needAction && { color: colors.textPrimary, fontFamily: fonts.bold }]}>{actionHint(t)}</Text>
                {t.shippedAt && <Text style={styles.date}>発送 {t.shippedAt}</Text>}
              </View>
            </PressableScale>
          );
        })}
        {list.length === 0 && <Text style={styles.empty}>進行中の取引はありません</Text>}
      </ScrollView>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, marginBottom: spacing.lg },
  summaryIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  summaryTitle: { fontFamily: fonts.bold, fontSize: 15 },
  summarySub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 56, height: 56 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  owner: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  actionDot: { width: 10, height: 10, borderRadius: 5 },
  steps: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  step: { alignItems: 'center', gap: 5, width: 92 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
  stepNum: { fontFamily: fonts.bold, fontSize: 12, color: colors.textPlaceholder },
  stepLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginTop: -18 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  hint: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  date: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
