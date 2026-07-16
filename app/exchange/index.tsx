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
import { trades, tradeItem, tradeUser, Trade } from '@/data/mockSocial';

function statusLabel(t: Trade): { label: string; tone: 'green' | 'orange' | 'gray' } {
  if (t.dir === 'receive') {
    return t.status === 'received'
      ? { label: '受け取り済み', tone: 'gray' }
      : t.status === 'shipped'
      ? { label: '発送されました', tone: 'green' }
      : { label: '相手の発送待ち', tone: 'gray' };
  }
  return t.status === 'shipped' ? { label: '発送済み', tone: 'orange' } : { label: '未発送', tone: 'gray' };
}

export default function ExchangeScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'receive' | 'send'>('receive');
  const list = trades.filter((t) => t.dir === tab);
  const accent = tab === 'receive' ? colors.green : colors.orange;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>取引</Text>
        <View style={styles.hBtn} />
      </View>

      <TopTabs
        tabs={[
          { key: 'receive', label: '受け取る', color: colors.green },
          { key: 'send', label: '送る', color: colors.orange },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'receive' | 'send')}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        <View style={[styles.banner, { backgroundColor: tab === 'receive' ? colors.greenSoft : colors.orangeSoft }]}>
          <Ionicons name={tab === 'receive' ? 'download' : 'send'} size={18} color={accent} />
          <Text style={[styles.bannerText, { color: accent }]}>
            {tab === 'receive' ? '相手が発送したら受け取り報告をしましょう' : '発送したら「発送完了報告」をしましょう'}
          </Text>
        </View>

        {list.map((t) => {
          const it = tradeItem(t);
          const u = tradeUser(t);
          const s = statusLabel(t);
          if (!it) return null;
          return (
            <PressableScale key={t.id} activeScale={0.98} onPress={() => router.push(`/exchange/${t.id}`)} style={[styles.card, shadows.soft, { borderLeftColor: accent }]}>
              <Thumb source={it.local} uri={it.image} style={styles.thumb} radius={radius.md} markSize={26} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{it.name}</Text>
                <Text style={styles.owner}>{tab === 'receive' ? `${u.nickname}さんから受け取る` : `${u.nickname}さんへ送る`}</Text>
                <View style={styles.badgeRow}>
                  <Badge label={s.label} tone={s.tone} />
                  {t.shippedAt && <Text style={styles.date}>発送日 {t.shippedAt}</Text>}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textPlaceholder} />
            </PressableScale>
          );
        })}
        {list.length === 0 && <Text style={styles.empty}>進行中の取引はありません</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  bannerText: { fontFamily: fonts.medium, fontSize: 13, flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 4 },
  thumb: { width: 60, height: 60 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  owner: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  date: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
