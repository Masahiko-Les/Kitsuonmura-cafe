// カフェの回答の長さ
export const MAX_LINES = 10;
export const MAX_CHARS = 300;
export const NAME_MAX = 12;
export const TILE = 16;
export const TERMS_VERSION = 3; // 2: 吃音村カフェを追加 / 3: 種と手紙のやり取りをやめ、「できたこと」を追加

// 村のマップ（20×20）。T=木 .=草 ,=畑 P=道 ~=池 H=建物 N=看板（あそびかた）
// まわりは木で囲み、マップの外もずっと森が続く
export const MAP = [
  "TTTTTTTTTTTTTTTTTTTT",
  "TT...T.......T...TTT",
  "T..HH....HHH.......T",
  "T..HHN...HHH...~~..T",
  "T..P......P....~~..T",
  "T..PPPPPPPPPPPPP...T",
  "T.........P........T",
  "T.,,,,,...P..,,,,,.T",
  "T.,,,,,...P..,,,,,.T",
  "T.,,,,,...P..,,,,,.T",
  "TT........P.......TT",
  "T..T......P...T....T",
  "T.....PPPPPPPP.....T",
  "T.....P......P.....T",
  "T.~~~.P.,,,,.P.,,,.T",
  "T.~~~.P.,,,,.P.,,,.T",
  "T.....P......P.....T",
  "T.T...PPPPPPPP...T.T",
  "TT.......T.......TTT",
  "TTTTTTTTTTTTTTTTTTTT",
];
export const COLS = MAP[0].length;
export const ROWS = MAP.length;
// 画面に横に何マス見せるか（縦は画面の高さで決まる）。カメラが村人を追いかける
export const VIEW_TILES_ACROSS = 7.5;
export const WALKABLE = new Set([".", ",", "P"]);
export const SOWABLE = new Set([".", ","]);
// 村に入ったときに立つ場所（カフェの前の道）
export const START = { x: 10, y: 6 };

export type Dir = "up" | "down" | "left" | "right";
export const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// マップの外は森
export const tileAt = (x: number, y: number) => (MAP[y] && MAP[y][x]) || "T";

// 建物。door は扉のマス（建物のいちばん下の行）。村人は扉の1つ下のマスから、上を向いて入る
export type Building = {
  id: string; name: string; x: number; y: number; w: number; h: number; door: { x: number; y: number }; enterable: boolean;
};
export const BUILDINGS: Building[] = [
  { id: "house", name: "家", x: 3, y: 2, w: 2, h: 2, door: { x: 3, y: 3 }, enterable: true },
  { id: "cafe", name: "カフェ", x: 9, y: 2, w: 3, h: 2, door: { x: 10, y: 3 }, enterable: true },
];
export const buildingAt = (x: number, y: number) =>
  BUILDINGS.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;

// いま村人がいる場所。村（farm）か、建物の中（建物の id と同じ）
export type RoomId = "house" | "cafe";
export type Area = "farm" | RoomId;

// 建物の中。どの部屋も #=壁 .=床 E=出入り口（下へ歩くと外に出る）
export type Room = {
  map: string[];
  entry: { x: number; y: number }; // 入ったときに立つマス（出入り口の1つ上）
  walkable: Set<string>;
};
export const ROOMS: Record<RoomId, Room> = {
  // 自分の家。K=本棚 B=ベッド L=テーブル
  house: {
    map: [
      "########",
      "#KK...B#",
      "#.....B#",
      "#..LL..#",
      "#......#",
      "#......#",
      "###E####",
    ],
    entry: { x: 3, y: 5 },
    walkable: new Set([".", "E"]),
  },
  // 吃音村カフェ。b=カウンターの内側 O=マスター C=バーカウンター s=空いている丸椅子 g=村人が座っている丸椅子
  // P=鉢植え T=テーブル a=村人が座っている椅子。空いている丸椅子に向かってAを押すと座れる
  cafe: {
    map: [
      "##############",
      "#bbbbbObbbbbP#",
      "#CCCCCCCCCCC.#",
      "#sgsgssgssgs.#",
      "#............#",
      "#..aT.....aT.#",
      "#............#",
      "#P.aT.....aT.#",
      "#............#",
      "#............#",
      "######E#######",
    ],
    entry: { x: 6, y: 9 },
    walkable: new Set([".", "E"]),
  },
};
export const roomTileAt = (room: RoomId, x: number, y: number) => {
  const m = ROOMS[room].map;
  return (m[y] && m[y][x]) || "#";
};
// カフェに座っている村人（カウンター席とテーブル席）
export const CAFE_GUESTS: Record<string, string> = {
  "2_3": "rabbit", "4_3": "tanuki", "7_3": "cat", "10_3": "dog",
  "3_5": "sheep", "10_5": "fox", "3_7": "dog", "10_7": "rabbit",
};

export const keyOf = (x: number, y: number) => `${x}_${y}`;
