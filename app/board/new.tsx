import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { Thumb } from '@/components/ui/Thumb';
import { PhotoSourceSheet } from '@/components/feature/PhotoSourceSheet';
import { TAG_META, BoardTag } from '@/data/mockSocial';
import { useMe } from '@/store/me';
import { useBoard } from '@/hooks/useBoard';
import { FormError } from '@/components/ui/FormError';
import { KeyboardDoneBar, KEYBOARD_DONE_ID } from '@/components/ui/KeyboardDoneBar';
import { lh } from '@/lib/fontScale';

const MAX = 280;
const TAGS: BoardTag[] = ['harvest', 'question', 'chat', 'notice'];
/** ツールバーの顔文字ボタンから挿し込める絵文字 */
const EMOJI = ['🌱', '🌳', '🍊', '💧', '🎉', '😊', '🙏', '✨', '📦', '❤️'];

/** 文字数の円形カウンター。 */
function CountRing({ used }: { used: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  const p = Math.min(used / MAX, 1);
  const over = used > MAX - 20;
  const color = used >= MAX ? '#D5675C' : over ? colors.orange : colors.green;
  const remain = MAX - used;
  return (
    <View style={styles.ring}>
      <Svg width={30} height={30}>
        <Circle cx={15} cy={15} r={r} stroke={colors.border} strokeWidth={3} fill="none" />
        <Circle
          cx={15} cy={15} r={r} stroke={color} strokeWidth={3} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} strokeLinecap="round"
          transform="rotate(-90 15 15)"
        />
      </Svg>
      {over && <Text style={[styles.ringNum, { color }]}>{remain}</Text>}
    </View>
  );
}

export default function NewPost() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [tag, setTag] = useState<BoardTag>('chat');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { create } = useBoard();
  const can = text.trim().length > 0 && !busy;

  const submit = async () => {
    if (!can) return;
    setError(null);
    setBusy(true);
    // 写真は1枚目だけ投稿に添える（DBの board_posts.image_url は1枚）
    let imageUrl: string | null = null;
    if (photos.length > 0 && me.live) {
      try {
        const { uploadImage } = await import('@/lib/api/storage');
        imageUrl = await uploadImage(me.id, photos[0]);
      } catch {
        setBusy(false);
        setError('写真をアップロードできませんでした');
        return;
      }
    }
    const res = await create(text, tag, imageUrl);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    router.back();
  };

  return (
    <View style={styles.root}>
      {/* ヘッダー */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.close}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.title}>投稿する</Text>
        {/* 投稿ボタンは右上ではなく、キーボードのすぐ上（写真・絵文字の並び）に置く。
            書き終えた指の近くにある方が押しやすい（2026-08-17 指摘） */}
        <View style={styles.close} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {error ? <View style={{ marginBottom: 12 }}><FormError message={error} /></View> : null}

          {/* ユーザー＋公開範囲 */}
          <View style={styles.userRow}>
            <Avatar uri={me.avatar} name={me.nickname} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{me.nickname}さん</Text>
              <View style={styles.publicChip}>
                <Ionicons name="earth" size={12} color={colors.green} />
                <Text style={styles.publicText}>みんなに公開</Text>
              </View>
            </View>
          </View>

          {/* カテゴリ */}
          <Text style={styles.label}>カテゴリを選ぶ</Text>
          <View style={styles.tags}>
            {TAGS.map((t) => {
              const meta = TAG_META[t];
              const on = tag === t;
              return (
                <PressableScale key={t} activeScale={0.95} onPress={() => setTag(t)}
                  style={[styles.tag, { backgroundColor: on ? meta.color : meta.bg }]}>
                  <Text style={[styles.tagText, { color: on ? colors.white : meta.color }]}>{meta.label}</Text>
                </PressableScale>
              );
            })}
          </View>

          {/* 本文 */}
          <View style={[styles.inputCard, shadows.soft]}>
            <TextInput
              autoFocus
              multiline
              inputAccessoryViewID={KEYBOARD_DONE_ID}
              value={text}
              onChangeText={(t) => t.length <= MAX && setText(t)}
              placeholder="交換の様子や、探しているもの、質問などをシェアしよう🌱"
              placeholderTextColor={colors.textPlaceholder}
              style={[styles.input, { outlineStyle: 'none' } as object]}
            />
            {/* 添付写真 */}
            <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photo}>
                  <Thumb uri={uri} style={styles.photoImg} radius={radius.md} markSize={26} />
                  <PressableScale onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))} activeScale={0.85} style={styles.photoRemove}>
                    <Ionicons name="close" size={13} color={colors.white} />
                  </PressableScale>
                </View>
              ))}
              {photos.length < 4 && (
                <PressableScale onPress={() => setPhotoSheet(true)} activeScale={0.96} style={styles.addPhoto}>
                  <Ionicons name="camera" size={24} color={colors.green} />
                  <Text style={styles.addPhotoText}>写真</Text>
                </PressableScale>
              )}
            </ScrollView>
          </View>

          <View style={styles.tipRow}>
            <Ionicons name="sparkles" size={14} color={colors.orange} />
            <Text style={styles.tip}>交換成立の報告をすると、コミュニティが盛り上がります！</Text>
          </View>
        </ScrollView>

        {/* ツールバー */}
        <View style={[styles.toolbarWrap, shadows.sheet]}>
          {emojiOpen && (
            <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
              {EMOJI.map((e) => (
                <PressableScale
                  key={e}
                  activeScale={0.85}
                  style={styles.emojiBtn}
                  onPress={() => setText((t) => (t.length < MAX ? t + e : t))}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          )}
          <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <PressableScale activeScale={0.9} style={styles.tool} onPress={() => photos.length < 4 && setPhotoSheet(true)}>
              <Ionicons name="image-outline" size={24} color={colors.green} />
            </PressableScale>
            <PressableScale activeScale={0.9} style={[styles.tool, emojiOpen && styles.toolOn]} onPress={() => setEmojiOpen((v) => !v)}>
              <Ionicons name="happy-outline" size={24} color={emojiOpen ? colors.white : colors.green} />
            </PressableScale>
            <View style={{ flex: 1 }} />
            <CountRing used={text.length} />
            <PressableScale
              onPress={submit}
              activeScale={0.94}
              disabled={!can || busy}
              style={[styles.post, shadows.button, !can && styles.postOff]}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={14} color={colors.white} />
                  <Text style={styles.postText}>投稿</Text>
                </>
              )}
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* 写真の追加方法（カメラ / ライブラリ） */}
      <PhotoSourceSheet
        visible={photoSheet}
        onClose={() => setPhotoSheet(false)}
        onPicked={(uris) => setPhotos((p) => [...p, ...uris].slice(0, 4))}
      />
      <KeyboardDoneBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  close: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  post: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.green, paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.pill },
  postOff: { opacity: 0.4 },
  postText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  userName: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  publicChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.greenSoft, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, marginTop: 4 },
  publicText: { fontFamily: fonts.bold, fontSize: 11, color: colors.green },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  tag: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill },
  tagText: { fontFamily: fonts.bold, fontSize: 13 },
  inputCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, minHeight: 180 },
  input: { fontFamily: fonts.regular, fontSize: 16, lineHeight: lh(26), color: colors.textPrimary, minHeight: 110, textAlignVertical: 'top' },
  photoRow: { gap: spacing.sm, paddingTop: spacing.xs },
  photo: { width: 84, height: 84 },
  photoImg: { width: 84, height: 84 },
  photoRemove: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  addPhoto: { width: 84, height: 84, borderRadius: radius.md, borderWidth: 2, borderColor: colors.greenSoftBorder, borderStyle: 'dashed', backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center', gap: 3 },
  addPhotoText: { fontFamily: fonts.bold, fontSize: 12, color: colors.green },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  tip: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  toolbarWrap: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  tool: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.greenSoft },
  toolOn: { backgroundColor: colors.green },
  emojiRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  emojiBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgWarm },
  emojiText: { fontSize: 21, lineHeight: lh(26) },
  ring: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  ringNum: { position: 'absolute', fontFamily: fonts.bold, fontSize: 9 },
});
