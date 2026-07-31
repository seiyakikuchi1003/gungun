import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Share, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { StarRating } from '@/components/ui/StarRating';
import { Sprout } from '@/components/art/Sprout';
import { TreeCanvas } from '@/components/feature/TreeCanvas';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { getUser, treeGrowth } from '@/data/mock';
import { useTree } from '@/store/tree';
import { useMe } from '@/store/me';

export default function TreeScreen() {
  const me = useMe();
  const { rootId, new: newId } = useLocalSearchParams<{ rootId: string; new?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getItem, childrenOf, treeItems, canWater } = useTree();
  const [showAll, setShowAll] = useState(true);
  const [pickWater, setPickWater] = useState(false);

  const root = getItem(rootId ?? '');
  if (!root) return <View style={styles.root} />;

  const owner = getUser(root.ownerId);
  const mine = root.ownerId === me.id;
  const rootChildren = childrenOf(root.id);
  // 木のノード全部（root＋子孫）。順序は付けない（ツリー表示側で親子順に並べる）
  const all = treeItems(root.id);
  const waterings = all.length - 1;
  const branches = rootChildren.length;
  const harvestable = mine && waterings > 0 ? 1 : 0;
  const justWatered = !!newId;
  const cardW = width - 40;
  // 成長段階（木に属する総数で決まる）と、次の段階までの進捗（MAXの概念はない）
  const growth = treeGrowth(all.length);
  const progress = Math.min((all.length - growth.min) / Math.max(1, growth.next - growth.min), 1);

  // ツリーをシェア（OSの共有シート。Webは navigator.share → クリップボードの順にフォールバック）
  const shareTree = async () => {
    const message = `「${root.name}」の木に${waterings}件の水やりが集まっています！ #ぐんぐん`;
    try {
      if (Platform.OS === 'web') {
        const nav = globalThis.navigator as Navigator | undefined;
        if (nav?.share) await nav.share({ text: message });
        else await nav?.clipboard?.writeText(message);
      } else {
        await Share.share({ message });
      }
    } catch {
      // ユーザーがキャンセルした場合など。何もしない
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => (justWatered ? router.replace('/(tabs)') : router.back())} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name={justWatered ? 'close' : 'chevron-back'} size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>木の様子（マイツリー）</Text>
        <PressableScale onPress={() => router.push('/water/about')} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
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
              <StarRating value={4.5} size={12} gap={1} />
              <Text style={styles.rootSub}>(12)</Text>
            </View>
            <Text style={styles.rootSub}>水やり数：{root.waterCount}</Text>
          </View>
        </View>

        {/* 木のイラスト（成長段階で見た目が変わる） */}
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

        {/* 成長メーター */}
        <View style={[styles.growthCard, shadows.soft]}>
          <View style={styles.growthHead}>
            <Text style={styles.growthLabel}>{growth.emoji} {growth.label}</Text>
            <Text style={styles.growthNext}>
              次の目安まであと {Math.max(0, growth.next - all.length)}
            </Text>
          </View>
          <View style={styles.growthTrack}>
            <View style={[styles.growthFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.growthHint}>商品がぶら下がるほど、木はぐんぐん育ちます</Text>
        </View>

        {/* 統計 */}
        <View style={styles.statRow}>
          <Stat num={waterings} label="水やり数" />
          <View style={styles.statDivider} />
          <Stat num={branches} label="枝分かれ" />
          <View style={styles.statDivider} />
          <Stat num={harvestable} label="収穫できる" accent />
        </View>

        {/* アクション */}
        {justWatered ? (
          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <PressableScale onPress={() => setPickWater(true)} activeScale={0.97} style={[styles.waterBtn, shadows.button]}>
              <Ionicons name="water" size={18} color={colors.white} />
              <Text style={styles.shareText}>この木にもっと水やりする</Text>
            </PressableScale>
            <PressableScale onPress={() => router.replace('/(tabs)')} activeScale={0.97} style={styles.ghostBtn}>
              <Text style={styles.ghostText}>ホームに戻る</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <PressableScale onPress={() => setPickWater(true)} activeScale={0.97} style={[styles.waterBtn, shadows.button]}>
              <Ionicons name="water" size={18} color={colors.white} />
              <Text style={styles.shareText}>この木に水やりする</Text>
            </PressableScale>
            <PressableScale onPress={shareTree} activeScale={0.97} style={styles.ghostBtn}>
              <Ionicons name="share-social" size={16} color={colors.textSecondary} />
              <Text style={styles.ghostText}>あなたのツリーをシェア</Text>
            </PressableScale>
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
            <BranchNode
              node={root}
              depth={0}
              highlightId={newId ?? null}
              childrenOf={childrenOf}
              canWater={canWater}
              onOpen={(it) => router.push(`/item/${it.id}`)}
              onWater={(it) => router.push(`/water/${it.id}`)}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* 水やり対象（親）を選ぶ */}
      <BottomSheetModal visible={pickWater} onClose={() => setPickWater(false)}>
        <Text style={styles.pickTitle}>水やりする商品を選ぶ</Text>
        <Text style={styles.pickSub}>成長中の商品に水やり＝あなたの商品を子として出品します</Text>
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {all.filter((i) => i.status === 'growing').map((it) => {
            const u = getUser(it.ownerId);
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
    </View>
  );
}

function Stat({ num, label, accent }: { num: number; label: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statNum, accent && { color: colors.orange }]}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * 水やりの連鎖を「多分岐で崩れない」形で表示する再帰ツリー。
 * 2026-07-28 MTG：一本線ではなく、各ノードに「＋水やり」ボタンを置き、
 * 分岐先にも水やりできる（can_water 不可なら理由を出してボタン無効）。
 * ノードが多い枝は初期折りたたみにして、画面の破綻を防ぐ。
 */
const INITIAL_VISIBLE = 3;
const MAX_INDENT = 5;

type BranchProps = {
  node: import('@/data/mock').MockItem;
  depth: number;
  highlightId: string | null;
  childrenOf: (id: string) => import('@/data/mock').MockItem[];
  canWater: (id: string) => { ok: true } | { ok: false; reason: string };
  onOpen: (it: import('@/data/mock').MockItem) => void;
  onWater: (it: import('@/data/mock').MockItem) => void;
};

function BranchNode({ node, depth, highlightId, childrenOf, canWater, onOpen, onWater }: BranchProps) {
  const kids = childrenOf(node.id);
  const [expanded, setExpanded] = useState(depth < 2 && kids.length <= INITIAL_VISIBLE * 2);
  const shown = expanded ? kids : kids.slice(0, INITIAL_VISIBLE);
  const hidden = kids.length - shown.length;
  const owner = getUser(node.ownerId);
  const isNew = node.id === highlightId;
  const gate = canWater(node.id);
  const indent = Math.min(depth, MAX_INDENT) * 14;

  return (
    <View style={{ marginLeft: indent }}>
      {depth > 0 && <View style={styles.branchLine} />}

      <PressableScale
        activeScale={0.98}
        onPress={() => onOpen(node)}
        style={[styles.branchRow, shadows.soft, isNew && styles.allRowNew]}
      >
        <Thumb source={node.local} uri={node.image} style={styles.branchThumb} radius={10} markSize={16} />
        <View style={{ flex: 1 }}>
          <View style={styles.allTop}>
            <Text style={styles.allName} numberOfLines={1}>{node.name}</Text>
            {isNew && <View style={styles.newTag}><Text style={styles.newTagText}>NEW</Text></View>}
          </View>
          <View style={styles.allMeta}>
            <Avatar uri={owner.avatar} name={owner.nickname} size={14} />
            <Text style={styles.allOwner}>{owner.nickname}さん</Text>
            <Text style={styles.allSub}>水やり{node.waterCount}</Text>
            {kids.length > 0 && <Text style={styles.branchDot}>・枝 {kids.length}</Text>}
          </View>
        </View>
        <Badge
          label={depth === 0 ? '元の種' : `${depth}段目`}
          tone={depth === 0 ? 'green' : 'orange'}
        />
      </PressableScale>

      {/* この枝に「＋水やり」する */}
      <PressableScale
        activeScale={gate.ok ? 0.95 : 1}
        onPress={() => { if (gate.ok) onWater(node); }}
        disabled={!gate.ok}
        style={[styles.plusRow, !gate.ok && styles.plusRowOff]}
      >
        <View style={[styles.plusIcon, !gate.ok && styles.plusIconOff]}>
          <Ionicons name={gate.ok ? 'add' : 'lock-closed'} size={13} color={colors.white} />
        </View>
        <Text style={[styles.plusText, !gate.ok && styles.plusTextOff]} numberOfLines={1}>
          {gate.ok ? 'この枝に水やりする' : gate.reason}
        </Text>
      </PressableScale>

      {shown.map((c) => (
        <BranchNode
          key={c.id}
          node={c}
          depth={depth + 1}
          highlightId={highlightId}
          childrenOf={childrenOf}
          canWater={canWater}
          onOpen={onOpen}
          onWater={onWater}
        />
      ))}

      {hidden > 0 && (
        <PressableScale activeScale={0.97} onPress={() => setExpanded(true)} style={styles.moreBranch}>
          <Ionicons name="chevron-down" size={14} color={colors.green} />
          <Text style={styles.moreBranchText}>この枝の続きを見る（あと {hidden}）</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  growthCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  growthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  growthLabel: { fontFamily: fonts.black, fontSize: 15, color: colors.greenDeep },
  growthNext: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  growthMax: { fontFamily: fonts.bold, fontSize: 12, color: colors.orange },
  growthTrack: { height: 10, borderRadius: 5, backgroundColor: colors.greenSoft, overflow: 'hidden' },
  growthFill: { height: '100%', borderRadius: 5, backgroundColor: colors.green },
  growthHint: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: spacing.lg, marginTop: spacing.lg, ...shadows.soft },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: { fontFamily: fonts.black, fontSize: 24, color: colors.green },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  statDivider: { width: 1, height: 32, backgroundColor: colors.divider },
  waterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.pill, backgroundColor: colors.waterBlue },
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
  allRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md },
  allRowNew: { borderWidth: 1.5, borderColor: colors.orange },
  branchMark: { position: 'absolute', left: -12, top: '50%', width: 12, height: 2, backgroundColor: colors.greenSoftBorder },
  branchLine: { position: 'absolute', left: -8, top: -4, bottom: 0, width: 2, backgroundColor: colors.greenSoftBorder, borderRadius: 1 },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.card, padding: 10, marginTop: 4 },
  branchThumb: { width: 40, height: 40 },
  branchDot: { fontFamily: fonts.medium, fontSize: 11, color: colors.textPlaceholder },
  plusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8, paddingVertical: 4, marginTop: 2, marginBottom: 6 },
  plusRowOff: { opacity: 0.55 },
  plusIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.waterBlue, justifyContent: 'center', alignItems: 'center' },
  plusIconOff: { backgroundColor: colors.textPlaceholder },
  plusText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.waterBlue, flexShrink: 1 },
  plusTextOff: { color: colors.textSecondary },
  moreBranch: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingLeft: 8, marginBottom: 4 },
  moreBranchText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.green },
  chainHint: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginBottom: 3, marginLeft: 2 },
  allThumb: { width: 46, height: 46 },
  allTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  allName: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, flexShrink: 1 },
  newTag: { backgroundColor: colors.orange, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill },
  newTagText: { fontFamily: fonts.black, fontSize: 8, color: colors.white },
  allMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  allOwner: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  allSub: { fontFamily: fonts.medium, fontSize: 11, color: colors.textPlaceholder },
});
