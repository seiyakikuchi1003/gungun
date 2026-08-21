import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: { top?: boolean; bottom?: boolean };
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  background?: string;
};

/** 画面共通ラッパー：セーフエリア＋クリーム背景。 */
export function Screen({
  children,
  scroll = false,
  padded = false,
  edges = { top: true, bottom: false },
  style,
  contentStyle,
  background = colors.bg,
}: Props) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges.top ? insets.top : 0,
    paddingBottom: edges.bottom ? insets.bottom : 0,
  };
  const inner: StyleProp<ViewStyle> = [padded && styles.padded, contentStyle];

  if (scroll) {
    return (
      <View style={[styles.root, { backgroundColor: background }, pad, style]}>
        <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={inner}
        >
          {children}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={[styles.root, { backgroundColor: background }, pad, style]}>
      <View style={[styles.flex, inner]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 背景装飾を画面外に置く画面があるので、ここで切って横スクロールを防ぐ
  root: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  padded: { paddingHorizontal: 20 },
});
