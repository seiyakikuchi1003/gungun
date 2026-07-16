import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { users } from '@/data/mock';

export default function Blocks() {
  const insets = useSafeAreaInsets();
  const [blocked, setBlocked] = useState(['kenta', 'yu']);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>ブロックリスト</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        {blocked.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.greenSoftBorder} />
            <Text style={styles.emptyText}>ブロック中のユーザーはいません</Text>
          </View>
        ) : (
          blocked.map((id) => {
            const u = users[id];
            return (
              <View key={id} style={[styles.row, shadows.soft]}>
                <Avatar uri={u.avatar} name={u.nickname} size={44} />
                <Text style={styles.name}>{u.nickname}さん</Text>
                <PressableScale onPress={() => setBlocked((b) => b.filter((x) => x !== id))} activeScale={0.94} style={styles.unblock}>
                  <Text style={styles.unblockText}>解除</Text>
                </PressableScale>
              </View>
            );
          })
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.md },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  unblock: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 6 },
  unblockText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  empty: { alignItems: 'center', gap: spacing.md, marginTop: 60 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
});
