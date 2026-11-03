// できたことの植物のドット絵（できたこと農園と同じ絵）。塗る関数を受け取って描く
import { FLOWERS, MAX_WATER } from "@/lib/dekitakoto/constants";

import type { RectFn } from "./animals";

function mound(r: RectFn, X: number, Y: number) {
  r(X + 3, Y + 11, 10, 3, "#7a4e2d");
  r(X + 4, Y + 10, 8, 1, "#8f5e38");
  r(X + 4, Y + 14, 8, 1, "#5e3b22");
}

// stage: 0 種 / 2 芽 / 4 つぼみ / 5 開花（1, 3 は途中の絵）
export function drawPlant(r: RectFn, X: number, Y: number, stage: number, fl: number) {
  const f = FLOWERS[fl] || FLOWERS[0];
  mound(r, X, Y);
  if (stage === 0) {
    r(X + 6, Y + 10, 1, 1, "#efe2b0");
    r(X + 9, Y + 11, 1, 1, "#efe2b0");
    r(X + 7, Y + 12, 1, 1, "#efe2b0");
    return;
  }
  if (stage === 1) {
    r(X + 7, Y + 8, 2, 3, "#3d8b3d");
    r(X + 5, Y + 7, 2, 2, "#5cb85c");
    r(X + 9, Y + 7, 2, 2, "#5cb85c");
    return;
  }
  if (stage === 2) {
    r(X + 7, Y + 6, 2, 5, "#3d8b3d");
    r(X + 4, Y + 6, 3, 2, "#5cb85c");
    r(X + 9, Y + 6, 3, 2, "#5cb85c");
    r(X + 5, Y + 8, 2, 1, "#4aa34a");
    r(X + 9, Y + 8, 2, 1, "#4aa34a");
    return;
  }
  r(X + 7, Y + 4, 2, 7, "#3d8b3d");
  r(X + 3, Y + 8, 4, 2, "#5cb85c");
  r(X + 9, Y + 7, 4, 2, "#5cb85c");
  if (stage === 3) {
    r(X + 6, Y + 2, 4, 3, "#4aa34a");
    return;
  }
  if (stage === 4) {
    r(X + 6, Y + 3, 4, 2, "#4aa34a");
    r(X + 6, Y + 1, 4, 2, f.petal);
    r(X + 7, Y + 0, 2, 1, f.petal);
    return;
  }
  r(X + 5, Y + 0, 6, 1, f.petal);
  r(X + 4, Y + 1, 8, 4, f.petal);
  r(X + 5, Y + 5, 6, 1, f.petal);
  r(X + 3, Y + 2, 1, 2, f.petal);
  r(X + 12, Y + 2, 1, 2, f.petal);
  r(X + 4, Y + 4, 8, 1, f.dark);
  r(X + 7, Y + 2, 2, 2, f.center);
}

// 水やりの回数 → 絵の段階（0回＝種、1回＝芽、2回＝つぼみ、3回で開花）
const GROWTH = [0, 2, 4];
export function stageOf(s: { bloomed: string | null; waters: string[] }) {
  if (s.bloomed) return 5;
  return GROWTH[Math.min(s.waters.length, MAX_WATER - 1)];
}

// 今日まだ水やりできる種の上に出す 💧
export function drawDrop(r: RectFn, X: number, Y: number) {
  r(X + 12, Y, 1, 1, "#4a9fd8");
  r(X + 11, Y + 1, 3, 2, "#4a9fd8");
  r(X + 11, Y + 3, 3, 1, "#2f7fb8");
  r(X + 12, Y + 1, 1, 1, "#bfe3f7");
}

// 種の上に立っているとき、村人の頭の上に出す吹き出し（X, Y は村人の左上）
export function drawBubble(r: RectFn, X: number, Y: number, stage: number, fl: number) {
  const by = Y - 21;
  r(X - 1, by, 18, 18, "#3a3226");
  r(X, by + 1, 16, 16, "#fffdf2");
  r(X + 7, by + 18, 3, 1, "#3a3226");
  r(X + 8, by + 19, 1, 1, "#3a3226");
  r(X + 7, by + 17, 3, 1, "#fffdf2");
  // 吹き出しの中に収まるよう、花の絵を1ドット下げて描く
  drawPlant(r, X, by + 1, stage, fl);
}

// 看板（あそびかた）
export function drawSign(r: RectFn, X: number, Y: number) {
  r(X + 7, Y + 8, 2, 7, "#6b4a2e");
  r(X + 2, Y + 2, 12, 7, "#a0703f");
  r(X + 2, Y + 2, 12, 1, "#b8854f");
  r(X + 2, Y + 8, 12, 1, "#7a5235");
  r(X + 4, Y + 4, 8, 1, "#5a3e2b");
  r(X + 4, Y + 6, 6, 1, "#5a3e2b");
}
