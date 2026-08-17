import React, { useState } from 'react';
import { SwipePages } from '@/components/ui/SwipePages';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { TopTabs } from '@/components/ui/TopTabs';
import { Thumb } from '@/components/ui/Thumb';
import { Badge } from '@/components/ui/Badge';
import { ItemActionSheet } from '@/components/feature/ItemActionSheet';
import { type MockItem } from '@/data/mock';
import { useTree } from '@/store/tree';
import { useMe } from '@/store/me';

/** 左右にはらって行き来する順番 */
const TABS = ['seed', 'water'] as const;

export default function MyItems() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('seed');
  const { items } = useTree();
  const [menuItem, setMenuItem] = useState<MockItem | null>(null);
  // 種植え＝自分の root（parentId=null）／水やり＝自分が水やりで出した子（parentId!=null）
  const [q, setQ] = useState('');
  const mine = items.filter((i) => i.ownerId === me.id);
  const base = tab === 'seed' ? mine.filter((i) => i.parentId === null) : mine.filter((i) => i.parentId !== null);
  const key = q.trim();
  const list = key ? base.filter((i) => i.name.includes(key) || i.category.includes(key)) : base;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.dismissTo('/mypage')} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>出品履歴</Text>
        <View style={styles.hBtn} />
      </View>
      <TopTabs tabs={[{ key: 'seed', label: '植えたタネ' }, { key: 'water', label: '水やり' }]} active={tab} onChange={setTab} />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="出品を絞り込む"
          placeholderTextColor={colors.textPlaceholder}
          style={[styles.searchInput, { outlineStyle: 'none' } as object]}
        />
      </View>

      <SwipePages index={Math.max(0, TABS.indexOf(tab as (typeof TABS)[number]))} count={TABS.length} onChange={(i) => setTab(TABS[i])}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {list.map((it) => (
          <PressableScale key={it.id} activeScale={0.98} onPress={() => router.push(`/item/${it.id}`)} style={[styles.card, shadows.soft]}>
            <Thumb source={it.local} uri={it.image} style={styles.thumb} radius={radius.md} markSize={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{it.name}</Text>
              <Text style={styles.category}>{it.category}</Text>
              <View style={styles.metaRow}>
                <Badge label={it.status === 'growing' ? '出品中' : '取引中'} tone={it.status === 'growing' ? 'green' : 'orange'} />
                <Text style={styles.meta}>♡ {it.likeCount}・水やり {it.waterCount}</Text>
              </View>
            </View>
            <PressableScale onPress={() => setMenuItem(it)} activeScale={0.85} hitSlop={8} style={styles.moreBtn}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
            </PressableScale>
          </PressableScale>
        ))}
        {list.length === 0 && (
          <Text style={styles.empty}>
            {tab === 'seed' ? 'まだタネを植えていません' : 'まだ水やりしていません\n欲しい商品に水やりすると、あなたの商品がここに出ます'}
          </Text>
        )}
      </ScrollView>
      </SwipePages>

      {menuItem && (
        <ItemActionSheet
          visible={!!menuItem}
          onClose={() => setMenuItem(null)}
          item={menuItem}
          isOwner
          onReport={() => {}}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  // 一覧は2列。1件ずつの横長より一覧性が高い（2026-08-12 指摘）
  grid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47.5%', backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.sm, gap: spacing.xs },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: 16, marginTop: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 42,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary },
  moreBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  thumb: { width: '100%', aspectRatio: 1 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  category: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  meta: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  empty: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 60 },
});
