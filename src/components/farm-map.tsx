import { Canvas, Group, Picture, Skia, type SkCanvas, type SkPaint, type SkPicture, createPicture } from "@shopify/react-native-skia";
import { type RefObject, useEffect, useMemo, useState } from "react";
import { type LayoutChangeEvent, PixelRatio, StyleSheet, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import {
  type Area, BUILDINGS, type Building, CAFE_GUESTS, COLS, type Dir, ROOMS, ROWS, type RoomId, TILE,
  VIEW_TILES_ACROSS, keyOf, roomTileAt, tileAt,
} from "@/lib/game";
import { drawAnimal } from "./animals";
import { drawBubble, drawDrop, drawPlant, drawSign } from "./flower-art";

export const MOVE_MS = 150;
const W = COLS * TILE; // マップ全体
const H = ROWS * TILE;
// 画面に映す範囲（マップの画素単位）と、村人を置く高さ（画面の上からの割合）
type ViewSize = { w: number; h: number; focusY: number };
const MARGIN = 3; // マップの外にも森を何マスぶん見せるか
const NORTH = MARGIN * TILE;
// 南は広めに見せる。南の端に立っても、村人が下の操作部に隠れないように
const SOUTH_TILES = 8;
const SOUTH = SOUTH_TILES * TILE;

// マップに描く「できたこと」の植物。drop は今日まだ水やりできるとき
export type PlantVis = { x: number; y: number; stage: number; flower: number; drop: boolean };

// x, y は行き先のマス。fromX, fromY から moveStart に歩き出し、MOVE_MS かけて着く。
// walkStart〜walkUntil のあいだは足踏みのコマを進める（続けて歩くとコマがつながる）
export type Player = {
  x: number; y: number; dir: Dir; fromX: number; fromY: number; moveStart: number; walkStart: number; walkUntil: number;
};
export type Effect = { type: "water" | "sow"; x: number; y: number; start: number; duration: number };

// 描画ループが毎フレーム読むもの。React の再描画を待たずに参照する。
export type Scene = {
  area: Area;
  player: Player;
  plants: PlantVis[];
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
/* ---------- 建物 ---------- */
// 扉は村人1人ぶん（1マス）の大きさで、扉のマスにぴったり収める。X, Y は扉のマスの左上
function drawDoor(X: number, Y: number, wood: string, frame: string) {
  rect(X + 2, Y + 1, 12, 15, frame);
  rect(X + 3, Y + 2, 10, 14, wood);
  rect(X + 3, Y + 2, 10, 1, "rgba(255,255,255,0.18)");
  rect(X + 4, Y + 4, 8, 4, "rgba(0,0,0,0.12)"); // 扉の飾り板
  rect(X + 11, Y + 10, 1, 2, "#f2d04b"); // 取っ手
}
// 建物の左上を (X, Y)、扉のマスを建物の中の (dx, dy) マス目として描く
const doorAt = (X: number, Y: number, dx: number, dy: number) => [X + dx * TILE, Y + dy * TILE] as const;

function drawHouse(X: number, Y: number) {
  rect(X + 1, Y + 12, 30, 20, "#ead9b5");
  rect(X, Y, 32, 13, "#b5523b");
  for (let i = 0; i < 4; i++) rect(X, Y + 3 * i + 1, 32, 1, "#93402d");
  rect(X + 20, Y + 17, 8, 7, "#7fb6d6");
  rect(X + 23, Y + 17, 1, 7, "#ead9b5");
  rect(X + 19, Y + 24, 10, 1, "#a8956f");
  drawDoor(...doorAt(X, Y, 0, 1), "#7a5235", "#5a3e2b");
}
function drawCafe(X: number, Y: number) {
  rect(X + 1, Y + 10, 46, 22, "#f3e3c3");
  rect(X + 2, Y, 44, 2, "#7d5838");
  rect(X, Y + 2, 48, 9, "#6b4a2e");
  // 看板（コーヒーカップ）
  rect(X + 20, Y + 3, 9, 7, "#f6efd9");
  rect(X + 22, Y + 5, 4, 3, "#6b4a2e");
  rect(X + 26, Y + 6, 1, 1, "#6b4a2e");
  // しましまのひさし
  for (let i = 0; i < 12; i++) rect(X + i * 4, Y + 11, 4, 4, i % 2 ? "#f6efd9" : "#c4473a");
  // 左右の窓
  for (const wx of [3, 35]) {
    rect(X + wx, Y + 18, 10, 9, "#7fb6d6");
    rect(X + wx + 5, Y + 18, 1, 9, "#f3e3c3");
  }
  drawDoor(...doorAt(X, Y, 1, 1), "#7a5235", "#5a3e2b");
}
const BUILDING_ART: Record<string, (X: number, Y: number) => void> = {
  house: drawHouse, cafe: drawCafe,
};

function drawBuilding(b: Building) {
  BUILDING_ART[b.id]?.(b.x * TILE, b.y * TILE);
}

/* ---------- 村人 ---------- */
// 歩いている途中も含めた、村人の今の位置（マス単位）。着く手前でゆっくりになる
export function playerPos(p: Player, t: number) {
  const k = Math.min(1, Math.max(0, (t - p.moveStart) / MOVE_MS));
  const e = 1 - (1 - k) * (1 - k);
  return { fx: p.fromX + (p.x - p.fromX) * e, fy: p.fromY + (p.y - p.fromY) * e, moving: k < 1 };
}

// 村人が画面の中央に来るカメラ位置。マップの端からははみ出さない
function camera(p: Player, t: number, v: ViewSize) {
  const { fx, fy } = playerPos(p, t);
  const m = MARGIN * TILE;
  // 画面のほうが広いときは、真ん中に寄せる
  const clamp = (n: number, min: number, max: number) =>
    Math.round(min > max ? (min + max) / 2 : Math.min(Math.max(n, min), max));
  return {
    x: clamp(fx * TILE + TILE / 2 - v.w / 2, -m, W - v.w + m),
    y: clamp(fy * TILE + TILE / 2 - v.h * v.focusY, -NORTH, H - v.h + SOUTH),
  };
}

// 足踏みのコマ。-1 = 立ち止まり、0..3 = 歩き（0,2 = 足がそろう / 1,3 = 左右の足が前）
function walkPhase(p: Player, t: number, moving: boolean) {
  return t < p.walkUntil || moving ? (1 + Math.floor((t - p.walkStart) / 115)) % 4 : -1;
}

// 主人公：頭の大きい2頭身。大きな麦わら帽子、茶色の髪、青い服、茶色のズボン。
// 1マス（16ドット）の上に帽子が少しはみ出す（上から -2 〜 15 ドット）
function drawPlayer(p: Player, t: number) {
  const { fx, fy, moving } = playerPos(p, t);
  const X = Math.round(fx * TILE), Y = Math.round(fy * TILE);
  const ph = walkPhase(p, t, moving);
  const step = ph === 1 || ph === 3;
  const y = Y + (step ? -1 : 0); // 足を出したコマで体が少し上がる
  const skin = "#f6cfa6", cheek = "#f2a08c", eye = "#2a2018";
  const hair = "#7a4a2a", shirt = "#3f72c0", shirt2 = "#5a8ad8", pants = "#6b4a2e", shoe = "#3a2a1e";
  const straw = "#efc75e", strawHi = "#f8dc84", strawLo = "#c99e3c", band = "#c8402f";
  const side = p.dir === "left" || p.dir === "right";
  const sgn = p.dir === "right" ? 1 : -1;
  rect(X + 3, Y + 15, 10, 1, "rgba(0,0,0,0.22)");

  // 足（ズボンと靴）
  const leg = (lx: number, lift: number) => {
    rect(X + lx, Y + 13 - lift, 2, 1, pants);
    rect(X + lx, Y + 14 - lift, 2, 1, shoe);
  };
  if (side) {
    if (!step) { leg(6, 0); leg(8, 0); }
    else {
      const f = ph === 1 ? 1 : -1; // 前に出る足を入れ替える
      leg(7 - 2 * sgn * f, 0);
      leg(7 + 2 * sgn * f, 0);
    }
  } else {
    leg(5, ph === 3 ? 1 : 0);
    leg(9, ph === 1 ? 1 : 0);
  }

  // 体（小さめ）
  rect(X + 4, y + 10, 8, 3, shirt);
  rect(X + 4, y + 10, 8, 1, shirt2);
  // 腕
  if (side) {
    const sw = !step ? 0 : (ph === 1 ? 2 : -2) * sgn; // 前後に振る
    rect(X + 7 + sw, y + 10, 2, 2, shirt2);
    rect(X + 7 + sw, y + 12, 2, 1, skin);
  } else {
    const la = ph === 1 ? 1 : ph === 3 ? -1 : 0; // 左右の腕を交互に
    rect(X + 3, y + 10 + la, 1, 2, shirt);
    rect(X + 3, y + 12 + la, 1, 1, skin);
    rect(X + 12, y + 10 - la, 1, 2, shirt);
    rect(X + 12, y + 12 - la, 1, 1, skin);
  }

  // 頭（大きめ。帽子の下から顔がのぞく）
  rect(X + 3, y + 4, 10, 5, skin);
  rect(X + 4, y + 9, 8, 1, skin);
  if (p.dir === "up") {
    rect(X + 3, y + 4, 10, 5, hair);
    rect(X + 4, y + 9, 8, 1, hair);
  } else if (p.dir === "down") {
    rect(X + 3, y + 4, 10, 1, hair); // 前髪
    rect(X + 3, y + 5, 1, 3, hair);
    rect(X + 12, y + 5, 1, 3, hair);
    rect(X + 5, y + 6, 1, 2, eye);
    rect(X + 10, y + 6, 1, 2, eye);
    rect(X + 4, y + 8, 1, 1, cheek);
    rect(X + 11, y + 8, 1, 1, cheek);
  } else if (p.dir === "left") {
    rect(X + 8, y + 4, 5, 5, hair);
    rect(X + 8, y + 9, 4, 1, hair);
    rect(X + 3, y + 4, 5, 1, hair);
    rect(X + 4, y + 6, 1, 2, eye);
    rect(X + 5, y + 8, 1, 1, cheek);
  } else {
    rect(X + 3, y + 4, 5, 5, hair);
    rect(X + 4, y + 9, 4, 1, hair);
    rect(X + 8, y + 4, 5, 1, hair);
    rect(X + 11, y + 6, 1, 2, eye);
    rect(X + 10, y + 8, 1, 1, cheek);
  }

  // 麦わら帽子（つばを大きく）
  rect(X + 5, y - 2, 6, 1, straw);
  rect(X + 4, y - 1, 8, 3, straw);
  rect(X + 6, y - 2, 3, 1, strawHi);
  rect(X + 4, y + 1, 8, 1, band);
  rect(X + 1, y + 2, 14, 2, straw);
  rect(X + 1, y + 2, 14, 1, strawHi);
  rect(X + 2, y + 3, 12, 1, strawLo);
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

/* ---------- 家の中 ---------- */
function drawFloor(X: number, Y: number, tx: number) {
  rect(X, Y, 16, 16, "#c89b6a");
  for (let i = 0; i < 4; i++) rect(X, Y + i * 4 + 3, 16, 1, "#b4875a");
  rect(X + ((tx * 5) % 12) + 2, Y, 1, 4, "#b4875a");
  rect(X + ((tx * 7 + 6) % 12) + 2, Y + 8, 1, 4, "#b4875a");
}
function drawBackWall(X: number, Y: number) {
  rect(X, Y, 16, 16, "#e3d3b0");
  for (let i = 0; i < 4; i++) rect(X + i * 4 + 1, Y + 4, 1, 9, "#d6c49e");
  rect(X, Y, 16, 4, "#3a2e24");
  rect(X, Y + 13, 16, 3, "#8a6a48");
}
function drawBookshelf(X: number, Y: number) {
  // 2マスぶんの幅で、奥の壁に立てかけてある
  rect(X + 1, Y - 6, 30, 21, "#6b4a2e");
  rect(X + 2, Y - 5, 28, 19, "#4f3520");
  const colors = ["#c4473a", "#3f6fb0", "#e2c15a", "#4f8f3a", "#f6efd9", "#8a5aa8"];
  for (let row = 0; row < 3; row++) {
    const sy = Y - 5 + row * 6;
    for (let i = 0; i < 9; i++) {
      const h = 4 + ((i + row) % 2);
      rect(X + 3 + i * 3, sy + 5 - h, 2, h, colors[(i * 2 + row) % colors.length]);
    }
    rect(X + 2, sy + 5, 28, 1, "#6b4a2e");
  }
}
function drawBed(X: number, Y: number) {
  // 縦に2マス
  rect(X + 1, Y - 2, 14, 32, "#7a5235");
  rect(X + 2, Y, 12, 29, "#f4efe2");
  rect(X + 3, Y + 1, 10, 5, "#ffffff");
  rect(X + 3, Y + 5, 10, 1, "#ddd6c4");
  rect(X + 2, Y + 10, 12, 19, "#5a8ad0");
  rect(X + 2, Y + 10, 12, 2, "#7aa6e0");
  for (const by of [16, 22]) rect(X + 2, Y + by, 12, 1, "#4a78bc");
}
function drawTable(X: number, Y: number) {
  // 横に2マス
  rect(X + 3, Y + 10, 2, 5, "#5a3e2b");
  rect(X + 27, Y + 10, 2, 5, "#5a3e2b");
  rect(X + 1, Y + 2, 30, 9, "#a0703f");
  rect(X + 1, Y + 2, 30, 1, "#b8854f");
  rect(X + 1, Y + 10, 30, 1, "#7a5235");
  // マグカップ
  rect(X + 20, Y + 3, 4, 4, "#f6efd9");
  rect(X + 24, Y + 4, 1, 2, "#f6efd9");
  rect(X + 21, Y + 4, 2, 1, "#6b4a2e");
}
function drawDoorMat(X: number, Y: number) {
  rect(X + 2, Y + 1, 12, 11, "#9c3d34");
  rect(X + 3, Y + 2, 10, 9, "#b84c40");
  rect(X + 3, Y + 6, 10, 1, "#9c3d34");
}

function houseLayer(): SkPicture {
  const room = ROOMS.house.map;
  const cols = room[0].length, rows = room.length;
  const at = (x: number, y: number) => roomTileAt("house", x, y);
  return createPicture((canvas) => {
    cv = canvas;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const X = x * TILE, Y = y * TILE;
        const c = at(x, y);
        if (c === "#") {
          if (y === 0 && x > 0 && x < cols - 1) drawBackWall(X, Y);
          else rect(X, Y, 16, 16, "#3a2e24");
        } else {
          drawFloor(X, Y, x);
          if (c === "E") drawDoorMat(X, Y);
        }
      }
    }
    // 奥の壁の窓
    rect(4 * TILE + 3, 3, 10, 9, "#8a6a48");
    rect(4 * TILE + 4, 4, 8, 7, "#a8d4ec");
    rect(4 * TILE + 8, 4, 1, 7, "#8a6a48");
    // 家具（左上のマスを起点に描く）
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = at(x, y);
        const first = at(x - 1, y) !== c && at(x, y - 1) !== c;
        if (!first) continue;
        if (c === "K") drawBookshelf(x * TILE, y * TILE);
        if (c === "B") drawBed(x * TILE, y * TILE);
        if (c === "L") drawTable(x * TILE, y * TILE);
      }
    }
  }, Skia.XYWHRect(0, -TILE, cols * TILE, (rows + 1) * TILE));
}

/* ---------- カフェの中 ---------- */
function drawCafeFloor(X: number, Y: number, tx: number, ty: number) {
  // 市松模様の床
  rect(X, Y, 16, 16, (tx + ty) % 2 ? "#a77a52" : "#b98b5f");
  rect(X, Y + 15, 16, 1, "rgba(0,0,0,0.08)");
}
function drawCafeWall(X: number, Y: number, tx: number) {
  rect(X, Y, 16, 16, "#5a3e2b");
  rect(X, Y, 16, 3, "#3a2a1e");
  // 棚とカップ
  rect(X, Y + 8, 16, 2, "#8a6a48");
  if (tx % 2 === 0) {
    rect(X + 3, Y + 5, 3, 3, "#f6efd9");
    rect(X + 9, Y + 5, 3, 3, "#c4473a");
  } else {
    rect(X + 4, Y + 3, 3, 5, "#6f9a44"); // びん
    rect(X + 10, Y + 5, 3, 3, "#f6efd9");
  }
  // 腰板
  rect(X, Y + 12, 16, 4, "#7a5235");
}
function drawCounter(X: number, Y: number, tx: number) {
  rect(X, Y + 1, 16, 5, "#c89060");
  rect(X, Y + 1, 16, 1, "#e0ad78");
  rect(X, Y + 6, 16, 10, "#7a5235");
  rect(X + 2, Y + 8, 12, 6, "#6b4a2e");
  if (tx === 9) { rect(X + 5, Y - 2, 6, 4, "#cfd8dc"); rect(X + 7, Y - 4, 2, 2, "#455a64"); } // コーヒーメーカー
  // 座っている村人の前にはカップ
  if (CAFE_GUESTS[keyOf(tx, 3)]) { rect(X + 6, Y + 1, 4, 3, "#f6efd9"); rect(X + 10, Y + 2, 1, 1, "#f6efd9"); }
}
function drawPottedPlant(X: number, Y: number) {
  rect(X + 5, Y + 10, 6, 5, "#b5523b");
  rect(X + 5, Y + 10, 6, 1, "#93402d");
  rect(X + 3, Y + 2, 10, 8, "#4f8f3a");
  rect(X + 5, Y, 6, 3, "#5e9e4e");
  rect(X + 4, Y + 4, 2, 2, "#7cc35a");
  rect(X + 10, Y + 6, 2, 2, "#7cc35a");
}
function drawCafeTable(X: number, Y: number) {
  rect(X + 7, Y + 10, 2, 5, "#5a3e2b");
  rect(X + 4, Y + 14, 8, 1, "#5a3e2b");
  rect(X + 1, Y + 4, 14, 7, "#a0703f");
  rect(X + 1, Y + 4, 14, 1, "#b8854f");
  rect(X + 1, Y + 10, 14, 1, "#7a5235");
  // カップと湯気
  rect(X + 3, Y + 5, 3, 3, "#f6efd9");
  rect(X + 4, Y + 6, 1, 1, "#6b4a2e");
  rect(X + 10, Y + 5, 3, 3, "#f6efd9");
}
function drawStool(X: number, Y: number) {
  rect(X + 7, Y + 10, 2, 5, "#5a3e2b");
  rect(X + 5, Y + 14, 6, 1, "#5a3e2b");
  rect(X + 3, Y + 7, 10, 4, "#c4473a");
  rect(X + 3, Y + 7, 10, 1, "#e06a5c");
}
function drawChair(X: number, Y: number) {
  rect(X + 3, Y + 2, 10, 3, "#7a5235");
  rect(X + 3, Y + 10, 10, 3, "#8a6a48");
  rect(X + 3, Y + 2, 2, 13, "#5a3e2b");
  rect(X + 11, Y + 2, 2, 13, "#5a3e2b");
}
// 天井から下がるランプのあかり
function drawLamp(X: number, Y: number) {
  rect(X + 7, Y - 16, 1, 10, "#3a2a1e");
  rect(X + 4, Y - 6, 8, 3, "#e2c15a");
  rect(X + 5, Y - 3, 6, 1, "#fff6c2");
}

// 部屋の絵。base は床と壁、rows[y] はその行に置いた家具や村人。
// 村人より下の行にあるものは村人のあとに描いて、手前に重なるようにする
type RoomArt = { base: SkPicture; rows: SkPicture[] };

function cafeArt(): RoomArt {
  const room = ROOMS.cafe.map;
  const cols = room[0].length, rows = room.length;
  const at = (x: number, y: number) => roomTileAt("cafe", x, y);
  const bounds = Skia.XYWHRect(0, -TILE, cols * TILE, (rows + 1) * TILE);
  const base = createPicture((canvas) => {
    cv = canvas;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const X = x * TILE, Y = y * TILE;
        const c = at(x, y);
        if (c === "#") {
          if (y === 0 && x > 0 && x < cols - 1) drawCafeWall(X, Y, x);
          else rect(X, Y, 16, 16, "#2e2219");
        } else {
          drawCafeFloor(X, Y, x, y);
          if (c === "E") drawDoorMat(X, Y);
        }
      }
    }
  }, bounds);
  const rowArt = Array.from({ length: rows }, (_, y) => createPicture((canvas) => {
    cv = canvas;
    for (let x = 0; x < cols; x++) {
      const X = x * TILE, Y = y * TILE;
      const c = at(x, y);
      if (c === "O") drawAnimal(rect, "owl", X, Y + 3);
      if (c === "C") drawCounter(X, Y, x);
      if (c === "P") drawPottedPlant(X, Y);
      if (c === "a") {
        drawChair(X, Y);
        const guest = CAFE_GUESTS[keyOf(x, y)];
        if (guest) drawAnimal(rect, guest, X, Y - 2);
      }
      if (c === "T") { drawCafeTable(X, Y); drawLamp(X, Y); }
      if (c === "s") drawStool(X, Y);
      if (c === "g") {
        // カウンターに向かって座っている村人（後ろ姿）
        drawStool(X, Y);
        const guest = CAFE_GUESTS[keyOf(x, y)];
        if (guest) drawAnimal(rect, guest, X, Y - 6, true);
      }
    }
    // あたたかい明かり（最後の行でまとめて重ねる）
    if (y === rows - 1) rect(0, 0, cols * TILE, rows * TILE, "rgba(255,190,110,0.08)");
  }, bounds));
  return { base, rows: rowArt };
}

// 部屋は画面より小さいので、村人を置く高さに部屋の真ん中を合わせる
function roomCamera(id: RoomId, p: Player, t: number, v: ViewSize) {
  const { fx } = playerPos(p, t);
  const room = ROOMS[id].map;
  const RW = room[0].length * TILE, RH = room.length * TILE;
  const x = RW <= v.w ? (RW - v.w) / 2 : Math.min(Math.max(fx * TILE + TILE / 2 - v.w / 2, 0), RW - v.w);
  return { x: Math.round(x), y: Math.round(RH / 2 - v.h * v.focusY) };
}

function roomFrame(id: RoomId, art: RoomArt, scene: Scene, t: number, v: ViewSize): SkPicture {
  return createPicture((canvas) => {
    cv = canvas;
    rect(0, 0, v.w, v.h, "#1a1612");
    const cam = roomCamera(id, scene.player, t, v);
    canvas.save();
    canvas.translate(-cam.x, -cam.y);
    canvas.drawPicture(art.base);
    // 村人の立っている行までは奥、それより下の行は手前に描く
    const { fy } = playerPos(scene.player, t);
    art.rows.forEach((pic, y) => { if (y <= fy) canvas.drawPicture(pic); });
    // 丸椅子に座っているときは、少し上に描いて腰かけた形にする
    const p = scene.player;
    const seated = roomTileAt(id, p.x, p.y) === "s" && fy === p.y;
    if (seated) { canvas.save(); canvas.translate(0, -6); }
    drawPlayer(p, t);
    if (seated) canvas.restore();
    art.rows.forEach((pic, y) => { if (y > fy) canvas.drawPicture(pic); });
    canvas.restore();
  }, { width: v.w, height: v.h });
}

/* ---------- 1フレーム ---------- */
// 池以外は動かないので、一度だけ描いておく（まわりの森も含める）
function staticLayer(): SkPicture {
  return createPicture((canvas) => {
    cv = canvas;
    for (let y = -MARGIN; y < ROWS + SOUTH_TILES; y++) {
      for (let x = -MARGIN; x < COLS + MARGIN; x++) {
        const X = x * TILE, Y = y * TILE;
        const c = tileAt(x, y);
        if (c === "." || c === "H" || c === "~") drawGrass(X, Y, x, y);
        else if (c === ",") drawSoil(X, Y);
        else if (c === "P") drawPath(X, Y, x, y);
        else if (c === "T") drawTree(X, Y, x, y);
        else if (c === "F") drawFence(X, Y, x, y);
        else if (c === "N") { drawGrass(X, Y, x, y); drawSign(rect, X, Y); }
      }
    }
    BUILDINGS.forEach(drawBuilding);
  }, Skia.XYWHRect(-MARGIN * TILE, -NORTH, W + 2 * MARGIN * TILE, H + NORTH + SOUTH));
}

function frame(base: SkPicture, scene: Scene, t: number, v: ViewSize): SkPicture {
  return createPicture((canvas) => {
    cv = canvas;
    const cam = camera(scene.player, t, v);
    // 画面に入るマスの範囲（はしの半端なマスも含める）
    const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + v.w) / TILE);
    const y0 = Math.floor(cam.y / TILE), y1 = Math.ceil((cam.y + v.h) / TILE);
    const inView = (x: number, y: number) => x >= x0 - 1 && x <= x1 && y >= y0 - 1 && y <= y1;

    canvas.save();
    canvas.translate(-cam.x, -cam.y);
    canvas.drawPicture(base);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = tileAt(x, y);
        if (c === "~") drawWater(x * TILE, y * TILE, x, t);
      }
    }
    // できたことの植物と、今日まだ水やりできる種の 💧（村人が上に立っている種には出さない）
    const p = scene.player;
    let under: PlantVis | null = null;
    for (const pl of scene.plants) {
      if (!inView(pl.x, pl.y)) continue;
      drawPlant(rect, pl.x * TILE, pl.y * TILE, pl.stage, pl.flower);
      if (pl.x === p.x && pl.y === p.y) under = pl;
      else if (pl.drop) drawDrop(rect, pl.x * TILE, pl.y * TILE - 3);
    }
    drawEffects(t);
    drawPlayer(p, t);
    // 種の上に立っているときは、頭の上に今の育ち具合を出す（歩いている途中は出さない）
    if (under && !playerPos(p, t).moving) drawBubble(rect, p.x * TILE, p.y * TILE, under.stage, under.flower);
    canvas.restore();
  }, { width: v.w, height: v.h });
}

// 横に約 VIEW_TILES_ACROSS マス見える倍率。ドットがにじまないよう端末の画素に合わせて丸める
function scaleFor(width: number) {
  const pr = PixelRatio.get();
  return Math.max(1 / pr, Math.round((width / (VIEW_TILES_ACROSS * TILE)) * pr) / pr);
}

// 画面いっぱいに敷くマップ。親が大きさを決める（absoluteFill などで置く）
export function FarmMap({ scene, paused, focusY = 0.5 }: { scene: RefObject<Scene>; paused: boolean; focusY?: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const base = useMemo(() => staticLayer(), []);
  const rooms = useMemo<Record<RoomId, RoomArt>>(() => ({ house: { base: houseLayer(), rows: [] }, cafe: cafeArt() }), []);
  const picture = useSharedValue<SkPicture>(base);
  const scale = size.width ? scaleFor(size.width) : 1;
  const view = useMemo(
    () => ({ w: size.width / scale, h: size.height / scale, focusY }),
    [size.width, size.height, scale, focusY],
  );

  useEffect(() => {
    if (paused || !view.w) return;
    let raf = 0;
    const loop = (t: number) => {
      const sc = scene.current;
      picture.value = sc.area === "farm" ? frame(base, sc, t, view) : roomFrame(sc.area, rooms[sc.area], sc, t, view);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [base, rooms, scene, picture, paused, view]);

  return (
    <View
      style={s.fill}
      onLayout={(e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessibilityLabel="村のマップ"
      accessibilityRole="image"
    >
      {size.width > 0 ? (
        <Canvas style={s.fill}>
          <Group transform={[{ scale }]}>
            <Picture picture={picture} />
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#3e7a3a" },
});
