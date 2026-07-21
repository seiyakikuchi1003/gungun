import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Button } from '@/components/ui/Button';
import { NoticeBox } from '@/components/ui/NoticeBox';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Thumb } from '@/components/ui/Thumb';
import { Sprout } from '@/components/art/Sprout';
import { PhotoSourceSheet } from '@/components/feature/PhotoSourceSheet';
import { categories, conditions } from '@/data/mock';

type PickerKey = 'category' | 'condition' | null;

export default function PlantSeedScreen() {
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('ゲーム・おもちゃ');
  const [condition, setCondition] = useState('目立った傷や汚れなし');
  const [picker, setPicker] = useState<PickerKey>(null);
  const [photoSheet, setPhotoSheet] = useState(false);

  return (
    <View style={styles.root}>
      {/* ヘッダー */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.close}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </PressableScale>
        <View style={styles.headerTitle}>
          <Sprout size={22} />
          <Text style={styles.headerText}>タネを植える</Text>
        </View>
        <View style={styles.close} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.body}>
          <NoticeBox text="いらないものを植えると、交換の輪がはじまります" />

          {/* 写真 */}
          <View style={styles.photoSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {photos.map((uri, i) => (
                <View key={uri + i} style={[styles.photo, shadows.soft]}>
                  <Thumb uri={uri} style={styles.photoImg} radius={radius.md} markSize={44} />
                  {i === 0 && (
                    <View style={styles.thumbBadge}>
                      <Text style={styles.thumbBadgeText}>サムネイル</Text>
                    </View>
                  )}
                  <PressableScale
                    onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    style={styles.removeBadge}
                    activeScale={0.85}
                  >
                    <Ionicons name="close" size={14} color={colors.white} />
                  </PressableScale>
                </View>
              ))}
              {photos.length < 10 && (
                <PressableScale onPress={() => setPhotoSheet(true)} activeScale={0.96} style={styles.addPhoto}>
                  <Ionicons name="camera" size={30} color={colors.green} />
                  <Text style={styles.addPhotoText}>＋写真を追加</Text>
                </PressableScale>
              )}
            </ScrollView>
            <Text style={styles.photoHint}>最大10枚・1枚目がサムネイルになります</Text>
          </View>

          {/* 商品名 */}
          <Animated.View entering={FadeInDown.duration(300)} style={[styles.fieldCard, shadows.soft]}>
            <Text style={styles.fieldLabel}>商品名</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="商品名を入力してください"
              placeholderTextColor={colors.textPlaceholder}
              style={styles.input}
            />
          </Animated.View>

          {/* 商品の説明 */}
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={[styles.fieldCard, shadows.soft]}>
            <Text style={styles.fieldLabel}>商品の説明</Text>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="状態や使用期間などを書きましょう"
              placeholderTextColor={colors.textPlaceholder}
              multiline
              style={[styles.input, styles.textarea]}
            />
          </Animated.View>

          {/* カテゴリー / 状態 */}
          <SelectRow label="カテゴリー" value={category} onPress={() => setPicker('category')} />
          <SelectRow label="商品の状態" value={condition} onPress={() => setPicker('condition')} />
        </View>
      </ScrollView>

      {/* 送信ボタン */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          title="タネを植える"
          leftIcon={<Sprout size={22} color={colors.white} />}
          onPress={() => router.back()}
        />
      </View>

      {/* 写真の追加方法（カメラ / ライブラリ） */}
      <PhotoSourceSheet
        visible={photoSheet}
        onClose={() => setPhotoSheet(false)}
        onPicked={(uris) => setPhotos((p) => [...p, ...uris].slice(0, 10))}
      />

      {/* ピッカー */}
      <BottomSheetModal visible={picker !== null} onClose={() => setPicker(null)}>
        <Text style={styles.pickerTitle}>{picker === 'category' ? 'カテゴリー' : '商品の状態'}</Text>
        {(picker === 'category' ? categories : conditions).map((opt) => {
          const selected = picker === 'category' ? category === opt : condition === opt;
          return (
            <PressableScale
              key={opt}
              activeScale={0.98}
              onPress={() => {
                if (picker === 'category') setCategory(opt);
                else setCondition(opt);
                setPicker(null);
              }}
              style={styles.pickerRow}
            >
              <Text style={[styles.pickerText, selected && styles.pickerTextOn]}>{opt}</Text>
              {selected && <Ionicons name="checkmark" size={20} color={colors.green} />}
            </PressableScale>
          );
        })}
      </BottomSheetModal>
    </View>
  );
}

function SelectRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} activeScale={0.98} style={[styles.selectRow, shadows.soft]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.selectRight}>
        <Text style={styles.selectValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.green} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: spacing.md },
  close: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { fontFamily: fonts.bold, fontSize: 19, color: colors.green },
  body: { paddingHorizontal: 20, gap: spacing.lg, paddingTop: spacing.sm },
  photoSection: { gap: spacing.sm },
  photoRow: { gap: spacing.md, paddingVertical: spacing.xs },
  photo: { width: 128, height: 128, borderRadius: radius.md, backgroundColor: colors.cardMuted },
  photoImg: { width: '100%', height: '100%', borderRadius: radius.md },
  thumbBadge: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(46,158,91,0.92)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  thumbBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },
  removeBadge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  addPhoto: {
    width: 128,
    height: 128,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.greenSoftBorder,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.greenSoft,
  },
  addPhotoText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  addPhotoFaded: { opacity: 0.4, backgroundColor: 'transparent' },
  photoHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  fieldCard: { backgroundColor: colors.cardMuted, borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  input: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12 },
  textarea: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardMuted, borderRadius: radius.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  selectRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selectValue: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.divider },
  pickerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickerText: { fontFamily: fonts.medium, fontSize: 15.5, color: colors.textPrimary },
  pickerTextOn: { fontFamily: fonts.bold, color: colors.green },
});
