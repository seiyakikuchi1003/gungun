import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';

/**
 * 規約・プライバシーポリシーの表示（2026-08-17 指摘）。
 *
 * これまでは本文をそのまま1つの Text に流し込んでいたため、
 * 背景に文字が敷いてあるだけの状態で、どこが章の切れ目かも分からなかった。
 *
 * 本文は管理画面から差し替えられる「ただのテキスト」なので、
 * HTML のようなタグは使えない。代わりに書き方の約束だけを決めて、
 * ここで見出し・箇条書き・段落に振り分ける。
 *
 *   「■ 」で始まる行 … 章の見出し（ここからカードを分ける）
 *   「・」で始まる行  … 箇条書き
 *   「A：B」の行      … 用語と説明の組（プライバシーの表から起こした行）
 *   それ以外          … 段落
 */

type Block =
  | { kind: 'lead'; lines: string[] }
  | { kind: 'section'; title: string; lines: string[] };

function parse(body: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('■')) {
      if (current) blocks.push(current);
      current = { kind: 'section', title: line.replace(/^■\s*/, ''), lines: [] };
      continue;
    }
    if (!current) current = { kind: 'lead', lines: [] };
    if (line === '') {
      // 連続する空行はまとめる（元の本文の改行の癖を吸収する）
      if (current.lines.at(-1) !== '') current.lines.push('');
    } else {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks.filter((b) => b.lines.some((l) => l !== '') || b.kind === 'section');
}

function Line({ text }: { text: string }) {
  if (text.startsWith('・')) {
    return (
      <View style={styles.bulletRow}>
        <View style={styles.bulletDot} />
        <Text style={styles.bulletText}>{text.replace(/^・\s*/, '')}</Text>
      </View>
    );
  }
  // 「項目：説明」は、項目名を太字にして読み分けられるようにする
  const m = text.match(/^([^：]{2,18})：(.+)$/);
  if (m) {
    return (
      <View style={styles.pairRow}>
        <Text style={styles.pairKey}>{m[1]}</Text>
        <Text style={styles.pairVal}>{m[2]}</Text>
      </View>
    );
  }
  return <Text style={styles.para}>{text}</Text>;
}

export function LegalDocument({ title, body, updated }: {
  title: string;
  body: string;
  updated?: string;
}) {
  const blocks = useMemo(() => parse(body), [body]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="document-text" size={22} color={colors.green} />
        </View>
        <Text style={styles.heroTitle}>{title}</Text>
        {!!updated && <Text style={styles.heroUpdated}>最終更新日：{updated}</Text>}
      </View>

      {blocks.map((b, i) => (
        <View key={i} style={[styles.card, shadows.soft]}>
          {b.kind === 'section' && (
            <View style={styles.sectionHead}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>{b.title}</Text>
            </View>
          )}
          {b.lines.map((l, j) =>
            l === '' ? <View key={j} style={{ height: spacing.sm }} /> : <Line key={j} text={l} />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 60, gap: spacing.md },
  hero: { alignItems: 'center', gap: 6, paddingVertical: spacing.lg },
  heroIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.greenSoft,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  heroTitle: { fontFamily: fonts.black, fontSize: 20, color: colors.textPrimary },
  heroUpdated: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },

  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, gap: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.green },
  sectionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.greenDeep },

  para: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 23, color: colors.textPrimary },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 2 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.green, marginTop: 9 },
  bulletText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 23, color: colors.textPrimary },
  pairRow: { paddingVertical: 4, gap: 1 },
  pairKey: { fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary },
  pairVal: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary },
});
