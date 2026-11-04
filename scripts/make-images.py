"""Android のアイコンと起動画像を作る。

アプリのアイコンは assets/images/icon.png（森のカフェと焚き火の絵）をそのまま使う。
起動画像は、ゲーム内の芽のドット絵（farm-map.tsx の drawSprout）を大きくしている。
使い方：python3 scripts/make-images.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "images"
FONT = ROOT / "node_modules/@expo-google-fonts/dotgothic16/400Regular/DotGothic16_400Regular.ttf"

MOSS = "#2e3a2b"
LEAF = "#9cc86a"
PAPER = "#f6efd9"


def sprout(draw, ox, oy, px, soil=True):
    """16×16 のマスに、畑と芽を描く。px は1ドットの大きさ。"""
    def rect(x, y, w, h, c):
        draw.rectangle([ox + x * px, oy + y * px, ox + (x + w) * px - 1, oy + (y + h) * px - 1], fill=c)

    if soil:
        rect(0, 0, 16, 16, "#8a5a34")
        for r in (3, 7, 11, 15):
            rect(0, r, 16, 1, "#6f4526")
        rect(3, 1, 2, 1, "#a06c42")
        rect(10, 9, 2, 1, "#a06c42")
    # 土の盛り上がり
    rect(5, 11, 6, 2, "#6b4226")
    rect(6, 10, 4, 1, "#6b4226")
    # 芽（育ちきった大きさ）
    h = 8
    rect(7, 10 - h, 2, h, "#4f8f3a")
    rect(4, 10 - h, 3, 2, "#7cc35a")
    rect(9, 9 - h, 3, 2, "#7cc35a")


def android():
    # アダプティブアイコン：1024px のうち中央 2/3 が見える範囲で、端末ごとの形に切り抜かれる
    size, art_size = 1024, 720
    art = Image.open(OUT / "icon.png").convert("RGB")

    # 背景は同じ絵をぼかしたもの。前景の絵の縁が見えても、なじむようにしている
    art.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(40)).save(OUT / "android-icon-background.png")

    # 前景は絵全体を、見える範囲より少し大きく縮めて真ん中に置く
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pos = (size - art_size) // 2
    fg.paste(art.resize((art_size, art_size), Image.LANCZOS), (pos, pos))
    fg.save(OUT / "android-icon-foreground.png")


def splash():
    # 起動画像：芽の下に「吃音村カフェ」。苔色の背景の上に置く前提で、背景は透明
    w, h = 720, 520
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    px = 18
    sprout(d, (w - 16 * px) // 2, 0, px, soil=False)

    font = ImageFont.truetype(str(FONT), 104)
    text = "吃音村カフェ"
    box = d.textbbox((0, 0), text, font=font)
    tw = box[2] - box[0]
    d.text(((w - tw) // 2 - box[0], 16 * px + 40 - box[1]), text, font=font, fill=LEAF)
    img.save(OUT / "splash-icon.png")


if __name__ == "__main__":
    android()
    splash()
    print("assets/images に書き出しました")
