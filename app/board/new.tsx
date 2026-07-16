import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { currentUser } from '@/data/mock';

const MAX = 280;

export default function NewPost() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const can = text.trim().length > 0;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9}>
          <Text style={styles.cancel}>キャンセル</Text>
        </PressableScale>
        <Text style={styles.title}>新規投稿</Text>
        <PressableScale onPress={() => can && router.back()} activeScale={0.94} style={[styles.post, !can && styles.postOff]}>
          <Text style={styles.postText}>投稿</Text>
        </PressableScale>
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          <Avatar uri={currentUser.avatar} name={currentUser.nickname} size={44} />
          <TextInput
            autoFocus
            multiline
            value={text}
            onChangeText={(t) => t.length <= MAX && setText(t)}
            placeholder="いまどうしてる？交換の様子や欲しいものをシェアしよう🌱"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
          />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <PressableScale activeScale={0.9} style={styles.tool}>
          <Ionicons name="image-outline" size={24} color={colors.green} />
        </PressableScale>
        <Text style={[styles.count, text.length > MAX - 30 && { color: colors.orangeDeep }]}>{MAX - text.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  cancel: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  post: { backgroundColor: colors.green, paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.pill },
  postOff: { opacity: 0.4 },
  postText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  body: { flex: 1, padding: 20 },
  row: { flexDirection: 'row', gap: spacing.md },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.textPrimary, minHeight: 120, textAlignVertical: 'top', paddingTop: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  tool: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  count: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
