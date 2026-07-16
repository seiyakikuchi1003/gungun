import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { PostRow } from '@/components/ui/PostRow';
import { boardPosts } from '@/data/mockSocial';

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>掲示板</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {boardPosts.map((p) => (
          <PostRow key={p.id} post={p} onPress={() => router.push(`/board/${p.id}`)} />
        ))}
      </ScrollView>
      <PressableScale onPress={() => router.push('/board/new')} style={[styles.fab, { bottom: 96 }, shadows.button]}>
        <Ionicons name="create" size={26} color={colors.white} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: spacing.md, alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary },
  post: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: 20, paddingVertical: spacing.lg, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  time: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  body: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 22, color: colors.textPrimary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
});
