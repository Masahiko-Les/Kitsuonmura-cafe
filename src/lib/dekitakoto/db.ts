import * as SQLite from "expo-sqlite";

/* =========================================================
   できたことの保存先。このスマホの中だけ（サーバーには送らない）
   ========================================================= */
export type DoneSeed = {
  id: number;
  x: number;
  y: number;
  text: string;
  flower: number; // 0..7
  planted: string; // YYYY-MM-DD
  bloomed: string | null; // 咲いた日。null なら育成中
  waters: string[]; // 水やりした日（古い順）
};
export type NewDoneSeed = Omit<DoneSeed, "id">;

let db: SQLite.SQLiteDatabase | null = null;

const MIGRATIONS: string[] = [
  // v1
  `CREATE TABLE seeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x INTEGER NOT NULL, y INTEGER NOT NULL,
    text TEXT NOT NULL,
    flower INTEGER NOT NULL,
    planted TEXT NOT NULL,
    bloomed TEXT,
    UNIQUE(x, y)
  );
  CREATE TABLE waters (
    seed_id INTEGER NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    PRIMARY KEY (seed_id, date)
  );
  CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT);`,
];

export function openDb() {
  if (db) return db;
  db = SQLite.openDatabaseSync("dekitakoto.db");
  db.execSync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const cur = db.getFirstSync<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0;
  for (let v = cur; v < MIGRATIONS.length; v++) {
    const d = db;
    d.withTransactionSync(() => {
      d.execSync(MIGRATIONS[v]);
      d.execSync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return db;
}

const conn = () => db ?? openDb();

export function loadSeeds(): DoneSeed[] {
  const d = conn();
  const rows = d.getAllSync<Omit<DoneSeed, "waters">>("SELECT id, x, y, text, flower, planted, bloomed FROM seeds ORDER BY id");
  const ws = d.getAllSync<{ seed_id: number; date: string }>("SELECT seed_id, date FROM waters ORDER BY date");
  const map = new Map<number, string[]>();
  for (const w of ws) {
    const a = map.get(w.seed_id);
    if (a) a.push(w.date);
    else map.set(w.seed_id, [w.date]);
  }
  return rows.map((r) => ({ ...r, waters: map.get(r.id) ?? [] }));
}

export function kvGet(key: string): string | null {
  return conn().getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key)?.value ?? null;
}
export function kvSet(key: string, value: string) {
  conn().runSync("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
}

function insert(d: SQLite.SQLiteDatabase, s: NewDoneSeed) {
  const id = d.runSync(
    "INSERT INTO seeds (x, y, text, flower, planted, bloomed) VALUES (?, ?, ?, ?, ?, ?)",
    s.x, s.y, s.text, s.flower, s.planted, s.bloomed,
  ).lastInsertRowId;
  for (const w of s.waters) d.runSync("INSERT INTO waters (seed_id, date) VALUES (?, ?)", id, w);
  return id;
}

export function insertSeed(s: NewDoneSeed): number {
  const d = conn();
  let id = 0;
  d.withTransactionSync(() => { id = insert(d, s); });
  return id;
}

// 水やりを記録し、回数が maxWater に届いたら咲いた日を入れる
export function addWater(id: number, date: string, maxWater: number) {
  const d = conn();
  d.withTransactionSync(() => {
    d.runSync("INSERT INTO waters (seed_id, date) VALUES (?, ?)", id, date);
    const n = d.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM waters WHERE seed_id = ?", id)?.n ?? 0;
    if (n >= maxWater) d.runSync("UPDATE seeds SET bloomed = ? WHERE id = ? AND bloomed IS NULL", date, id);
  });
}

// 咲く前の種だけ抜ける
export function deleteSeed(id: number) {
  conn().runSync("DELETE FROM seeds WHERE id = ? AND bloomed IS NULL", id);
}

// 丸ごと入れ替える（全削除・復元で使う）
export function replaceAll(seeds: NewDoneSeed[], kv: Record<string, string>) {
  const d = conn();
  d.withTransactionSync(() => {
    d.execSync("DELETE FROM waters; DELETE FROM seeds; DELETE FROM kv;");
    for (const s of seeds) insert(d, s);
    for (const [k, v] of Object.entries(kv)) d.runSync("INSERT INTO kv (key, value) VALUES (?, ?)", k, v);
  });
}
