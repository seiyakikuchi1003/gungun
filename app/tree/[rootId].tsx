import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { RatingSummary } from '@/components/ui/RatingSummary';
import { Sprout } from '@/components/art/Sprout';
import { TreeCanvas } from '@/components/feature/TreeCanvas';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
/*
 * 共有ボタンは外した（2026-08-14 指摘）。
 * 文面しか渡せず、受け取った人が商品や木にたどり着けないため。
 * App Store 公開後にアプリのURLが決まったら、リンク付きで戻す。
 */
import { Toast } from '@/components/ui/Toast';
import { useTree } from '@/store/tree';
import { useMe } from '@/store/me';
import { useUsers } from '@/store/users';

export default function TreeScreen() {
  const users = useUsers();
  const me = useMe();
  const { rootId, new: newId } = useLocalSearchParams<{ rootId: string; new?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getItem, childrenOf, treeItems, canWater } = useTree();
  const [showAll, setShowAll] = useState(true);
  const [pickWater, setPickWater] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 統計を押したときに開く一覧（2026-08-13 項目9）
  const [detail, setDetail] = useState<'all' | 'direct' | 'people' | null>(null);

  const root = getItem(rootId ?? '');
  if (!root) return <View style={styles.root} />;

  const owner = users.user(root.ownerId);
  const mine = root.ownerId === me.id;
  const rootChildren = childrenOf(root.id);
  // 木のノード全部（root＋子孫）。順序は付けない（ツリー表示側で親子順に並べる）
  const all = treeItems(root.id);
  // 木が読めていないときに 0 - 1 = -1 と出ていた（2026-08-13 修正）
  const waterings = Math.max(0, all.length - 1);
  const branches = rootChildren.length;
  const canHarvest = mine && waterings > 0 && root.status === 'growing';
  // 段（深さ）は見せない方針（2026-08-12 指摘）。代わりに「何人が関わったか」を出す
  const joiners = new Set(all.map((i) => i.ownerId)).size;
  const justWatered = !!newId;
  const cardW = width - 40;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => (justWatered ? router.dismissTo('/(tabs)') : router.back())} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name={justWatered ? 'close' : 'chevron-back'} size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>木の様子（マイツリー）</Text>
        <PressableScale onPress={() => router.push('/water/about')} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* 完了バナー */}
        {justWatered && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.doneBanner}>
            <View style={styles.doneIcon}><Ionicons name="checkmark" size={22} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doneTitle}>水やりが完了しました！</Text>
              <Text style={styles.doneSub}>あなたの商品が木に追加されました🌱</Text>
            </View>
          </Animated.View>
        )}

        {/* 元の種 */}
        <Text style={styles.blockLabel}>元の種（{mine ? 'あなたの出品' : `${owner.nickname}さんの出品`}）</Text>
        <View style={[styles.rootCard, shadows.soft]}>
          <Thumb source={root.local} uri={root.image} style={styles.rootThumb} radius={radius.md} markSize={22} />
          <View style={{ flex: 1 }}>
            <View style={styles.rootTop}>
              <Text style={styles.rootName} numberOfLines={1}>{root.name}</Text>
              <Badge label={root.status === 'growing' ? '成長中' : '取引中'} tone={root.status === 'growing' ? 'green' : 'orange'} />
            </View>
            <View style={styles.rootMeta}>
              <Avatar uri={owner.avatar} name={owner.nickname} size={18} />
              <Text style={styles.rootOwner}>{owner.nickname}さん</Text>
              <RatingSummary avg={owner.ratingAvg ?? null} count={owner.ratingCount} size={12} gap={1} />
            </View>
            <Text style={styles.rootSub}>この種への直接の水やり：{branches}件</Text>
          </View>
        </View>

        {/* 木のイラスト */}
        <View style={[styles.canvasCard, shadows.card]}>
          <TreeCanvas
            width={cardW - 4}
            children={rootChildren}
            treeSize={all.length}
            highlightId={newId}
            onPressNode={(it) => router.push(`/item/${it.id}`)}
            onPressEmpty={() => setPickWater(true)}
          />
        </View>

        {/* 統計。3つとも違うことを指すように言い分ける（同じ数字を別名で出さない）。
            数だけ出しても中身が分からないので、押すと一覧が開く（2026-08-13 項目9） */}
        <View style={styles.statRow}>
          <Stat num={waterings} label="集まった商品" onPress={() => setDetail('all')} />
          <View style={styles.statDivider} />
          <Stat num={branches} label="直接の水やり" onPress={() => setDetail('direct')} />
          <View style={styles.statDivider} />
          <Stat num={joiners} label="関わった人" accent onPress={() => setDetail('people')} />
        </View>

        {/* アクション */}
        {justWatered ? (
          /* 1つの木につき1人1回まで。水やり直後に「もっと水やりする」を出すと
             必ず断られるボタンになるので出さない（2026-08-13 項目2） */
          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <View style={styles.mineNote}>
              <Ionicons name="checkmark-circle" size={16} color={colors.green} />
              <Text style={styles.mineNoteText}>
                水やりが完了しました。1つの木につき水やりは1人1回までです。
              </Text>
            </View>
            <PressableScale onPress={() => router.dismissTo('/(tabs)')} activeScale={0.97} style={styles.ghostBtn}>
              <Text style={styles.ghostText}>ホームに戻る</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            {/* 自分の種に水やりが集まっていれば、ここから収穫へ進める */}
            {canHarvest && (
              <PressableScale onPress={() => router.push(`/harvest/${root.id}`)} activeScale={0.97} style={[styles.harvestBtn, shadows.button]}>
                <Ionicons name="sparkles" size={18} color={colors.white} />
                <Text style={styles.shareText}>収穫する（{waterings}件から選ぶ）</Text>
              </PressableScale>
            )}
            {/* 自分のタネの木には水やりできない（1つの木につき1人1回まで）。
                押せてしまうと必ず断られるので、そもそも出さない（2026-08-12 指摘） */}
            {!mine && (
              <PressableScale onPress={() => setPickWater(true)} activeScale={0.97} style={[styles.waterBtn, shadows.button]}>
                <Ionicons name="water" size={18} color={colors.white} />
                <Text style={styles.shareText}>この木に水やりする</Text>
              </PressableScale>
            )}
            {mine && !canHarvest && (
              <View style={styles.mineNote}>
                <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
                <Text style={styles.mineNoteText}>
                  あなたのタネの木です。誰かが水やりすると、ここから収穫できます。
                </Text>
              </View>
            )}
          </View>
        )}

        {/* この木の全商品 */}
        <PressableScale onPress={() => setShowAll((v) => !v)} activeScale={0.98} style={styles.allToggle}>
          <Sprout size={16} />
          <Text style={styles.allToggleText}>水やりの連鎖（{all.length}）</Text>
          <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </PressableScale>

        {showAll && (
          <Animated.View entering={FadeIn.duration(250)} style={{ gap: spacing.xs }}>
            <WaterGrid
              items={all.filter((i) => i.id !== root.id)}
              highlightId={newId ?? null}
              onOpen={(it) => router.push(`/item/${it.id}`)}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* 統計の中身。数だけでは何が集まったのか分からないため（2026-08-13 項目9） */}
      <BottomSheetModal visible={detail !== null} onClose={() => setDetail(null)}>
        <Text style={styles.pickTitle}>
          {detail === 'all' ? '集まった商品' : detail === 'direct' ? '直接の水やり' : '関わった人'}
        </Text>
        <ScrollView style={{ maxHeight: 380, marginTop: spacing.md }} showsVerticalScrollIndicator={false}>
          {detail === 'people' ? (
            [...new Set(all.map((i) => i.ownerId))].map((uid) => {
              const u = users.user(uid);
              const count = all.filter((i) => i.ownerId === uid).length;
              return (
                <PressableScale
                  key={uid}
                  activeScale={0.98}
                  onPress={() => { setDetail(null); router.push(`/user/${uid}`); }}
                  style={styles.sheetRow}
                >
                  <Avatar uri={u.avatar} name={u.nickname} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName} numberOfLines={1}>{u.nickname}さん</Text>
                    <Text style={styles.sheetSub}>この木に{count}件</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </PressableScale>
              );
            })
          ) : (
            (detail === 'direct' ? rootChildren : all.filter((i) => i.id !== root.id)).map((it) => {
              const u = users.user(it.ownerId);
              return (
                <PressableScale
                  key={it.id}
                  activeScale={0.98}
                  onPress={() => { setDetail(null); router.push(`/item/${it.id}`); }}
                  style={styles.sheetRow}
                >
                  <Thumb source={it.local} uri={it.image} style={styles.sheetThumb} radius={10} markSize={16} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName} numberOfLines={1}>{it.name}</Text>
                    <Text style={styles.sheetSub}>{u.nickname}さん・水やり{it.waterCount}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </PressableScale>
              );
            })
          )}
          {((detail === 'direct' && rootChildren.length === 0) ||
            (detail === 'all' && all.length <= 1)) && (
            <Text style={styles.gridEmpty}>まだ水やりされていません。</Text>
          )}
        </ScrollView>
        <PressableScale onPress={() => setDetail(null)} style={styles.sheetClose}>
          <Text style={styles.ghostText}>閉じる</Text>
        </PressableScale>
      </BottomSheetModal>

      {/* 水やり対象（親）を選ぶ */}
      <BottomSheetModal visible={pickWater} onClose={() => setPickWater(false)}>
        <Text style={styles.pickTitle}>水やりする商品を選ぶ</Text>
        <Text style={styles.pickSub}>成長中の商品に水やり＝あなたの商品を子として出品します</Text>
        <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {all.filter((i) => i.status === 'growing').map((it) => {
            const u = users.user(it.ownerId);
            const gate = canWater(it.id);
            return (
              <PressableScale
                key={it.id}
                activeScale={gate.ok ? 0.98 : 1}
                onPress={() => { if (gate.ok) { setPickWater(false); router.push(`/water/${it.id}`); } }}
                style={[styles.pickRow, !gate.ok && styles.pickRowOff]}
              >
                <Thumb source={it.local} uri={it.image} style={styles.pickThumb} radius={10} markSize={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickName} numberOfLines={1}>{it.name}</Text>
                  <View style={styles.pickMeta}>
                    <Avatar uri={u.avatar} name={u.nickname} size={15} />
                    <Text style={styles.pickOwner}>{u.nickname}さん・水やり{it.waterCount}</Text>
                  </View>
                  {!gate.ok && <Text style={styles.pickReason}>{gate.reason}</Text>}
                </View>
                {gate.ok ? (
                  <View style={styles.pickCta}><Ionicons name="water" size={14} color={colors.white} /><Text style={styles.pickCtaText}>水やり</Text></View>
                ) : (
                  <Ionicons name="lock-closed" size={16} color={colors.textPlaceholder} />
                )}
              </PressableScale>
            );
          })}
        </ScrollView>
      </BottomSheetModal>
      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}

function Stat({ num, label, accent, onPress }: { num: number; label: string; accent?: boolean; onPress?: () => void }) {
  return (
    <PressableScale activeScale={onPress ? 0.94 : 1} onPress={onPress} disabled={!onPress} style={styles.stat}>
      <Text style={[styles.statNum, accent && { color: colors.orange }]}>{num}</Text>
      <View style={styles.statLabelRow}>
        <Text style={styles.statLabel}>{label}</Text>
        {onPress && <Ionicons name="chevron-forward" size={11} color={colors.textSecondary} />}
      </View>
    </PressableScale>
  );
}

/**
 * 水やりの一覧（2026-08-12 指摘で作り直し）。
 *
 * もとは分岐を段でインデントして描いていたが、
 * 「何段目」はユーザーにとって意味のない情報だった（連鎖は無限に伸びる）。
 * 大事なのは「この木にどんな物が集まっているか」なので、
 * 段をやめて画像のタイルで並べるだけにした。描画も軽い。
 */
function WaterGrid({ items, highlightId, onOpen }: {
  items: import('@/data/mock').MockItem[];
  highlightId: string | null;
  onOpen: (it: import('@/data/mock').MockItem) => void;
}) {
  const users = useUsers();
  if (!items.length) {
    return <Text style={styles.gridEmpty}>まだ水やりされていません。最初の1つになりませんか？</Text>;
  }
  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const owner = users.user(item.ownerId);
        return (
          <PressableScale
            key={item.id}
            activeScale={0.96}
            onPress={() => onOpen(item)}
            style={[styles.gridCell, item.id === highlightId && styles.gridCellNew]}
          >
            <Thumb source={item.local} uri={item.image} style={styles.gridThumb} radius={10} markSize={18} />
            {item.id === highlightId && (
              <View style={styles.newTag}><Text style={styles.newTagText}>NEW</Text></View>
            )}
            <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.gridMeta}>
              <Avatar uri={owner.avatar} name={owner.nickname} size={13} />
              <Text style={styles.gridOwner} numberOfLines={1}>{owner.nickname}</Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  mineNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.cardMuted, borderRadius: radius.card, padding: spacing.md,
  },
  mineNoteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  doneBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.greenSoft, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.greenSoftBorder },
  doneIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  doneTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.greenDeep },
  doneSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  blockLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  rootCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md },
  rootThumb: { width: 54, height: 54 },
  rootTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rootName: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
  rootMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  rootOwner: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  rootSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, marginTop: 3 },
  canvasCard: { backgroundColor: colors.bgWarm, borderRadius: radius.lg, marginTop: spacing.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: spacing.lg, marginTop: spacing.lg, ...shadows.soft },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  sheetThumb: { width: 44, height: 44 },
  sheetName: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  sheetSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  sheetClose: { alignItems: 'center', paddingVertical: spacing.lg },
  // 水やり一覧（段を出さず画像で並べる：2026-08-12 指摘）
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridCell: { width: '31.5%', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  gridCellNew: { borderWidth: 1.5, borderColor: colors.green },
  gridThumb: { width: '100%', aspectRatio: 1 },
  gridName: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textPrimary },
  gridMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridOwner: { flex: 1, fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary },
  gridEmpty: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, padding: spacing.lg, textAlign: 'center' },
  statNum: { fontFamily: fonts.black, fontSize: 24, color: colors.green },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  statDivider: { width: 1, height: 32, backgroundColor: colors.divider },
  waterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.pill, backgroundColor: colors.waterBlue },
  harvestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.pill, backgroundColor: colors.orangeDeep },
  shareText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 50, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ghostText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  pickTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  pickSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: spacing.md, lineHeight: 18 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  pickRowOff: { opacity: 0.55 },
  pickThumb: { width: 48, height: 48 },
  pickName: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  pickMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  pickOwner: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  pickReason: { fontFamily: fonts.medium, fontSize: 11, color: colors.orangeDeep, marginTop: 3 },
  pickCta: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.waterBlue, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  pickCtaText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  allToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing['2xl'], marginBottom: spacing.md, paddingVertical: spacing.sm },
  allToggleText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  // 子であることを示す短い横棒（親からぶら下がっている見た目をつくる）
  // flexShrink を効かせて、深い階層でも中身が縦積みにならないようにする
  newTag: { backgroundColor: colors.orange, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill },
  newTagText: { fontFamily: fonts.black, fontSize: 8, color: colors.white },
});
