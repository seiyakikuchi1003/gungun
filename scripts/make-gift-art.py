#!/usr/bin/env python3
"""ぐんぐんのブランド調に合わせたギフト箱の画像を生成する。

アイコンフォントではなく“実画像”として使うため、4倍のスーパーサンプリングで
描いてから縮小し、エッジを滑らかに仕上げる。出力: assets/brand/gift.png
"""
from PIL import Image, ImageDraw

OUT = "/home/user/gungun/assets/brand/gift.png"
FINAL = 512
S = 4                      # スーパーサンプリング倍率
W = FINAL * S

# パレット（src/theme/index.ts と揃える）
ORANGE_LIGHT = (250, 186, 74)
ORANGE = (245, 166, 35)
ORANGE_DARK = (203, 120, 18)
CREAM = (255, 249, 236)
CREAM_SHADE = (238, 224, 197)
LEAF = (130, 191, 75)
LEAF_DEEP = (104, 162, 57)


def s(v):
    return int(v * S)


def vgrad(size, top, bottom):
    """縦方向グラデーションの画像"""
    w, h = size
    g = Image.new("RGB", (1, h))
    px = g.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return g.resize((w, h), Image.BILINEAR)


def paste_grad(base, box, draw_fn, top, bottom):
    """マスク形状にグラデーションを流し込んで合成"""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    mask = Image.new("L", (w, h), 0)
    draw_fn(ImageDraw.Draw(mask), w, h)
    base.paste(vgrad((w, h), top, bottom), (x0, y0), mask)


def rotated(draw_fn, size, angle, center):
    """透明レイヤーに描いて回転し、center を中心に配置したレイヤーを返す"""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    out.paste(layer, (center[0] - layer.width // 2, center[1] - layer.height // 2), layer)
    return out


def loop(flip: bool):
    """リボンのループ（輪）を1つ作る。flip=True で右側用に反転。"""
    lw, lh = s(150), s(112)

    def draw(d):
        d.ellipse([0, 0, lw, lh], fill=CREAM)
        # 内側をくり抜いて“輪”にする
        d.ellipse([s(38), s(30), lw - s(34), lh - s(30)], fill=(0, 0, 0, 0))
        # 下側にごく薄い陰
        d.arc([0, 0, lw, lh], 20, 160, fill=CREAM_SHADE, width=s(5))

    angle = -18 if flip else 18
    cx = s(322) if flip else s(190)
    return rotated(draw, (lw, lh), angle, (cx, s(126)))


img = Image.new("RGBA", (W, W), (0, 0, 0, 0))

# ── 箱本体 ─────────────────────────────────────────────
paste_grad(
    img, (s(102), s(216), s(410), s(442)),
    lambda d, w, h: d.rounded_rectangle([0, 0, w, h], radius=s(26), fill=255),
    ORANGE, ORANGE_DARK,
)

# ── フタ ───────────────────────────────────────────────
paste_grad(
    img, (s(76), s(154), s(436), s(230)),
    lambda d, w, h: d.rounded_rectangle([0, 0, w, h], radius=s(22), fill=255),
    ORANGE_LIGHT, (228, 141, 26),
)

d = ImageDraw.Draw(img)

# ── リボン（縦）：箱とフタを通す ───────────────────────
d.rectangle([s(230), s(230), s(282), s(442)], fill=CREAM)
d.rounded_rectangle([s(230), s(430), s(282), s(442)], radius=s(6), fill=CREAM)
d.rounded_rectangle([s(226), s(154), s(286), s(230)], radius=s(8), fill=CREAM)
# 箱の丸角に合わせて下端をなじませる
d.rounded_rectangle([s(102), s(216), s(410), s(442)], radius=s(26),
                    outline=(0, 0, 0, 0), width=0)

# ── リボンのループ（左右）と結び目 ─────────────────────
img.alpha_composite(loop(False))
img.alpha_composite(loop(True))
d = ImageDraw.Draw(img)
d.ellipse([s(226), s(120), s(286), s(178)], fill=CREAM)
d.arc([s(226), s(120), s(286), s(178)], 30, 150, fill=CREAM_SHADE, width=s(4))

# ── 双葉（ぐんぐんらしさ）：結び目の右上にそっと ───────
def leaf(d2):
    d2.ellipse([0, 0, s(86), s(50)], fill=LEAF)
    d2.arc([0, 0, s(86), s(50)], 190, 350, fill=LEAF_DEEP, width=s(4))
    d2.line([s(10), s(38), s(74), s(14)], fill=LEAF_DEEP, width=s(4))

img.alpha_composite(rotated(leaf, (s(86), s(50)), 32, (s(348), s(96))))

# ── 仕上げ：縮小してアンチエイリアス ───────────────────
img = img.resize((FINAL, FINAL), Image.LANCZOS)
img.save(OUT)
print("wrote", OUT, img.size)
