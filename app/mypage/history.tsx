import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, useWindowDimensions, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { ItemCard } from '@/components/ui/ItemCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMe } from '@/store/me';
import { isSupabaseEnabled } from '@/lib/supabase';
import { clearViewHistory, fetchViewHistory } from '@/lib/api/social';
import type { MockItem } from '@/data/mock';

/**
 * 最近見た商品（マイページ →「閲覧履歴」）。
 *
 * 一度見た商品にあとから戻れる導線が無かったため追加。
 * 記録は商品詳細を開いたときに DB 側の touch_item_view() が行う（直近100件）。
 * プライバシーのため、まとめて消せるようにしてある。
 */
export default function History() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [items, setItems] = useState<MockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { width: winW } = useWindowDimensions();
  // 2列に並べるためのカード幅。
  // 外側の余白（14×2）に加えて、各セルの左右余白（6×2 が2枚ぶん）も引く。
  // これを引き忘れていたため合計が画面幅を超え、2枚目が折り返して
  // 1列に見えていた（2026-08-17 指摘）
  const cardW = Math.floor((winW - 14 * 2 - 6 * 4) / 2);

  const load = useCallback(async () => {
    if (!isSupabaseEnabled || !me.live) { setLoading(false); return; }
    try {
      setItems(await fetchViewHistory(me.id));
    } catch {
      // 取れなくても画面は出す
    } finally {
      setLoading(false);
    }
  }, [me.id, me.live]);

  useEffect(() => { load(); }, [load]);

  const onClear = () => {
    Alert.alert('閲覧履歴を消す', 'これまでに見た商品の記録をすべて消します。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: '消す',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearViewHistory(me.id);
            setItems([]);
          } catch {
            Alert.alert('消せませんでした', '通信状況を確かめてもう一度お試しください。');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.dismissTo('/mypage')} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>閲覧履歴</Text>
        {items.length ? (
          <PressableScale onPress={onClear} activeScale={0.92} style={styles.clearBtn}>
            <Text style={styles.clearText}>消す</Text>
          </PressableScale>
        ) : (
          <View style={styles.hBtn} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
      ) : (
        <ScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor={colors.green}
            />
          }
        >
          {items.length ? (
            items.map((it) => (
              <View key={it.id} style={styles.cell}>
                <ItemCard item={it} width={cardW} onPress={() => router.push(`/item/${it.id}`)} />
              </View>
            ))
          ) : (
            <EmptyState
              icon="time-outline"
              title="まだ見た商品がありません"
              note="商品を開くと、ここに履歴が残ります。"
              actionLabel="森を見にいく"
              onAction={() => router.push('/(tabs)')}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 44, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  clearBtn: { width: 44, height: 40, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 8 },
  clearText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  center: { paddingTop: 60, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingTop: spacing.md, paddingBottom: 40 },
  cell: { paddingHorizontal: 6, marginBottom: spacing.md },
});
