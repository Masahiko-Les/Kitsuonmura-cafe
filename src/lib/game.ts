export const MAP_ID = "farm01";
export const MAX_WATERERS = 5;
export const MAX_LINES = 10;
export const MAX_CHARS = 300;
export const NAME_MAX = 12;
export const TILE = 16;
export const TERMS_VERSION = 1;

// S=海 D=砂漠 W=砂嵐 T=木 .=草 ,=畑 P=道 ~=池 F=柵 H=建物 M=郵便受け
// 左上の 16×12 は最初の農場。すでに蒔かれた種の位置がずれないよう、ここは動かさない。
export const MAP = [
  "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
  "S..HH....,,,,,....,,,,.HHHH....S",
  "S..HHM...,,,,,.HHH,,,,.HHHH..TTS",
  "S..PP....,,,,,.HHH,,,,.HHHH...TS",
  "S..PPPPPPPPP...PPPPPPPPPPPPPP..S",
  "S.~~.....P.....T....P.......P..S",
  "S.~~..,,,P,,,..T.,,,P,,,,,,.P..S",
  "S.....,,,P,,,..T.,,,P,,,,,,.P..S",
  "S.FFF.,,,P,,,....,,,P,,,,,,.P..S",
  "S.....PPPP..........P.......P..S",
  "S......P......T.....PPPPPPPPP.TS",
  "STTTTTTP...TTTT.....P........TTS",
  "S......P............P..........S",
  "S.~~~~.P..,,,,,.HHH.P..,,,,,,..S",
  "S.~~~~.P..,,,,,.HHH.P..,,,,,,..S",
  "S.~~~~.PPPPPPPPPPPPPP..,,,,,,..S",
  "S......P............P..........S",
  "S.FFFF.P.,,,,,,..TT.P.,,,,,,,..S",
  "S......P.,,,,,,..TT.P.,,,,,,,..S",
  "S..T...P.,,,,,,.....P.,,,,,,,..S",
  "S.TTT..P............P......TT..S",
  "S..T...PPPPPPPPPPPPPP......TT..S",
  "S..............................S",
  "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
];
export const COLS = MAP[0].length;
export const ROWS = MAP.length;
// 画面に映す広さ。カメラが村人を追いかける
export const VIEW_COLS = 16;
export const VIEW_ROWS = 12;
// 北の砂漠の奥行き。島の北端（y=1）から北へこのマス数だけ歩け、その先は砂嵐で進めない
export const DESERT_DEPTH = 10;
export const WALKABLE = new Set([".", ",", "P", "D"]);
// 砂漠（D）には今は蒔けない。将来、砂漠用の別の種を蒔けるようにする予定
export const SOWABLE = new Set([".", ","]);

export const CROPS = [
  { id: "tomato", name: "トマト", emoji: "🍅" },
  { id: "carrot", name: "にんじん", emoji: "🥕" },
  { id: "eggplant", name: "なす", emoji: "🍆" },
  { id: "cucumber", name: "きゅうり", emoji: "🥒" },
  { id: "corn", name: "とうもろこし", emoji: "🌽" },
  { id: "potato", name: "じゃがいも", emoji: "🥔" },
  { id: "pepper", name: "ピーマン", emoji: "🫑" },
  { id: "pumpkin", name: "かぼちゃ", emoji: "🎃" },
  { id: "strawberry", name: "いちご", emoji: "🍓" },
  { id: "cabbage", name: "はくさい", emoji: "🥬" },
] as const;
export type Crop = (typeof CROPS)[number];
export const cropById = (id: string): Crop => CROPS.find((c) => c.id === id) ?? CROPS[0];
export const randomCrop = (): Crop => CROPS[Math.floor(Math.random() * CROPS.length)];

export type Dir = "up" | "down" | "left" | "right";
export const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// マップの北には砂漠と砂嵐が続き、それ以外の外はずっと海
export const tileAt = (x: number, y: number) => {
  if (y < 0 && x >= 0 && x < COLS) return y > -DESERT_DEPTH ? "D" : "W";
  return (MAP[y] && MAP[y][x]) || "S";
};

// 建物。いまは入れない。将来は enterable を true にして中の画面を作る
export type Building = { id: string; name: string; x: number; y: number; w: number; h: number; enterable: boolean };
export const BUILDINGS: Building[] = [
  { id: "house", name: "家", x: 3, y: 1, w: 2, h: 2, enterable: false },
  { id: "cafe", name: "カフェ", x: 15, y: 2, w: 3, h: 2, enterable: false },
  { id: "hall", name: "村役場", x: 23, y: 1, w: 4, h: 3, enterable: false },
  { id: "library", name: "図書館", x: 16, y: 13, w: 3, h: 2, enterable: false },
];
export const buildingAt = (x: number, y: number) =>
  BUILDINGS.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;
export const keyOf = (x: number, y: number) => `${x}_${y}`;
