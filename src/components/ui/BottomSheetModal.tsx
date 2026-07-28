import React from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, Easing } from 'react-native-reanimated';
import { colors, radius, spacing, shadows } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * モーダルが実際に閉じ切ったあとに呼ばれる（iOS）。
   * カメラや写真ライブラリは「モーダルが残っている間は開けない」ため、
   * 閉じてから起動したい処理をここで実行する。
   */
  onDismissed?: () => void;
  children: React.ReactNode;
};

/** 下から出る白い角丸モーダル（背景は薄暗く）。 */
export function BottomSheetModal({ visible, onClose, onDismissed, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onDismissed}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
          <Pressable style={styles.backdrop} onPress={onClose} />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(180)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }, shadows.sheet]}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
});
