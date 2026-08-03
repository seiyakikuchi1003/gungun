import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, Share, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { Thumb } from '@/components/ui/Thumb';
import { HeartButton } from '@/components/ui/HeartButton';
import { StarRating } from '@/components/ui/StarRating';
import { Sprout } from '@/components/art/Sprout';
import { ItemActionSheet } from '@/components/feature/ItemActionSheet';
import { ReportSheet } from '@/components/feature/ReportSheet';
import { getUser, itemImageSources } from '@/data/mock';
import { settings } from '@/config/settings';
import { useTree } from '@/store/tree';
import { useMe } from '@/store/me';
import { useItemComments } from '@/hooks/useItemComments';

function RoundBtn({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} activeScale={0.9} style={[styles.roundBtn, shadows.soft]}>
      <Ionicons name={icon} size={20} color={colors.textPrimary} />
    </PressableScale>
  );
}

export default function ItemDetailScreen() {
  const me = useMe();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getItem, canWater, childrenOf, treeItems } = useTree();
  const item = getItem(id ?? '');
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [ctext, setCtext] = useState('');
  const { comments, add: addComment, remove: removeComment } = useItemComments(id ?? '');

  if (!item) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>商品が見つかりません</Text>
      </View>
    );
  }
  const owner = getUser(item.ownerId);
  const imgs = itemImageSources(item);
  const connected = childrenOf(item.id); // この商品に水やりした商品（＝子ノード）
  const treeThumbs = treeItems(item.rootId).filter((i) => i.id !== item.id);
  const gate = canWater(item.id);
  // すでにこの商品へ水やり済みか（自分の商品が子にいる）
  const alreadyWatered = connected.some((c) => c.ownerId === me.id);
  const isOwner = item.ownerId === me.id;
  const imgH = width * 0.94;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const share = async () => {
    const message = `「${item.name}」を見つけました！ #ぐんぐん`;
    try {
      if (Platform.OS === 'web') {
        const nav = globalThis.navigator as Navigator | undefined;
        if (nav?.share) await nav.share({ text: message });
        else await nav?.clipboard?.writeText(message);
      } else {
        await Share.share({ message });
      }
    } catch {
      /* キャンセル時など無視 */
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* 画像カルーセル（全面）＋画像上のヘッダー（スクロールで一緒に流れる） */}
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
            {imgs.map((src, i) => (
              <Thumb key={i} source={src} style={{ width, height: imgH }} markSize={100} />
            ))}
          </ScrollView>
          {imgs.length > 1 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>{page + 1} / {imgs.length}</Text>
            </View>
          )}
          <View style={[styles.floatHeader, { top: insets.top + 6 }]} pointerEvents="box-none">
            <RoundBtn icon="chevron-back" onPress={() => router.back()} />
            <View style={styles.floatRight}>
              <RoundBtn icon="share-social-outline" onPress={share} />
              <RoundBtn icon="ellipsis-horizontal" onPress={() => setMenu(true)} />
            </View>
          </View>
        </View>

        {/* コンテンツシート（画像に少し被せる） */}
        <View style={styles.sheet}>
          {/* タイトル＋お気に入り */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.name}</Text>
              <View style={styles.metaRow}>
                <View style={styles.catChip}><Text style={styles.catText}>{item.category}</Text></View>
                <View style={styles.condChip}><Ionicons name="pricetag" size={11} color={colors.textSecondary} /><Text style={styles.condText}>{item.condition}</Text></View>
              </View>
            </View>
            <View style={styles.favBox}>
              <HeartButton count={item.likeCount} initial={false} size={26} id={`item:${item.id}`} />
            </View>
          </View>

          {/* 出品者 */}
          <PressableScale activeScale={0.98} onPress={() => router.push(`/user/${owner.id}`)} style={[styles.sellerCard, shadows.soft]}>
            <Avatar uri={owner.avatar} name={owner.nickname} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>{owner.nickname}さん</Text>
              <View style={styles.sellerRating}>
                <StarRating value={4.5} size={13} gap={2} />
                <Text style={styles.sellerStat}>評価 {owner.ratingCount}・出品 {owner.itemCount}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textPlaceholder} />
          </PressableScale>

          {/* つながっている木（マイツリーへ） */}
          <PressableScale activeScale={0.98} onPress={() => router.push(`/tree/${item.rootId}`)} style={[styles.rootCard, shadows.soft]}>
            <View style={styles.rootTop}>
              <View style={styles.rootBadge}><Sprout size={15} color={colors.white} /></View>
              <Text style={styles.rootLabel}>{item.parentId === null ? '元の種（つながっている木）' : 'この商品が属する木'}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.green} />
            </View>
            <View style={styles.treeRow}>
              <View style={styles.treeThumbs}>
                {treeThumbs.slice(0, 3).map((c, i) => (
                  <Thumb key={c.id} source={c.local} uri={c.image} style={[styles.treeThumb, { marginLeft: i === 0 ? 0 : -14 }]} radius={10} markSize={18} />
                ))}
                {treeThumbs.length > 3 && (
                  <View style={[styles.treeMore, { marginLeft: -14 }]}>
                    <Text style={styles.treeMoreText}>+{treeThumbs.length - 3}</Text>
                  </View>
                )}
              </View>
              {/* サムネと同じ「この商品以外でつながっている数」を出す */}
              <View style={styles.treeCountBox}>
                <Text style={styles.treeCount}>{treeThumbs.length}</Text>
                <Text style={styles.treeCountUnit}>件</Text>
              </View>
            </View>
          </PressableScale>

          {/* 説明 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>商品の説明</Text>
            <Text style={styles.descText}>{item.description}</Text>
          </View>

          {/* コメント */}
          <View style={styles.section}>
            <View style={styles.commentHead}>
              <Text style={styles.sectionTitle}>コメント</Text>
              <Text style={styles.commentCount}>{comments.length}件</Text>
            </View>
            {comments.map((c) => {
              const fromOwner = c.userId === owner.id;
              const isMine = c.userId === me.id;
              return (
                <View key={c.id} style={styles.comment}>
                  <Avatar uri={c.authorAvatar} name={c.authorName} size={34} />
                  <View style={[styles.bubble, fromOwner && styles.bubbleOwner]}>
                    <View style={styles.cHead}>
                      <Text style={styles.cName}>{c.authorName}{fromOwner ? '（出品者）' : ''}</Text>
                      <Text style={styles.cTime}>{c.createdAt}</Text>
                      {isMine && (
                        <PressableScale
                          onPress={() => removeComment(c.id)}
                          activeScale={0.8}
                          hitSlop={8}
                          style={styles.cDelete}
                        >
                          <Ionicons name="close" size={14} color={colors.textPlaceholder} />
                        </PressableScale>
                      )}
                    </View>
                    <Text style={styles.cBody}>{c.body}</Text>
                  </View>
                </View>
              );
            })}
            {comments.length === 0 && <Text style={styles.commentEmpty}>最初のコメントを書いてみましょう</Text>}
            <View style={styles.commentInputRow}>
              <TextInput
                value={ctext}
                onChangeText={setCtext}
                placeholder="コメントを書く…"
                placeholderTextColor={colors.textPlaceholder}
                style={[styles.commentField, { outlineStyle: 'none' } as object]}
              />
              <PressableScale
                onPress={() => {
                  if (!ctext.trim()) return;
                  addComment(ctext);
                  setCtext('');
                }}
                activeScale={0.9}
                style={[styles.commentSend, !ctext.trim() && styles.commentSendOff]}
              >
                <Ionicons name="arrow-up" size={18} color={colors.white} />
              </PressableScale>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 下部：水やりCTA（＝自分の商品を出品して子ノードに） */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {isOwner ? (
          <View style={styles.ownerRow}>
            <PressableScale onPress={() => router.push(`/item/edit/${item.id}`)} activeScale={0.97} style={[styles.editBtn, shadows.button]}>
              <Ionicons name="create-outline" size={19} color={colors.white} />
              <Text style={styles.editText}>編集する</Text>
            </PressableScale>
            <PressableScale onPress={() => router.push(`/tree/${item.rootId}`)} activeScale={0.97} style={styles.treeBtn}>
              <Sprout size={18} />
              <Text style={styles.treeBtnText}>木を見る</Text>
            </PressableScale>
          </View>
        ) : alreadyWatered ? (
          <PressableScale onPress={() => router.push(`/tree/${item.rootId}`)} activeScale={0.98} style={styles.wateredPill}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <Text style={styles.wateredText}>水やり済み — 木の様子を見る</Text>
          </PressableScale>
        ) : gate.ok ? (
          <PressableScale onPress={() => router.push(`/water/${item.id}`)} style={[styles.waterBtn, shadows.button]}>
            <Ionicons name="water" size={20} color={colors.white} />
            <Text style={styles.waterText}>この商品に水やりする</Text>
            <View style={styles.waterCost}><Text style={styles.waterCostText}>{settings.waterCost}肥料</Text></View>
          </PressableScale>
        ) : (
          <View style={styles.disabledBox}>
            <Ionicons name="information-circle" size={18} color={colors.textSecondary} />
            <Text style={styles.disabledText}>{gate.reason}</Text>
          </View>
        )}
      </View>

      {/* …メニュー（編集/削除 または 通報/ブロック） */}
      <ItemActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        item={item}
        isOwner={isOwner}
        onReport={() => setReport(true)}
        onDeleted={() => router.back()}
      />
      <ReportSheet visible={report} onClose={() => setReport(false)} targetLabel="この出品" targetType="item" targetId={item.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  notFoundText: { fontFamily: fonts.medium, color: colors.textSecondary },
  floatHeader: { position: 'absolute', left: 12, right: 12, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  floatRight: { flexDirection: 'row', gap: spacing.sm },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center' },
  counter: { position: 'absolute', right: 16, bottom: 34, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  counterText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -24, paddingHorizontal: 20, paddingTop: spacing.xl, gap: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontFamily: fonts.bold, fontSize: 23, color: colors.textPrimary, lineHeight: 30 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  catChip: { backgroundColor: colors.greenSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  catText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.green },
  condChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.cardMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  condText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  favBox: { paddingLeft: spacing.md, paddingTop: 2 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg },
  sellerName: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  sellerRating: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  sellerStat: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  rootCard: { backgroundColor: colors.greenSoft, borderRadius: radius.card, padding: spacing.lg, gap: spacing.md },
  rootTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rootBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  rootLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.green, flex: 1 },
  treeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  treeThumbs: { flexDirection: 'row', alignItems: 'center' },
  treeThumb: { width: 44, height: 44, borderWidth: 2, borderColor: colors.greenSoft },
  treeMore: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.green, borderWidth: 2, borderColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },
  treeMoreText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  treeCountBox: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  treeCount: { fontFamily: fonts.black, fontSize: 26, color: colors.green },
  treeCountUnit: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  descText: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 24, color: colors.textPrimary },
  commentHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  commentCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  comment: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  bubble: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: spacing.md, ...shadows.soft },
  bubbleOwner: { backgroundColor: colors.greenSoft },
  cHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cName: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary },
  cTime: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  cBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textPrimary, marginTop: 3 },
  commentEmpty: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.md },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  commentField: { flex: 1, minWidth: 0, backgroundColor: colors.cardMuted, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary },
  commentSend: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  commentSendOff: { backgroundColor: colors.textPlaceholder, opacity: 0.5 },
  cDelete: { marginLeft: 'auto', padding: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: spacing.md, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.divider, ...shadows.sheet },
  waterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.waterBlue },
  ownerRow: { flexDirection: 'row', gap: spacing.md },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.green },
  editText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  treeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 56, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.greenSoftBorder },
  treeBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  waterText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  waterCost: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  waterCostText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  wateredPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.greenSoft },
  wateredText: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
  disabledBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.cardMuted, paddingHorizontal: spacing.lg },
  disabledText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center' },
});
