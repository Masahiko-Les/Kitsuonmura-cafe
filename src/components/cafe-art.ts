import type { RectFn } from "./animals";

// 村のマップに建つカフェの外観（5×4マス＝80×64ドット）。X, Y は建物の左上。
// 夕暮れの山小屋：スレート屋根に切妻、明かりのともる窓、カップの吊り看板、足もとの紫陽花。
// 扉は下の段の真ん中のマス（32〜47, 48〜63）に収める
const SLATE = "#3d4a78", SLATE_DARK = "#2e3860", SLATE_LIGHT = "#55639a";
const TIMBER = "#8a5a34", TIMBER_LIGHT = "#b5804a", TIMBER_DARK = "#4a2f1d";
const WALL = "#5e3f29", WALL_DARK = "#4d3221";
const GLOW = "#ffd27a", GLOW_DEEP = "#f2a53c", GLOW_BRIGHT = "#fff1bd", SHADOW = "#7a4a26";

function leaves(r: RectFn, x: number, y: number, w: number, h: number) {
  r(x + 1, y, w - 2, h, "#2f6b3a");
  r(x, y + 1, w, h - 2, "#2f6b3a");
  r(x + 1, y + 1, w - 3, 2, "#5a9a48");
  r(x + 2, y + 1, 2, 1, "#c9d65a");
}

function window(r: RectFn, x: number, y: number, w: number, h: number, people: number[]) {
  r(x - 1, y - 1, w + 2, h + 2, TIMBER_DARK);
  r(x, y, w, h, GLOW);
  r(x, y + h - 4, w, 4, GLOW_DEEP);
  r(x, y, w, 2, GLOW_BRIGHT);
  // 店の中の村人の影
  for (const px of people) {
    r(x + px + 1, y + h - 10, 3, 3, SHADOW);
    r(x + px + 2, y + h - 7, 1, 1, SHADOW);
    r(x + px, y + h - 6, 5, 6, SHADOW);
  }
  // 窓枠
  r(x + Math.floor(w / 2), y, 1, h, TIMBER_DARK);
  r(x, y + 6, w, 1, TIMBER_DARK);
}

function hydrangea(r: RectFn, x: number, y: number) {
  r(x, y + 3, 12, 6, "#2f6b3a");
  r(x + 1, y + 7, 3, 2, "#5a9a48");
  r(x + 8, y + 6, 3, 2, "#5a9a48");
  r(x + 2, y, 8, 5, "#e8e2f2");
  r(x + 1, y + 1, 10, 3, "#e8e2f2");
  for (const [a, b] of [[3, 1], [6, 2], [8, 1], [4, 3], [2, 2]]) r(x + a, y + b, 1, 1, "#b7a9d6");
}

export function drawCafeExterior(r: RectFn, X: number, Y: number) {
  const px = (x: number, y: number, w: number, h: number, c: string) => r(X + x, Y + y, w, h, c);

  // 屋根のうしろにかかる枝葉
  leaves(px, 0, 2, 13, 8);
  leaves(px, 8, 0, 12, 7);
  leaves(px, 66, 3, 13, 7);

  // 大きなスレート屋根（奥から手前へ広がる）
  for (let i = 0; i < 28; i++) {
    const inset = Math.max(0, Math.round(12 - i * 0.46));
    const row = 6 + i;
    px(inset, row, 80 - inset * 2, 1, i % 4 === 3 ? SLATE_DARK : SLATE);
    if (i % 4 !== 3) for (let k = inset + ((i >> 2) % 2) * 3; k < 80 - inset; k += 6) px(k, row, 1, 1, SLATE_DARK);
  }
  px(13, 6, 54, 1, SLATE_LIGHT);

  // 手前の切妻
  for (let i = 0; i < 30; i++) {
    const half = 2 + Math.round(i * 0.8);
    px(40 - half, 3 + i, half * 2, 1, TIMBER_DARK);
    if (half > 3) px(40 - half + 3, 3 + i, half * 2 - 6, 1, WALL);
    px(40 - half, 3 + i, 2, 1, TIMBER_LIGHT);
    px(40 + half - 2, 3 + i, 2, 1, TIMBER);
  }
  px(39, 1, 2, 3, TIMBER_LIGHT);
  // 切妻の小窓
  px(32, 14, 16, 13, TIMBER_DARK);
  px(33, 15, 14, 11, GLOW);
  px(33, 15, 14, 2, GLOW_BRIGHT);
  px(39, 15, 2, 11, TIMBER_DARK);

  // 軒
  px(0, 33, 80, 3, TIMBER);
  px(0, 33, 80, 1, TIMBER_LIGHT);
  px(2, 36, 76, 1, TIMBER_DARK);

  // 壁（縦板）
  px(3, 37, 74, 27, WALL);
  for (let x = 6; x < 77; x += 5) px(x, 37, 1, 27, WALL_DARK);

  // 窓
  window(px, 7, 40, 22, 18, [3, 14]);
  window(px, 51, 40, 22, 18, [2, 9, 16]);

  // 入口。開いていて、中の明かりが見える
  px(32, 47, 16, 17, TIMBER_DARK);
  px(34, 49, 12, 15, GLOW);
  px(34, 49, 12, 3, GLOW_BRIGHT);
  px(34, 60, 12, 4, GLOW_DEEP);
  px(39, 49, 2, 3, TIMBER_DARK); // ランプ
  px(37, 52, 6, 2, "#fff6c2");

  // 吊り看板
  px(0, 30, 24, 2, TIMBER_DARK);
  px(0, 30, 24, 1, TIMBER_LIGHT);
  px(5, 32, 1, 3, TIMBER_DARK);
  px(18, 32, 1, 3, TIMBER_DARK);
  px(3, 35, 18, 15, TIMBER_DARK);
  px(2, 37, 20, 11, TIMBER_DARK);
  px(4, 36, 16, 13, TIMBER);
  px(3, 38, 18, 9, TIMBER);
  px(8, 41, 8, 5, "#f6efd9"); // カップ
  px(9, 46, 6, 1, "#f6efd9");
  px(16, 42, 2, 1, "#f6efd9");
  px(17, 43, 1, 2, "#f6efd9");
  px(15, 45, 2, 1, "#f6efd9");
  px(7, 47, 10, 1, "#d9c9a8");
  px(10, 38, 1, 2, "#f6efd9"); // 湯気
  px(13, 38, 1, 2, "#f6efd9");

  // 入口の石段と、足もとの花
  px(30, 62, 20, 2, "#8c88a8");
  px(30, 62, 20, 1, "#aaa6c4");
  hydrangea(px, 0, 55);
  hydrangea(px, 12, 55);
  hydrangea(px, 68, 55);
}
