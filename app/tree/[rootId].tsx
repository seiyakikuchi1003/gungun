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
import { shareText } from '@/lib/share';
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
  // いちばん深くつながっている段数（わらしべの鎖の長さ）
  const deepest = all.reduce((mx, i) => Math.max(mx, i.depth), 0);
  const justWatered = !!newId;
  const cardW = width - 40;

  // ツリーをシェア。Web はクリップボードに入るだけで画面が変わらないので短く知らせる
  const shareTree = async () => {
    const res = await shareText(`「${root.name}」の木に${waterings}件の水やりが集まっています！ #ぐんぐん`);
    if (res === 'copied') setToast('リンクをコピーしました');
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

        {/* 統計。3つとも違うことを指すように言い分ける（同じ数字を別名で出さない） */}
        <View style={styles.statRow}>
          <Stat num={waterings} label="集まった商品" />
          <View style={styles.statDivider} />
          <Stat num={branches} label="直接の水やり" />
          <View style={styles.statDivider} />
          <Stat num={deepest} label="いちばん深い段" accent />
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
            <BranchList
              root={root}
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

function Stat({ num, label, accent }: { num: number; label: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statNum, accent && { color: colors.orange }]}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * 水やりの連鎖（2026-07-28 MTG 対応）。
 *
 * めたん様の指摘：連鎖は無制限に伸びるので、全部を一本線で出すと破綻する。
 * → 木は分岐構造として見せつつ、深くなっても画面が崩れないようにする。
 *
 * 実装上いちばん大事な点：**入れ子の View にしない**。
 * 階層ごとに marginLeft を持つ View を入れ子にすると、深さぶんインデントが
 * 加算されて 5〜6 段目でカードが画面外へ出てしまう（実際にそうなっていた）。
 * DFS で 1 次元の配列に潰してから、インデントは Math.min(depth, N) で
 * 頭打ちにした「フラットなリスト」として描く。これなら何段深くなっても
 * 横幅は絶対に溢れない。
 */
const INITIAL_VISIBLE = 3;   // 1つの親に対して最初に見せる子の数
const MAX_INDENT_STEP = 4;   // インデントの頭打ち（これ以上深くても右にずれない）
const INDENT_PX = 12;

type Row = {
  item: import('@/data/mock').MockItem;
  depth: number;
  childCount: number;
  /** この行の下に「あと N 件」の続きがある場合の件数 */
  hiddenSiblings: number;
  /** hiddenSiblings を展開するためのキー（親のID） */
  parentId: string | null;
};

type BranchListProps = {
  root: import('@/data/mock').MockItem;
  highlightId: string | null;
  childrenOf: (id: string) => import('@/data/mock').MockItem[];
  canWater: (id: string) => { ok: true } | { ok: false; reason: string };
  onOpen: (it: import('@/data/mock').MockItem) => void;
  onWater: (it: import('@/data/mock').MockItem) => void;
};

function BranchList({ root, highlightId, childrenOf, canWater, onOpen, onWater }: BranchListProps) {
  const users = useUsers();
  // 「もっと見る」を押した親のIDを覚えておく
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // DFS でフラット化する。循環があっても止まるよう visited を持つ。
  const rows: Row[] = [];
  const visited = new Set<string>();

  const walk = (node: import('@/data/mock').MockItem, depth: number, hiddenSiblings: number, parentId: string | null) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    const kids = childrenOf(node.id);
    rows.push({ item: node, depth, childCount: kids.length, hiddenSiblings, parentId });

    const showAllKids = expanded.has(node.id) || kids.length <= INITIAL_VISIBLE;
    const shown = showAllKids ? kids : kids.slice(0, INITIAL_VISIBLE);
    const hidden = kids.length - shown.length;

    shown.forEach((k, i) => {
      // 最後に出す子にだけ「あと N 件」を持たせる
      walk(k, depth + 1, i === shown.length - 1 ? hidden : 0, node.id);
    });
  };

  walk(root, 0, 0, null);

  return (
    <View style={{ gap: 2 }}>
      {rows.map(({ item, depth, childCount, hiddenSiblings, parentId }) => {
        const owner = users.user(item.ownerId);
        const isNew = item.id === highlightId;
        const gate = canWater(item.id);
        const indent = Math.min(depth, MAX_INDENT_STEP) * INDENT_PX;
        // 頭打ちを超えた深さは「⋯」で表す（右にずらさずに深さを示す）
        const overflowDepth = depth > MAX_INDENT_STEP;

        return (
          <View key={item.id} style={{ marginLeft: indent }}>
            <PressableScale
              activeScale={0.98}
              onPress={() => onOpen(item)}
              style={[styles.branchRow, shadows.soft, isNew && styles.allRowNew]}
            >
              {depth > 0 && <View style={styles.branchTick} />}
              <Thumb source={item.local} uri={item.image} style={styles.branchThumb} radius={10} markSize={16} />

              <View style={styles.branchBody}>
                <View style={styles.allTop}>
                  <Text style={styles.allName} numberOfLines={1}>{item.name}</Text>
                  {isNew && <View style={styles.newTag}><Text style={styles.newTagText}>NEW</Text></View>}
                </View>
                <View style={styles.allMeta}>
                  <Avatar uri={owner.avatar} name={owner.nickname} size={14} />
                  <Text style={styles.allOwner} numberOfLines={1}>{owner.nickname}さん</Text>
                  <Text style={styles.allSub}>水やり{item.waterCount}</Text>
                  {childCount > 0 && <Text style={styles.branchDot}>枝{childCount}</Text>}
                </View>
              </View>

              <Badge
                label={depth === 0 ? '元の種' : `${overflowDepth ? '⋯' : ''}${depth}段`}
                tone={depth === 0 ? 'green' : 'orange'}
              />
            </PressableScale>

            {/* この枝に「＋水やり」する（分岐先にも水やりできる） */}
            <PressableScale
              activeScale={gate.ok ? 0.95 : 1}
              onPress={() => { if (gate.ok) onWater(item); }}
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

            {hiddenSiblings > 0 && parentId && (
              <PressableScale
                activeScale={0.97}
                onPress={() => setExpanded((s) => new Set(s).add(parentId))}
                style={styles.moreBranch}
              >
                <Ionicons name="chevron-down" size={14} color={colors.green} />
                <Text style={styles.moreBranchText}>この枝の続きを見る（あと {hiddenSiblings}）</Text>
              </PressableScale>
            )}
          </View>
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
  allRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md },
  allRowNew: { borderWidth: 1.5, borderColor: colors.orange },
  branchMark: { position: 'absolute', left: -12, top: '50%', width: 12, height: 2, backgroundColor: colors.greenSoftBorder },
  branchLine: { position: 'absolute', left: -8, top: -4, bottom: 0, width: 2, backgroundColor: colors.greenSoftBorder, borderRadius: 1 },
  // 子であることを示す短い横棒（親からぶら下がっている見た目をつくる）
  branchTick: { position: 'absolute', left: -8, top: '50%', width: 8, height: 2, backgroundColor: colors.greenSoftBorder },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.card, padding: 10, marginTop: 4 },
  // flexShrink を効かせて、深い階層でも中身が縦積みにならないようにする
  branchBody: { flex: 1, minWidth: 0 },
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
  allOwner: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, flexShrink: 1 },
  allSub: { fontFamily: fonts.medium, fontSize: 11, color: colors.textPlaceholder },
});
