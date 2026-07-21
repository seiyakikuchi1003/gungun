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
import { getItem, getUser, items, currentUser, MockItem } from '@/data/mock';
import { success } from '@/lib/haptics';

/** デモ用：候補までの一本道の人数（根の自分＋途中の人数）。深さをそれらしく散らす */
function ringSizeOf(index: number): number {
  return 2 + (index % 3); // 2〜4人の輪
}

/** デモ用：輪に入るユーザー列（自分 → 途中の人たち → 最後は自分に戻る） */
function ringUsersOf(target: MockItem, size: number) {
  const others = ['takusan', 'sakura', 'yu', 'haru', 'kenta']
    .filter((id) => id !== target.ownerId);
  const mid = [target.ownerId, ...others].slice(0, size - 1);
  return [currentUser, ...mid.map((id) => getUser(id))];
}

export default function HarvestDetail() {
  const { rootId } = useLocalSearchParams<{ rootId: string }>();
  const insets = useSafeAreaInsets();
  const seed = getItem(rootId ?? '');
  const [target, setTarget] = useState<MockItem | null>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [done, setDone] = useState(false);

  if (!seed) return <View style={styles.root} />;
  // 集まった商品（デモ：seed 以外から数点）
  const gathered = items.filter((i) => i.id !== seed.id).slice(0, 5);
  const ringSize = ringSizeOf(targetIndex);
  const ringUsers = target ? ringUsersOf(target, ringSize) : [];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle} numberOfLines={1}>{seed.name}</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={[styles.seedCard, shadows.soft]}>
          <Thumb source={seed.local} uri={seed.image} style={styles.seedThumb} radius={radius.md} markSize={30} />
          <View style={{ flex: 1 }}>
            <Text style={styles.seedName}>{seed.name}</Text>
            <Text style={styles.seedSub}>あなたのタネ・木全体 {seed.treeCount}件</Text>
          </View>
        </View>

        <View style={styles.gatherHead}>
          <Sprout size={18} />
          <Text style={styles.gatherTitle}>集まった商品（{gathered.length}）</Text>
        </View>
        <Text style={styles.hint}>収穫すると、選んだ商品までの一本道の全員が輪になって交換します</Text>

        {gathered.map((g, i) => {
          const u = getUser(g.ownerId);
          return (
            <View key={g.id} style={[styles.gCard, shadows.soft]}>
              <Thumb source={g.local} uri={g.image} style={styles.gThumb} radius={radius.md} markSize={26} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gName} numberOfLines={1}>{g.name}</Text>
                <View style={styles.gMeta}>
                  <Text style={styles.gOwner}>{u.nickname}さん</Text>
                  <View style={styles.ringChip}>
                    <Ionicons name="sync" size={11} color={colors.green} />
                    <Text style={styles.ringChipText}>{ringSizeOf(i)}人の輪</Text>
                  </View>
                </View>
              </View>
              <PressableScale onPress={() => { setTarget(g); setTargetIndex(i); }} activeScale={0.94} style={styles.harvestBtn}>
                <Text style={styles.harvestText}>収穫する</Text>
              </PressableScale>
            </View>
          );
        })}
      </ScrollView>

      {/* 収穫確認 */}
      <BottomSheetModal visible={!!target && !done} onClose={() => setTarget(null)}>
        <View style={styles.confirmCenter}>
          <Mikan size={96} />
          <Text style={styles.confirmTitle}>この商品を収穫しますか？</Text>
          <Text style={styles.confirmSub}>{target?.name} まで、一本道の全員で交換します</Text>
        </View>

        {/* 交換の輪プレビュー：あなた → … → あなた */}
        <View style={styles.ringBox}>
          <Text style={styles.ringTitle}>{ringUsers.length}人の輪ができます</Text>
          <View style={styles.ringRow}>
            {ringUsers.map((u, i) => (
              <React.Fragment key={`${u.id}-${i}`}>
                <View style={styles.ringUser}>
                  <Avatar uri={u.avatar} name={u.nickname} size={40} />
                  <Text style={styles.ringName} numberOfLines={1}>
                    {u.id === currentUser.id ? 'あなた' : u.nickname}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color={colors.greenSoftBorder} style={styles.ringArrow} />
              </React.Fragment>
            ))}
            <View style={styles.ringUser}>
              <Avatar uri={currentUser.avatar} name={currentUser.nickname} size={40} />
              <Text style={styles.ringName}>あなた</Text>
            </View>
          </View>
          <Text style={styles.ringNote}>それぞれ1回送って、1回受け取ります</Text>
        </View>

        <View style={styles.noteBox}>
          <Ionicons name="alert-circle" size={18} color={colors.orangeDeep} />
          <Text style={styles.noteText}>収穫すると取り消せません。輪の全員に発送義務が発生します。</Text>
        </View>
        <Button title="収穫する（交換開始）" variant="accent" onPress={() => { success(); setDone(true); }} style={{ marginTop: spacing.xl }} />
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
        <Button title="取引画面へ" onPress={() => { setDone(false); setTarget(null); router.replace('/exchange'); }} style={{ marginTop: spacing.xl }} />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  gCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.md },
  gThumb: { width: 56, height: 56 },
  gName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  gMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  gOwner: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  ringChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.greenSoft, paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: radius.pill },
  ringChipText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.green },
  ringBox: { backgroundColor: colors.greenSoft, borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.lg, alignItems: 'center' },
  ringTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.greenDeep, marginBottom: spacing.md },
  ringRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  ringUser: { alignItems: 'center', gap: 4, width: 54 },
  ringName: { fontFamily: fonts.medium, fontSize: 10, color: colors.textPrimary },
  ringArrow: { marginTop: 13 },
  ringNote: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginTop: spacing.md },
  harvestBtn: { backgroundColor: colors.orange, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill },
  harvestText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  confirmCenter: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  confirmTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, marginTop: spacing.sm },
  confirmSub: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: spacing.lg },
  noteBox: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.orangeSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.orangeDeep, lineHeight: 19 },
  cancel: { alignItems: 'center', paddingVertical: spacing.lg },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
});
