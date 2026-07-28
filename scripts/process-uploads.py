#!/usr/bin/env python3
"""アップロードされた実画像を、ブランド素材／商品写真として取り込む。
 - みかん: 白背景を透過にして assets/brand/mikan.png へ
 - 各商品: JPEGに変換・リサイズして assets/products/<name>.jpg へ
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = os.path.join('/tmp/claude-0/-home-user-gungun/b571ba94-7330-5205-a63a-076dfc384c35/scratchpad/uploaded')

# --- みかん：白背景を透過に ---
def remove_white_bg(src, dst):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    # 四隅から白をフラッドフィルでマゼンタに置換（内側の白い目・スマイルは残る）
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(im, xy, (255, 0, 255), thresh=45)
    im = im.convert('RGBA')
    px = im.getdata()
    out = [(255, 255, 255, 0) if (r, g, b) == (255, 0, 255) else (r, g, b, 255) for (r, g, b, a) in px]
    im.putdata(out)
    # 余白をトリム
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(dst)
    print('brand/mikan.png <-', os.path.basename(src), im.size)

remove_white_bg(os.path.join(UP, '20260715-145546.jpeg'),
                os.path.join(ROOT, 'assets', 'brand', 'mikan.png'))

# --- 商品写真：JPEG化・正方形クロップ・リサイズ ---
PRODUCTS = {
    'screenshot-20260716-110641.png': 'switch.jpg',       # Nintendo Switch
    'screenshot-20260716-110659.png': 'bag.jpg',          # ルイヴィトン バッグ
    'screenshot-20260716-110755.png': 'iphone.jpg',       # iPhone
    'screenshot-20260716-110846.png': 'controller.jpg',   # コントローラー
    'screenshot-20260716-110901.png': 'airpods.jpg',      # AirPods
    'screenshot-20260716-110918.png': 'books.jpg',        # 本
}
OUTDIR = os.path.join(ROOT, 'assets', 'products')
for src, dst in PRODUCTS.items():
    im = Image.open(os.path.join(UP, src)).convert('RGB')
    w, h = im.size
    s = min(w, h)  # 中央正方形クロップ
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    if s > 1000:
        im = im.resize((1000, 1000), Image.LANCZOS)
    im.save(os.path.join(OUTDIR, dst), 'JPEG', quality=85)
    print(f'products/{dst} <- {src} {im.size}')

print('done')
