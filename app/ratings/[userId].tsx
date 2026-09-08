import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useUsers } from '@/store/users';
import { isSupabaseEnabled } from '@/lib/supabase';
import { fetchRatings, type RatingCard } from '@/lib/api/profile';
import { lh } from '@/lib/fontScale';

const TYPE_LABEL: Record<string, string> = {
  communication: '送った側として',
  quality: '受け取った側として',
};

/** 星を score ぶん塗る */
function Stars({ score, size = 14 }: { score: number; size?: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= score ? 'star' : 'star-outline'}
          size={size}
          color={n <= score ? colors.orangeDeep : colors.textPlaceholder}
        />
      ))}
    </View>
  );
}

/**
 * 評価一覧。
 *
 * プロフィールには星の平均しか出ていなかったので、内訳（5〜1の分布）と
 * 一件ずつのコメントを見られるようにした。取引相手を選ぶときの判断材料になる。
 */
export default function Ratings() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const users = useUsers();
  const target = users.user(userId);
  const [list, setList] = useState<RatingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseEnabled || !userId) { setLoading(false); return; }
    try {
      setList(await fetchRatings(userId));
    } catch {
      // 取れなくても画面は出す
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    if (!list.length) return null;
    const total = list.reduce((s, r) => s + r.score, 0);
    const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: list.filter((r) => r.score === n).length }));
    return { avg: Math.round((total / list.length) * 10) / 10, count: list.length, dist };
  }, [list]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>評価</Text>
        <View style={styles.hBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
      ) : (
        <ScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor={colors.green}
            />
          }
        >
          {summary ? (
            <View style={[styles.summary, shadows.soft]}>
              <View style={styles.summaryLeft}>
                <Text style={styles.avg}>{summary.avg}</Text>
                <Stars score={Math.round(summary.avg)} size={13} />
                <Text style={styles.count}>{summary.count}件</Text>
              </View>
              <View style={styles.dist}>
                {summary.dist.map((d) => (
                  <View key={d.n} style={styles.distRow}>
                    <Text style={styles.distNum}>{d.n}</Text>
                    <Ionicons name="star" size={10} color={colors.orangeDeep} />
                    <View style={styles.bar}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${summary.count ? (d.count / summary.count) * 100 : 0}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.distCount}>{d.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {list.length ? (
            list.map((r) => (
              <View key={r.id} style={[styles.card, shadows.soft]}>
                <View style={styles.cardHead}>
                  <Avatar uri={r.raterAvatar} name={r.raterName} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{r.raterName}</Text>
                    <Text style={styles.meta}>{TYPE_LABEL[r.type] ?? ''}・{r.createdAt}</Text>
                  </View>
                  <Stars score={r.score} />
                </View>
                {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
              </View>
            ))
          ) : (
            <EmptyState
              icon="star-outline"
              title="まだ評価がありません"
              note={`${target.nickname || 'この人'}が取引を終えると、ここに評価が並びます。`}
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
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  center: { paddingTop: 60, alignItems: 'center' },

  summary: { flexDirection: 'row', gap: spacing.xl, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.lg },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  avg: { fontFamily: fonts.bold, fontSize: 34, color: colors.textPrimary, lineHeight: lh(38) },
  count: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  stars: { flexDirection: 'row', gap: 1 },
  dist: { flex: 1, justifyContent: 'center', gap: 4 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distNum: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, width: 10, textAlign: 'right' },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.cardMuted, overflow: 'hidden', marginLeft: 2 },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.orangeDeep },
  distCount: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, width: 20 },

  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  comment: { fontFamily: fonts.regular, fontSize: 14, lineHeight: lh(21), color: colors.textPrimary, marginTop: spacing.md },
});
