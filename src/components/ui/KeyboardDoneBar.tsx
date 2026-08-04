import React from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';

/**
 * 複数行入力のためのキーボード上部バー（iOS だけ）。
 *
 * 複数行では Enter が改行なので、閉じる手段が「画面の余白をタップ」しかなかった。
 * 入力欄に `inputAccessoryViewID={KEYBOARD_DONE_ID}` を付け、画面のどこかに
 * <KeyboardDoneBar /> を1つ置くと「完了」ボタンが出る。
 *
 * Android は端末の戻るキーで閉じられるため、この API 自体が無い（何も描かない）。
 */
export const KEYBOARD_DONE_ID = 'gungun-keyboard-done';

export function KeyboardDoneBar() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View style={styles.bar}>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10} style={styles.btn}>
          <Text style={styles.text}>完了</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.lg,
    height: 44,
  },
  btn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  text: { fontFamily: fonts.bold, fontSize: 16, color: colors.green },
});
