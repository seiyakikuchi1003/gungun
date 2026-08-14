import React, { useEffect, useRef, useState } from 'react';
import { playSfx } from '@/lib/sound';
import { useMe } from '@/store/me';
import { PremiumNudge } from '@/components/feature/PremiumNudge';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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

import { FormError } from '@/components/ui/FormError';
import { categories, conditions } from '@/data/mock';
import { success } from '@/lib/haptics';
import { useTree } from '@/store/tree';
import { KeyboardDoneBar, KEYBOARD_DONE_ID } from '@/components/ui/KeyboardDoneBar';
import { OptionPicker } from '@/components/ui/OptionPicker';

type PickerKey = 'category' | 'condition' | null;

export default function PlantSeedScreen() {
  const insets = useSafeAreaInsets();
  const { plantSeed } = useTree();
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  // 初期値を入れると「選んだつもりがない物」で出品されてしまうので未選択から始める
  const [category, setCategory] = useState('');
  // 初期値を入れると、選んだつもりのない状態で出品されてしまう（2026-08-12 指摘）
  const [condition, setCondition] = useState('');
  const [picker, setPicker] = useState<PickerKey>(null);
  const me = useMe();
  const [photoSheet, setPhotoSheet] = useState(false);
  // 出品・水やりのタイミングでだけプレミアムを案内する（2026-08-13 指摘）
  const [nudge, setNudge] = useState(true);
  // 出品できたことを見せるポップアップ（2026-08-13 指摘）
  const [done, setDone] = useState(false);
  // 切り抜き画面から戻ってきたとき、どの写真を差し替えるか
  const cropTarget = useRef<number | null>(null);
  // 切り抜き画面は結果を cropped パラメータで返してくる
  const { cropped } = useLocalSearchParams<{ cropped?: string }>();
  useEffect(() => {
    if (!cropped) return;
    const i = cropTarget.current;
    if (i !== null) setPhotos((p) => p.map((v, idx) => (idx === i ? cropped : v)));
    cropTarget.current = null;
    router.setParams({ cropped: undefined });
  }, [cropped]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formOk = name.trim().length > 0 && photos.length > 0;

  const submit = async () => {
    if (busy) return;
    if (!formOk) {
      setError(photos.length === 0 ? '写真を1枚以上追加してください' : '商品名を入力してください');
      return;
    }
    setError(null);
    setBusy(true);
    const res = await plantSeed({ name, category, condition, description: desc, photos });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    success();
    playSfx('pop');
    // 黙って前の画面に戻ると出品できたのか分からなかった（2026-08-13 指摘）。
    // 完了を見せてからホームへ送る
    setDone(true);
  };

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

      <ScrollView
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.body}>
          <NoticeBox text="いらないものを植えると、交換の輪がはじまります" />

          {/* 写真 */}
          <View style={styles.photoSection}>
            {/* 追加ボタンは左に固定し、写真だけを横に流す。
                ボタンごとスクロールすると、写真が増えたときに押せなくなる（2026-08-13 指摘） */}
            <View style={styles.photoRowWrap}>
            {photos.length < 10 && (
              <PressableScale onPress={() => setPhotoSheet(true)} activeScale={0.96} style={styles.addPhoto}>
                <Ionicons name="camera" size={30} color={colors.green} />
                <Text style={styles.addPhotoText}>＋写真を追加</Text>
              </PressableScale>
            )}
            <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {photos.map((uri, i) => (
                <View key={uri + i} style={[styles.photo, shadows.soft]}>
                  {/* 写真をタップすると切り抜き画面へ。
                      以前はここで写真フォルダが開き、同じ写真を選び直す必要があった
                      （2026-08-14 指摘） */}
                  <PressableScale
                    activeScale={0.97}
                    onPress={() => { cropTarget.current = i; router.push({ pathname: '/crop', params: { uri } }); }}
                  >
                    <Thumb uri={uri} style={styles.photoImg} radius={radius.md} markSize={44} />
                    <View style={styles.cropHint}>
                      <Ionicons name="crop" size={11} color={colors.white} />
                      <Text style={styles.cropHintText}>切り抜く</Text>
                    </View>
                  </PressableScale>
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
            </ScrollView>
            </View>
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
              inputAccessoryViewID={KEYBOARD_DONE_ID}
              style={[styles.input, styles.textarea]}
            />
          </Animated.View>

          {/* カテゴリー / 状態 */}
          <SelectRow label="カテゴリー" value={category} placeholder="選択してください" required onPress={() => setPicker('category')} />
          <SelectRow label="商品の状態" value={condition} placeholder="選択してください" required onPress={() => setPicker('condition')} />
        </View>
      </ScrollView>

      {/* 送信ボタン */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {error ? <View style={{ marginBottom: 10 }}><FormError message={error} /></View> : null}
        <Button
          title="タネを植える"
          loading={busy}
          leftIcon={<Sprout size={22} color={colors.white} />}
          onPress={submit}
        />
      </View>

      {/* 写真の追加方法（カメラ / ライブラリ） */}
      {/* 出品完了 */}
      <BottomSheetModal visible={done} onClose={() => { setDone(false); router.dismissTo('/(tabs)'); }}>
        <View style={styles.doneHead}>
          <Sprout size={56} />
          <Text style={styles.doneTitle}>出品しました！</Text>
          <Text style={styles.doneSub}>
            誰かが水やりしてくれると通知が届きます。{'\n'}集まったら収穫して、交換の輪をはじめましょう。
          </Text>
        </View>
        <Button title="ホームに戻る" onPress={() => { setDone(false); router.dismissTo('/(tabs)'); }} />
        <PressableScale
          onPress={() => { setDone(false); router.dismissTo('/mypage/items'); }}
          activeScale={0.98}
          style={styles.doneGhost}
        >
          <Text style={styles.doneGhostText}>出品履歴を見る</Text>
        </PressableScale>
      </BottomSheetModal>

      <PremiumNudge trigger={nudge} isPremium={me.isPremium} onClose={() => setNudge(false)} />

      <PhotoSourceSheet
        visible={photoSheet}
        onClose={() => setPhotoSheet(false)}
        onPicked={(uris) => setPhotos((p) => [...p, ...uris].slice(0, 10))}
      />

      {/* ピッカー */}
      <OptionPicker
        visible={picker !== null}
        title={picker === 'category' ? 'カテゴリー' : '商品の状態'}
        options={picker === 'category' ? categories : conditions}
        selected={picker === 'category' ? category : condition}
        searchable={picker === 'category'}
        onSelect={(v) => (picker === 'category' ? setCategory(v) : setCondition(v))}
        onClose={() => setPicker(null)}
      />
      <KeyboardDoneBar />
    </View>
  );
}

function SelectRow({
  label,
  value,
  placeholder = '',
  required = false,
  onPress,
}: {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} activeScale={0.98} style={[styles.selectRow, shadows.soft]}>
      <View style={styles.labelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required && <Text style={styles.required}>必須</Text>}
      </View>
      <View style={styles.selectRight}>
        <Text style={[styles.selectValue, !value && styles.selectPlaceholder]}>{value || placeholder}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.green} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // 「任意」があるなら「必須」も出す（2026-08-05 指摘）
  required: {
    fontFamily: fonts.bold, fontSize: 10.5, color: colors.white,
    backgroundColor: colors.orangeDeep, paddingHorizontal: 6, paddingVertical: 1.5,
    borderRadius: radius.pill, overflow: 'hidden',
  },
  selectPlaceholder: { color: colors.textPlaceholder },
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: spacing.md },
  close: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { fontFamily: fonts.bold, fontSize: 19, color: colors.green },
  body: { paddingHorizontal: 20, gap: spacing.lg, paddingTop: spacing.sm },
  photoSection: { gap: spacing.sm },
  photoRow: { gap: spacing.md, paddingVertical: spacing.xs },
  photoRowWrap: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  doneHead: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  doneTitle: { fontFamily: fonts.black, fontSize: 20, color: colors.greenDeep },
  doneSub: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  doneGhost: { alignItems: 'center', paddingVertical: spacing.lg },
  doneGhostText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  cropHint: {
    position: 'absolute', left: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2,
  },
  cropHintText: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.white },
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
