#!/usr/bin/env python3
"""アプリで使う文字だけに M PLUS Rounded 1c をサブセット化して assets/fonts/ に出力。
角丸ゴシックで「緩い」印象に。全ソースから文字を収集するので、表示テキストの
グリフ欠け（→システムフォントにフォールバックして一文字だけ太字に見える）を防ぐ。"""
import os, glob, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'fonts')
os.makedirs(OUT, exist_ok=True)

# 1) ソース中の全文字を収集（app/・src/ の .ts/.tsx すべて）
chars = set()
for base in ('app', 'src'):
    for f in glob.glob(os.path.join(ROOT, base, '**', '*.*'), recursive=True):
        if f.rsplit('.', 1)[-1] in ('ts', 'tsx') and 'avatarData' not in f:
            with open(f, encoding='utf-8') as fp:
                chars.update(fp.read())

# 2) 表示され得る範囲を丸ごと追加（かな・記号・英数）。漢字はソースから収集済み。
def rng(a, b):
    for c in range(a, b + 1):
        chars.add(chr(c))
rng(0x20, 0x7E)      # ASCII
rng(0x3000, 0x303F)  # CJK記号・句読点
rng(0x3040, 0x309F)  # ひらがな
rng(0x30A0, 0x30FF)  # カタカナ
rng(0xFF00, 0xFFEF)  # 全角英数・記号・半角カナ
for c in '①②③④⑤⑥⑦⑧⑨⑩★☆♪→←↑↓♥※〒℃…‥、。「」『』【】〜ー':
    chars.add(c)

text = ''.join(sorted(c for c in chars if ord(c) >= 0x20))
txtfile = os.path.join(OUT, '_chars.txt')
with open(txtfile, 'w', encoding='utf-8') as fp:
    fp.write(text)
print(f'collected {len(chars)} unique chars')

# 旧フォント削除
for old in glob.glob(os.path.join(OUT, 'NotoSansJP-*.ttf')):
    os.remove(old)

WEIGHTS = {
    '400Regular': 'MPLUSRounded1c-Regular.ttf',
    '500Medium': 'MPLUSRounded1c-Medium.ttf',
    '700Bold': 'MPLUSRounded1c-Bold.ttf',
    '800ExtraBold': 'MPLUSRounded1c-ExtraBold.ttf',
}
SRC = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'm-plus-rounded-1c')

for wdir, out in WEIGHTS.items():
    src = glob.glob(os.path.join(SRC, wdir, '*.ttf'))[0]
    dst = os.path.join(OUT, out)
    subprocess.run([
        sys.executable, '-m', 'fontTools.subset', src,
        f'--text-file={txtfile}',
        '--output-file=' + dst,
        '--layout-features=*', '--glyph-names', '--notdef-outline',
        '--recalc-bounds', '--recalc-timestamp',
    ], check=True)
    kb = os.path.getsize(dst) / 1024
    print(f'{out}: {kb:.0f}KB')

os.remove(txtfile)
print('done')
