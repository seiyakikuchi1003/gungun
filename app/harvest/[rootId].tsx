import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Button } from '@/components/ui/Button';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Mikan } from '@/components/art/Mikan';
import { Sprout } from '@/components/art/Sprout';
import { Avatar } from '@/components/ui/Avatar';
import { MockItem } from '@/data/mock';
import { useTree } from '@/store/tree';
import { success } from '@/lib/haptics';
import { playSfx } from '@/lib/sound';
import { useMe } from '@/store/me';
import { FormError } from '@/components/ui/FormError';
import { NotFound } from '@/components/ui/NotFound';
import { useUsers } from '@/store/users';

/**
 * 収穫画面。
 *
 * ★重要な仕様（SPEC 2-3 / 3-4）
 * 収穫は「選んだ商品までの“一本道”だけ」で成立する。木にぶら下がる全員ではない。
 *   例）A(種) → B → D → F の木で D を選ぶと、輪は A・B・D の3人。
 *       F や、途中で分かれた別の枝の人は輪に入らず、それぞれ新しいタネとして独立する。
 * ここでは実際のツリー（parentId/rootId）から祖先ラインを引いて輪を組み立てる。
 */
export default function HarvestDetail() {
  const users = useUsers();
  const me = useMe();
  const { rootId } = useLocalSearchParams<{ rootId: string }>();
  const insets = useSafeAreaInsets();
  const { getItem, treeItems, ancestorsOf, harvestSeed } = useTree();
  const [busy, setBusy] = useState(false);
  const [harvestError, setHarvestError] = useState<string | null>(null);
  const seed = getItem(rootId ?? '');
  const [target, setTarget] = useState<MockItem | null>(null);
  const [done, setDone] = useState(false);

  if (!seed) return <NotFound message="このタネは見つかりませんでした" hint="収穫が済んでいるか、通知が古い可能性があります。" fallback="/(tabs)/harvest" />;

  // 集まった商品＝この木にぶら下がっている商品（種そのものは除く）
  const gathered = treeItems(seed.id)
    .filter((i) => i.id !== seed.id)
    .sort((a, b) => a.depth - b.depth);

  /** 選んだ商品までの一本道（root → … → target）。この人たちだけが輪になる */
  const pathTo = (item: MockItem): MockItem[] =>
    [...ancestorsOf(item.id)].sort((a, b) => a.depth - b.depth);

  // 収穫できるのは「まだ育っている」タネだけ。
  // 一覧では止めていたが、この画面に直接来ると押せてしまっていた（2026-08-13 修正）
  const canHarvest = seed.status === 'growing';
  const path = target ? pathTo(target) : [];
  // 輪から外れる件数（別の枝＋選んだ商品より先）＝それぞれ新しいタネとして独立する
  const detachedCount = target ? gathered.length + 1 - path.length : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle} numberOfLines={1}>{seed.name}</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={[styles.seedCard, shadows.soft]}>
          <Thumb source={seed.local} uri={seed.image} style={styles.seedThumb} radius={radius.md} markSize={30} />
          <View style={{ flex: 1 }}>
            <Text style={styles.seedName}>{seed.name}</Text>
            {/* 件数は下の「集まった商品（N）」で出すので、ここでは重ねて言わない */}
            <Text style={styles.seedSub}>あなたのタネ</Text>
          </View>
        </View>

        <View style={styles.gatherHead}>
          <Sprout size={18} />
          <Text style={styles.gatherTitle}>集まった商品（{gathered.length}）</Text>
        </View>
        <Text style={styles.hint}>
          ひとつ選ぶと、<Text style={styles.hintStrong}>その商品までの一本道の人だけ</Text>が輪になって交換します。
          別の枝や、選んだ商品より先の人は輪に入らず、新しいタネとして独立します。
        </Text>

        {gathered.map((g) => {
          const u = users.user(g.ownerId);
          const ring = pathTo(g); // この商品を選んだときの輪
          return (
            <View key={g.id} style={[styles.gCard, shadows.soft]}>
              <Thumb source={g.local} uri={g.image} style={styles.gThumb} radius={radius.md} markSize={26} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gName} numberOfLines={1}>{g.name}</Text>
                <View style={styles.gMeta}>
                  <Text style={styles.gOwner}>{u.nickname}さん</Text>
                  <View style={styles.depthChip}>
                    <Text style={styles.depthChipText}>{g.depth}段目</Text>
                  </View>
                </View>
                <View style={styles.ringChip}>
                  <Ionicons name="sync" size={11} color={colors.green} />
                  <Text style={styles.ringChipText}>{ring.length}人の輪</Text>
                </View>
              </View>
              {canHarvest ? (
                <PressableScale onPress={() => setTarget(g)} activeScale={0.94} style={styles.harvestBtn}>
                  <Text style={styles.harvestText}>収穫する</Text>
                </PressableScale>
              ) : (
                <View style={[styles.harvestBtn, styles.harvestBtnOff]}>
                  <Text style={styles.harvestTextOff}>収穫済み</Text>
                </View>
              )}
            </View>
          );
        })}

        {!canHarvest && (
          <View style={styles.doneNote}>
            <Ionicons name="checkmark-circle" size={18} color={colors.green} />
            <Text style={styles.doneNoteText}>このタネは収穫済みです。取引画面から発送を進めてください。</Text>
          </View>
        )}

        {gathered.length === 0 && (
          <Text style={styles.empty}>まだ水やりがありません。{'\n'}誰かが水やりすると、ここに商品が集まります。</Text>
        )}
      </ScrollView>

      {/* 収穫確認 */}
      <BottomSheetModal visible={!!target && !done} onClose={() => setTarget(null)}>
        <View style={styles.confirmCenter}>
          <Mikan size={88} />
          <Text style={styles.confirmTitle}>この商品を収穫しますか？</Text>
          <Text style={styles.confirmSub}>{target?.name} まで、一本道の {path.length} 人で交換します</Text>
        </View>

        {/* 交換の輪：path[i]の品 → path[i+1]の人／最後は先頭（あなた）に戻る */}
        <View style={styles.ringBox}>
          <Text style={styles.ringTitle}>{path.length}人の輪ができます</Text>
          <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ringRow}>
            {path.map((node) => {
              const u = users.user(node.ownerId);
              const isMe = node.ownerId === me.id;
              return (
                <React.Fragment key={node.id}>
                  <View style={styles.ringUser}>
                    <Avatar uri={u.avatar} name={u.nickname} size={40} />
                    <Text style={styles.ringName} numberOfLines={1}>{isMe ? 'あなた' : u.nickname}</Text>
                    <Text style={styles.ringItem} numberOfLines={1}>{node.name}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={colors.greenSoftBorder} style={styles.ringArrow} />
                </React.Fragment>
              );
            })}
            {/* 輪が閉じる：末端の品はあなたへ */}
            <View style={styles.ringUser}>
              <Avatar uri={me.avatar} name={me.nickname} size={40} />
              <Text style={styles.ringName}>あなた</Text>
              <Text style={styles.ringItem}>（輪が閉じる）</Text>
            </View>
          </ScrollView>
          <Text style={styles.ringNote}>それぞれ1回送って、1回受け取ります</Text>
        </View>

        {detachedCount > 0 && (
          <View style={styles.detachBox}>
            <Sprout size={16} />
            <Text style={styles.detachText}>
              輪に入らない {detachedCount} 件は、それぞれ新しいタネとして独立します
            </Text>
          </View>
        )}

        <View style={styles.noteBox}>
          <Ionicons name="alert-circle" size={18} color={colors.orangeDeep} />
          <Text style={styles.noteText}>収穫すると取り消せません。輪の全員に発送義務が発生します。</Text>
        </View>
        {harvestError ? <FormError message={harvestError} /> : null}
        <Button
          title="収穫する（交換開始）"
          variant="accent"
          loading={busy}
          onPress={async () => {
            if (!target || busy) return;
            setHarvestError(null);
            setBusy(true);
            const res = await harvestSeed(seed.id, target.id);
            setBusy(false);
            if (res.error) { setHarvestError(res.error); return; }
            success();
            playSfx('chime'); // 収穫成立の「ピロン↑」
            setDone(true);
          }}
          style={{ marginTop: spacing.lg }}
        />
        <PressableScale onPress={() => setTarget(null)} style={styles.cancel}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </PressableScale>
      </BottomSheetModal>

      {/* 収穫成功 */}
      <BottomSheetModal visible={done} onClose={() => { setDone(false); setTarget(null); router.back(); }}>
        <Animated.View entering={FadeIn} style={styles.confirmCenter}>
          <Animated.View entering={ZoomIn.springify().damping(10)}>
            <Mikan size={120} />
          </Animated.View>
          <Text style={styles.confirmTitle}>収穫しました！🎉</Text>
          <Text style={styles.confirmSub}>輪の全員に「発送してください」の通知を送りました。取引画面から発送を進めましょう。</Text>
        </Animated.View>
        {/* 収穫画面をスタックに残さない（戻るとまた収穫画面に出てしまうため） */}
        <Button title="取引画面へ" onPress={() => { setDone(false); setTarget(null); router.dismissTo('/exchange'); }} style={{ marginTop: spacing.xl }} />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  harvestBtnOff: { backgroundColor: colors.cardMuted },
  harvestTextOff: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  doneNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.greenSoft, borderRadius: radius.card,
    padding: spacing.md, marginBottom: spacing.md,
  },
  doneNoteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.green },
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  seedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md },
  seedThumb: { width: 60, height: 60 },
  seedName: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  seedSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 3 },
  gatherHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xs },
  gatherTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  hint: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 19 },
  hintStrong: { fontFamily: fonts.bold, color: colors.green },
  gCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.md },
  gThumb: { width: 56, height: 56 },
  gName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  gMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  gOwner: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  depthChip: { backgroundColor: colors.cardMuted, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  depthChipText: { fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary },
  ringChip: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: colors.greenSoft, paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: radius.pill, marginTop: 5 },
  ringChipText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.green },
  empty: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  ringBox: { backgroundColor: colors.greenSoft, borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.md, alignItems: 'center' },
  ringTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.greenDeep, marginBottom: spacing.md },
  ringRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4 },
  ringUser: { alignItems: 'center', gap: 3, width: 62 },
  ringName: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textPrimary },
  ringItem: { fontFamily: fonts.regular, fontSize: 9.5, color: colors.textSecondary },
  ringArrow: { marginTop: 13 },
  ringNote: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginTop: spacing.md },
  detachBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgWarm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  detachText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  harvestBtn: { backgroundColor: colors.orange, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill },
  harvestText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  confirmCenter: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  confirmTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, marginTop: spacing.sm },
  confirmSub: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: spacing.lg },
  noteBox: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.orangeSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.orangeDeep, lineHeight: 19 },
  cancel: { alignItems: 'center', paddingVertical: spacing.lg },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
});
