import { Canvas, Group, Picture, Skia, type SkCanvas, type SkPaint, type SkPicture, createPicture } from "@shopify/react-native-skia";
import { type RefObject, useEffect, useMemo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import type { Seed } from "@/lib/farm-api";
import { BUILDINGS, type Building, COLS, DESERT_DEPTH, type Dir, ROWS, TILE, VIEW_COLS, VIEW_ROWS, tileAt } from "@/lib/game";
import { C } from "@/theme";

export const MOVE_MS = 150;
const W = COLS * TILE; // マップ全体
const H = ROWS * TILE;
const VW = VIEW_COLS * TILE; // 画面に映す範囲
const VH = VIEW_ROWS * TILE;
const MARGIN = 2; // マップの外にも海を何マスぶん見せるか
const NORTH = (DESERT_DEPTH + MARGIN) * TILE; // 北は砂漠の先の砂嵐まで見せる

export type SeedKind = "mine" | "mine-review" | "watered" | "full" | "open" | null;

export type Player = {
  x: number; y: number; dir: Dir; fromX: number; fromY: number; moveStart: number; walking: boolean; frame: number;
};
export type Effect = { type: "water" | "sow"; x: number; y: number; start: number; duration: number };

// 描画ループが毎フレーム読むもの。React の再描画を待たずに参照する。
export type Scene = {
  player: Player;
  seeds: Seed[];
  kindOf: (s: Seed) => SeedKind;
  hasUnread: boolean;
};

// 種を蒔いた・水やりしたときの演出。モーダルからも呼べるようにここで持つ
let effects: Effect[] = [];
export function addEffect(type: Effect["type"], x: number, y: number) {
  effects.push({ type, x, y, start: performance.now(), duration: type === "water" ? 1400 : 700 });
}

/* ---------- 塗り ---------- */
const paints = new Map<string, SkPaint>();
function paint(color: string) {
  let p = paints.get(color);
  if (!p) {
    p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setAntiAlias(false);
    paints.set(color, p);
  }
  return p;
}

let cv: SkCanvas;
function rect(x: number, y: number, w: number, h: number, c: string) {
  cv.drawRect(Skia.XYWHRect(x, y, w, h), paint(c));
}
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/* ---------- タイル ---------- */
function drawGrass(X: number, Y: number, tx: number, ty: number) {
  rect(X, Y, 16, 16, "#8dbf5a");
  const h = hash(tx, ty);
  for (let i = 0; i < 4; i++) {
    const gx = ((h >> (i * 4)) % 14) + 1;
    const gy = ((h >> (i * 4 + 2)) % 13) + 1;
    rect(X + gx, Y + gy, 1, 2, "#6fa347");
  }
}
function drawSoil(X: number, Y: number) {
  rect(X, Y, 16, 16, "#8a5a34");
  for (const r of [3, 7, 11, 15]) rect(X, Y + r, 16, 1, "#6f4526");
  rect(X + 3, Y + 1, 2, 1, "#a06c42");
  rect(X + 10, Y + 9, 2, 1, "#a06c42");
}
function drawPath(X: number, Y: number, tx: number, ty: number) {
  rect(X, Y, 16, 16, "#d8c28e");
  const h = hash(tx, ty);
  rect(X + (h % 12) + 2, Y + ((h >> 3) % 12) + 2, 2, 1, "#bfa674");
  rect(X + ((h >> 6) % 12) + 2, Y + ((h >> 9) % 12) + 2, 1, 1, "#bfa674");
}
function drawWater(X: number, Y: number, tx: number, t: number) {
  rect(X, Y, 16, 16, "#5fa8c8");
  const o = Math.floor(t / 280 + tx * 3) % 12;
  rect(X + o, Y + 4, 4, 1, "#9ed3e6");
  rect(X + ((o + 6) % 12), Y + 10, 3, 1, "#9ed3e6");
}
function drawSea(X: number, Y: number, tx: number, ty: number) {
  rect(X, Y, 16, 16, "#3b7fae");
  // 陸と接する辺に、砂浜と白い波
  const land = (x: number, y: number) => tileAt(x, y) !== "S";
  if (land(tx, ty - 1)) { rect(X, Y, 16, 3, "#e9d9a6"); rect(X, Y + 3, 16, 1, "#e8f4f8"); }
  if (land(tx, ty + 1)) { rect(X, Y + 13, 16, 3, "#e9d9a6"); rect(X, Y + 12, 16, 1, "#e8f4f8"); }
  if (land(tx - 1, ty)) { rect(X, Y, 3, 16, "#e9d9a6"); rect(X + 3, Y, 1, 16, "#e8f4f8"); }
  if (land(tx + 1, ty)) { rect(X + 13, Y, 3, 16, "#e9d9a6"); rect(X + 12, Y, 1, 16, "#e8f4f8"); }
}
function drawSeaWave(X: number, Y: number, tx: number, ty: number, t: number) {
  const o = (Math.floor(t / 420 + tx * 5 + ty * 3) % 10) + 3;
  rect(X + o - 2, Y + 6, 3, 1, "#7fc0e0");
  rect(X + ((o + 5) % 10) + 2, Y + 10, 2, 1, "#7fc0e0");
}
function drawDesert(X: number, Y: number, tx: number, ty: number) {
  rect(X, Y, 16, 16, "#e3c98a");
  const h = hash(tx, ty);
  // 砂の波紋と小石
  rect(X + (h % 6) + 1, Y + 4 + ((h >> 4) % 3), 6, 1, "#cfb070");
  rect(X + ((h >> 7) % 6) + 7, Y + 10 + ((h >> 10) % 3), 5, 1, "#cfb070");
  if (h % 5 === 0) rect(X + ((h >> 12) % 12) + 2, Y + ((h >> 15) % 12) + 2, 2, 1, "#a8895a");
}
function drawStorm(X: number, Y: number) {
  rect(X, Y, 16, 16, "#c9a46a");
}
function drawStormWind(X: number, Y: number, tx: number, ty: number, t: number) {
  // 横に流れる風の筋
  for (let i = 0; i < 3; i++) {
    const o = Math.floor(t / 60 + tx * 16 + i * 23 + ty * 7) % 32;
    rect(X + o - 8, Y + 3 + i * 5, 7, 1, "#efe0b8");
  }
}
function drawTree(X: number, Y: number, tx: number, ty: number) {
  drawGrass(X, Y, tx, ty);
  rect(X + 7, Y + 11, 2, 4, "#6b4a2e");
  rect(X + 2, Y + 1, 12, 10, "#3e7a3a");
  rect(X + 1, Y + 3, 14, 6, "#3e7a3a");
  rect(X + 4, Y + 3, 4, 2, "#5e9e4e");
  rect(X + 9, Y + 6, 2, 2, "#5e9e4e");
}
function drawFence(X: number, Y: number, tx: number, ty: number) {
  drawGrass(X, Y, tx, ty);
  rect(X, Y + 7, 16, 2, "#a9845a");
  rect(X, Y + 11, 16, 1, "#a9845a");
  rect(X + 2, Y + 5, 2, 9, "#7a5a3a");
  rect(X + 12, Y + 5, 2, 9, "#7a5a3a");
}
function drawMailbox(X: number, Y: number, tx: number, ty: number, hasUnread: boolean) {
  drawGrass(X, Y, tx, ty);
  rect(X + 7, Y + 8, 2, 8, "#6b4a2e");
  rect(X + 4, Y + 3, 8, 6, "#c4473a");
  rect(X + 4, Y + 3, 8, 1, "#e06a5c");
  if (hasUnread) { rect(X + 12, Y + 1, 2, 5, "#7a5a3a"); rect(X + 12, Y + 1, 3, 2, "#f2d04b"); }
}
/* ---------- 建物 ---------- */
function drawHouse(X: number, Y: number) {
  rect(X + 2, Y + 12, 28, 20, "#ead9b5");
  rect(X, Y, 32, 13, "#b5523b");
  for (let i = 0; i < 4; i++) rect(X, Y + 3 * i + 1, 32, 1, "#93402d");
  rect(X + 12, Y + 20, 8, 12, "#7a5235");
  rect(X + 18, Y + 26, 1, 1, "#f2d04b");
  rect(X + 4, Y + 16, 6, 6, "#7fb6d6");
  rect(X + 22, Y + 16, 6, 6, "#7fb6d6");
}
function drawCafe(X: number, Y: number) {
  rect(X + 2, Y + 10, 44, 22, "#f3e3c3");
  rect(X + 2, Y, 44, 2, "#7d5838");
  rect(X, Y + 2, 48, 9, "#6b4a2e");
  // 看板（コーヒーカップ）
  rect(X + 20, Y + 3, 9, 7, "#f6efd9");
  rect(X + 22, Y + 5, 4, 3, "#6b4a2e");
  rect(X + 26, Y + 6, 1, 1, "#6b4a2e");
  // しましまのひさし
  for (let i = 0; i < 11; i++) rect(X + 2 + i * 4, Y + 11, 4, 4, i % 2 ? "#f6efd9" : "#c4473a");
  rect(X + 6, Y + 18, 14, 9, "#7fb6d6");
  rect(X + 13, Y + 18, 1, 9, "#f3e3c3");
  rect(X + 30, Y + 18, 10, 14, "#7a5235");
  rect(X + 37, Y + 25, 1, 1, "#f2d04b");
}
function drawLibrary(X: number, Y: number) {
  rect(X + 2, Y + 10, 44, 22, "#b5714a");
  for (const r of [14, 19, 24, 29]) rect(X + 2, Y + r, 44, 1, "#9a5d3c");
  rect(X, Y + 1, 48, 10, "#3f6f8a");
  rect(X, Y + 4, 48, 1, "#335c73");
  rect(X, Y + 7, 48, 1, "#335c73");
  rect(X + 6, Y + 15, 8, 11, "#7fb6d6");
  rect(X + 34, Y + 15, 8, 11, "#7fb6d6");
  // 看板（本）
  rect(X + 19, Y + 11, 10, 5, "#f6efd9");
  rect(X + 21, Y + 12, 3, 3, "#c4473a");
  rect(X + 24, Y + 12, 3, 3, "#3f6fb0");
  rect(X + 20, Y + 17, 8, 1, "#5a3e2b");
  rect(X + 19, Y + 18, 10, 14, "#5a3e2b");
}
function drawHall(X: number, Y: number) {
  rect(X + 2, Y + 16, 60, 32, "#ece6d8");
  // 三角屋根と時計
  for (let i = 0; i < 8; i++) rect(X + 28 - i * 3, Y + 3 + i, 8 + i * 6, 1, "#5d6470");
  rect(X, Y + 10, 64, 7, "#5d6470");
  rect(X + 28, Y + 4, 8, 8, "#f6efd9");
  rect(X + 31, Y + 5, 1, 4, "#2f2a24");
  rect(X + 31, Y + 8, 3, 1, "#2f2a24");
  for (const px of [8, 20, 40, 52]) rect(X + px, Y + 20, 4, 26, "#d6cfbf");
  rect(X + 13, Y + 24, 6, 8, "#7fb6d6");
  rect(X + 45, Y + 24, 6, 8, "#7fb6d6");
  rect(X + 26, Y + 30, 12, 16, "#7a5235");
  rect(X + 32, Y + 30, 1, 16, "#5a3e2b");
  rect(X + 22, Y + 46, 20, 2, "#bfb8a8");
}
const BUILDING_ART: Record<string, (X: number, Y: number) => void> = {
  house: drawHouse, cafe: drawCafe, library: drawLibrary, hall: drawHall,
};
function drawBuilding(b: Building) {
  BUILDING_ART[b.id]?.(b.x * TILE, b.y * TILE);
}

/* ---------- 種 ---------- */
function drawMound(X: number, Y: number, color = "#6b4226") {
  rect(X + 5, Y + 11, 6, 2, color);
  rect(X + 6, Y + 10, 4, 1, color);
}
function drawSprout(X: number, Y: number, size: number, pale: boolean) {
  drawMound(X, Y);
  const stem = pale ? "#6f9a5a" : "#4f8f3a";
  const leaf = pale ? "#a8c98f" : "#7cc35a";
  const h = 3 + size;
  rect(X + 7, Y + 10 - h, 2, h, stem);
  rect(X + 4, Y + 10 - h, 3, 2, leaf);
  rect(X + 9, Y + 9 - h, 3, 2, leaf);
}
function drawSparkle(X: number, Y: number, t: number, tx: number) {
  drawMound(X, Y);
  if ((Math.floor(t / 380) + tx) % 2 === 0) {
    rect(X + 8, Y + 4, 1, 4, "#fff6c2");
    rect(X + 6, Y + 5, 5, 1, "#fff6c2");
  } else {
    rect(X + 7, Y + 6, 2, 2, "#fff6c2");
  }
}
function drawFullPlant(X: number, Y: number) {
  drawMound(X, Y);
  rect(X + 7, Y + 3, 2, 8, "#4f8f3a");
  rect(X + 3, Y + 5, 4, 2, "#7cc35a");
  rect(X + 9, Y + 4, 4, 2, "#7cc35a");
  rect(X + 5, Y + 1, 6, 3, "#e8a33c");
}

/* ---------- 村人 ---------- */
// 歩いている途中も含めた、村人の今の位置（マス単位）
function playerPos(p: Player, t: number) {
  if (!p.walking) return { fx: p.x, fy: p.y };
  const k = Math.min(1, (t - p.moveStart) / MOVE_MS);
  return { fx: p.fromX + (p.x - p.fromX) * k, fy: p.fromY + (p.y - p.fromY) * k };
}

// 村人が画面の中央に来るカメラ位置。マップの端からははみ出さない
function camera(p: Player, t: number) {
  const { fx, fy } = playerPos(p, t);
  const m = MARGIN * TILE;
  const clamp = (v: number, min: number, max: number) => Math.round(Math.min(Math.max(v, min), max));
  return {
    x: clamp(fx * TILE + TILE / 2 - VW / 2, -m, W - VW + m),
    y: clamp(fy * TILE + TILE / 2 - VH / 2, -NORTH, H - VH + m),
  };
}

function drawPlayer(p: Player, t: number) {
  const { fx, fy } = playerPos(p, t);
  const X = Math.round(fx * TILE), Y = Math.round(fy * TILE);
  rect(X + 3, Y + 14, 10, 2, "rgba(0,0,0,0.18)");
  // 足
  const step = p.walking ? (p.frame ? 1 : -1) : 0;
  rect(X + 5, Y + 12 + Math.max(0, step), 2, 3 - Math.max(0, step), "#5a3e2b");
  rect(X + 9, Y + 12 + Math.max(0, -step), 2, 3 - Math.max(0, -step), "#5a3e2b");
  // 服
  rect(X + 4, Y + 8, 8, 5, "#3f6fb0");
  rect(X + 4, Y + 8, 8, 1, "#5a8ccc");
  // 顔
  rect(X + 4, Y + 4, 8, 5, "#f2c9a0");
  if (p.dir === "up") rect(X + 4, Y + 4, 8, 3, "#5a3e2b");
  if (p.dir === "down") { rect(X + 6, Y + 6, 1, 1, "#2f2a24"); rect(X + 9, Y + 6, 1, 1, "#2f2a24"); }
  if (p.dir === "left") rect(X + 5, Y + 6, 1, 1, "#2f2a24");
  if (p.dir === "right") rect(X + 10, Y + 6, 1, 1, "#2f2a24");
  // 麦わら帽子
  rect(X + 4, Y + 1, 8, 3, "#e2c25b");
  rect(X + 2, Y + 3, 12, 1, "#c9a640");
}

function drawEffects(t: number) {
  effects = effects.filter((e) => t - e.start < e.duration);
  for (const e of effects) {
    const X = e.x * TILE, Y = e.y * TILE;
    const k = (t - e.start) / e.duration;
    if (e.type === "water") {
      for (let i = 0; i < 5; i++) {
        const dy = ((t - e.start) / 6 + i * 7) % 18;
        rect(X + 2 + i * 3, Y - 4 + dy, 1, 2, "#9ed3e6");
      }
      rect(X + 3, Y + 13, 10 * Math.min(1, k * 2), 1, "#5fa8c8");
    }
    if (e.type === "sow") {
      const r = Math.floor(k * 6);
      rect(X + 8 - r, Y + 8, 1, 1, "#fff6c2");
      rect(X + 8 + r, Y + 8, 1, 1, "#fff6c2");
      rect(X + 8, Y + 8 - r, 1, 1, "#fff6c2");
    }
  }
}

/* ---------- 1フレーム ---------- */
// 波・池・郵便受け以外は動かないので、一度だけ描いておく（まわりの海も含める）
function staticLayer(): SkPicture {
  return createPicture((canvas) => {
    cv = canvas;
    for (let y = -DESERT_DEPTH - MARGIN; y < ROWS + MARGIN; y++) {
      for (let x = -MARGIN; x < COLS + MARGIN; x++) {
        const X = x * TILE, Y = y * TILE;
        const c = tileAt(x, y);
        if (c === "S") drawSea(X, Y, x, y);
        else if (c === "D") drawDesert(X, Y, x, y);
        else if (c === "W") drawStorm(X, Y);
        else if (c === "." || c === "H") drawGrass(X, Y, x, y);
        else if (c === ",") drawSoil(X, Y);
        else if (c === "P") drawPath(X, Y, x, y);
        else if (c === "T") drawTree(X, Y, x, y);
        else if (c === "F") drawFence(X, Y, x, y);
      }
    }
    BUILDINGS.forEach(drawBuilding);
  }, Skia.XYWHRect(-MARGIN * TILE, -NORTH, W + 2 * MARGIN * TILE, H + NORTH + MARGIN * TILE));
}

function frame(base: SkPicture, scene: Scene, t: number): SkPicture {
  return createPicture((canvas) => {
    cv = canvas;
    const cam = camera(scene.player, t);
    // 画面に入るマスの範囲（はしの半端なマスも含める）
    const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + VW) / TILE);
    const y0 = Math.floor(cam.y / TILE), y1 = Math.ceil((cam.y + VH) / TILE);
    const inView = (x: number, y: number) => x >= x0 - 1 && x <= x1 && y >= y0 - 1 && y <= y1;

    canvas.save();
    canvas.translate(-cam.x, -cam.y);
    canvas.drawPicture(base);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = tileAt(x, y);
        if (c === "S") drawSeaWave(x * TILE, y * TILE, x, y, t);
        else if (c === "W") drawStormWind(x * TILE, y * TILE, x, y, t);
        else if (c === "~") drawWater(x * TILE, y * TILE, x, t);
        else if (c === "M") drawMailbox(x * TILE, y * TILE, x, y, scene.hasUnread);
      }
    }
    const { x: px, y: py } = scene.player;
    for (const s of scene.seeds) {
      if (!inView(s.x, s.y)) continue;
      const X = s.x * TILE, Y = s.y * TILE;
      const kind = scene.kindOf(s);
      if (kind === "mine") drawSprout(X, Y, Math.min(5, s.waterCount || 0), false);
      else if (kind === "mine-review") drawMound(X, Y, "#7d7666");
      else if (kind === "watered") drawSprout(X, Y, 1, true);
      else if (kind === "full") drawFullPlant(X, Y);
      else if (kind === "open" && Math.abs(s.x - px) + Math.abs(s.y - py) <= 2) drawSparkle(X, Y, t, s.x);
    }
    drawEffects(t);
    drawPlayer(scene.player, t);
    canvas.restore();
  }, { width: VW, height: VH });
}

export function FarmMap({ scene, paused }: { scene: RefObject<Scene>; paused: boolean }) {
  const [width, setWidth] = useState(0);
  const base = useMemo(() => staticLayer(), []);
  const picture = useSharedValue<SkPicture>(base);

  useEffect(() => {
    if (paused) return;
    let raf = 0;
    const loop = (t: number) => {
      picture.value = frame(base, scene.current, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [base, scene, picture, paused]);

  const scale = width / VW;
  return (
    <View
      style={s.screen}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)}
      accessibilityLabel="農園のマップ"
      accessibilityRole="image"
    >
      {width > 0 ? (
        <Canvas style={{ width, height: VH * scale }}>
          <Group transform={[{ scale }]}>
            <Picture picture={picture} />
          </Group>
        </Canvas>
      ) : <View style={{ aspectRatio: VW / VH }} />}
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    borderWidth: 4,
    borderColor: C.mossDeep,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#000",
  },
});
