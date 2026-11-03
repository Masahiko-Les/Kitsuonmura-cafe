import { useSyncExternalStore } from "react";

import { COLS, ROWS, SOWABLE, buildingAt, tileAt } from "../game";
import { DONE_MAX_CHARS, DONE_MAX_LINES, FLOWERS, MAX_WATER } from "./constants";
import { DATE_RE, todayStr } from "./date";
import * as db from "./db";
import type { DoneSeed, NewDoneSeed } from "./db";

export type { DoneSeed };

type DoneState = {
  seeds: DoneSeed[];
  dayOffset: number; // 開発用（リリース版では常に 0 として扱う）
  today: string;
};

let state: DoneState;
const listeners = new Set<() => void>();
const emit = (next: Partial<DoneState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
const offsetOf = (n: number) => (__DEV__ ? n : 0);

// 種を蒔ける場所（草地と畑。道・木・池・建物には蒔けない）
export const plantable = (x: number, y: number) => SOWABLE.has(tileAt(x, y)) && !buildingAt(x, y);

export function initDone() {
  if (state) return;
  db.openDb();
  const dayOffset = Number(db.kvGet("dayOffset") ?? 0) || 0;
  state = { seeds: db.loadSeeds(), dayOffset, today: todayStr(offsetOf(dayOffset)) };
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function useDone() {
  return useSyncExternalStore(subscribe, () => state);
}
export const getDone = () => state;

const reload = () => ({ seeds: db.loadSeeds() });

/* ---------- 判定 ---------- */
export const canWater = (s: DoneSeed, today: string) => !s.bloomed && s.waters.length < MAX_WATER && !s.waters.includes(today);
export const doneSeedAt = (seeds: DoneSeed[], x: number, y: number) => seeds.find((s) => s.x === x && s.y === y);

/* ---------- 操作 ---------- */
// 日付が変わっていたら更新（アプリに戻ってきたとき・定期的に呼ぶ）
export function refreshToday() {
  const t = todayStr(offsetOf(state.dayOffset));
  if (t !== state.today) emit({ today: t });
}

export function plantSeed(x: number, y: number, text: string): DoneSeed | null {
  if (!plantable(x, y) || doneSeedAt(state.seeds, x, y)) return null;
  const s: NewDoneSeed = {
    x, y, text,
    flower: Math.floor(Math.random() * FLOWERS.length),
    planted: state.today,
    bloomed: null,
    waters: [],
  };
  const id = db.insertSeed(s);
  emit(reload());
  return { ...s, id };
}

export function waterSeed(id: number): DoneSeed | null {
  const s = state.seeds.find((v) => v.id === id);
  if (!s || !canWater(s, state.today)) return null;
  db.addWater(id, state.today, MAX_WATER);
  emit(reload());
  return state.seeds.find((v) => v.id === id) ?? null;
}

export function pullSeed(id: number) {
  db.deleteSeed(id);
  emit(reload());
}

export function setDayOffset(n: number) {
  if (!__DEV__) return;
  db.kvSet("dayOffset", String(n));
  emit({ dayOffset: n, today: todayStr(n) });
}

// 入れ替えても残すもの（評価のお願いを一度出したかどうか）
function keptKv(): Record<string, string> {
  return db.kvGet("reviewAsked") === "1" ? { reviewAsked: "1" } : {};
}

export function deleteAllDone() {
  db.replaceAll([], keptKv());
  emit({ seeds: [], dayOffset: 0, today: todayStr(0) });
}

/* ---------- バックアップ ---------- */
export const BACKUP_VERSION = 1;

export function exportJSON() {
  return JSON.stringify({
    app: "kitsuonmura-cafe",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    seeds: state.seeds.map(({ x, y, text, flower, planted, bloomed, waters }) => ({ x, y, text, flower, planted, bloomed, waters })),
  }, null, 2);
}

// 中身をすべて確かめてから NewDoneSeed[] に直す。おかしければ例外を投げる
export function parseBackup(json: string): NewDoneSeed[] {
  const d = JSON.parse(json);
  const fail = (why: string): never => { throw new Error(why); };
  if (!d || typeof d !== "object" || !Array.isArray(d.seeds)) fail("形式が違います");
  if (typeof d.version !== "number" || d.version > BACKUP_VERSION) fail("対応していないバージョンです");
  const used = new Set<string>();
  return d.seeds.map((s: any): NewDoneSeed => {
    if (!s || typeof s !== "object") fail("種の形式が違います");
    const { x, y, text, flower, planted, bloomed, waters } = s;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= COLS || y >= ROWS) fail("位置が違います");
    if (!plantable(x, y)) fail("種を蒔けない場所です");
    if (used.has(`${x}_${y}`)) fail("同じ場所に2つの種があります");
    used.add(`${x}_${y}`);
    if (typeof text !== "string" || !text.trim() || text.length > DONE_MAX_CHARS || text.split("\n").length > DONE_MAX_LINES) fail("文章が違います");
    if (!Number.isInteger(flower) || flower < 0 || flower >= FLOWERS.length) fail("花の種類が違います");
    if (typeof planted !== "string" || !DATE_RE.test(planted)) fail("植えた日が違います");
    if (!Array.isArray(waters) || waters.length > 31) fail("水やりの記録が違います");
    const ws: string[] = [...new Set<string>(waters)].sort();
    if (ws.length !== waters.length || ws.some((w) => typeof w !== "string" || !DATE_RE.test(w))) fail("水やりの記録が違います");
    if (bloomed !== null && bloomed !== undefined && (typeof bloomed !== "string" || !DATE_RE.test(bloomed))) fail("咲いた日が違います");
    const bl: string | null = bloomed ?? null;
    if ((ws.length >= MAX_WATER) !== (bl !== null)) fail("咲いた記録が合いません");
    return { x, y, text, flower, planted, bloomed: bl, waters: ws };
  });
}

export function restoreBackup(json: string) {
  const seeds = parseBackup(json);
  const kv: Record<string, string> = { ...keptKv() };
  if (__DEV__ && state.dayOffset) kv.dayOffset = String(state.dayOffset);
  db.replaceAll(seeds, kv);
  emit(reload());
}
