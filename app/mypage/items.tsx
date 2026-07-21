import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { TopTabs } from '@/components/ui/TopTabs';
import { Thumb } from '@/components/ui/Thumb';
import { Badge } from '@/components/ui/Badge';
import { currentUser } from '@/data/mock';
import { useTree } from '@/store/tree';

export default function MyItems() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('seed');
  const { items } = useTree();
  // 種植え＝自分の root（parentId=null）／水やり＝自分が水やりで出した子（parentId!=null）
  const mine = items.filter((i) => i.ownerId === currentUser.id);
  const list = tab === 'seed' ? mine.filter((i) => i.parentId === null) : mine.filter((i) => i.parentId !== null);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>出品履歴</Text>
        <View style={styles.hBtn} />
      </View>
      <TopTabs tabs={[{ key: 'seed', label: '植えたタネ' }, { key: 'water', label: '水やり' }]} active={tab} onChange={setTab} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
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
            <Ionicons name="chevron-forward" size={20} color={colors.textPlaceholder} />
          </PressableScale>
        ))}
        {list.length === 0 && (
          <Text style={styles.empty}>
            {tab === 'seed' ? 'まだタネを植えていません' : 'まだ水やりしていません\n欲しい商品に水やりすると、あなたの商品がここに出ます'}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.md },
  thumb: { width: 64, height: 64 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  category: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  meta: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  empty: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 60 },
});
