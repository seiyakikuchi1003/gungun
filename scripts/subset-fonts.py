#!/usr/bin/env python3
"""アプリで使う文字だけに Noto Sans JP をサブセット化して assets/fonts/ に出力。
CJKフォントは全字形だと1ウェイト5MB超だが、使用文字だけなら数十KBで済む。"""
import os, glob, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'fonts')
os.makedirs(OUT, exist_ok=True)

# 1) ソース中の全文字を収集
chars = set()
for base in ('app', 'src'):
    for f in glob.glob(os.path.join(ROOT, base, '**', '*.*'), recursive=True):
        if f.rsplit('.', 1)[-1] in ('ts', 'tsx'):
            with open(f, encoding='utf-8') as fp:
                chars.update(fp.read())

# 2) 安全のため、かな・記号・英数の範囲を丸ごと追加
def rng(a, b):
    for c in range(a, b + 1):
        chars.add(chr(c))
rng(0x20, 0x7E)      # ASCII
rng(0x3000, 0x303F)  # CJK記号・句読点（、。「」・〜 等）
rng(0x3040, 0x309F)  # ひらがな
rng(0x30A0, 0x30FF)  # カタカナ
rng(0xFF00, 0xFFEF)  # 全角英数・記号
for c in '①②③④⑤★☆♪→←↑↓♥※〒℃':
    chars.add(c)

text = ''.join(sorted(chars))
txtfile = os.path.join(OUT, '_chars.txt')
with open(txtfile, 'w', encoding='utf-8') as fp:
    fp.write(text)
print(f'collected {len(chars)} unique chars')

WEIGHTS = {
    '400Regular': 'NotoSansJP-Regular.ttf',
    '500Medium': 'NotoSansJP-Medium.ttf',
    '700Bold': 'NotoSansJP-Bold.ttf',
    '900Black': 'NotoSansJP-Black.ttf',
}
SRC = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'noto-sans-jp')

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
