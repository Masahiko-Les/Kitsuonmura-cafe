export const MAP_ID = "farm01";
export const MAX_WATERERS = 5;
export const MAX_LINES = 10;
export const MAX_CHARS = 300;
export const NAME_MAX = 12;
export const TILE = 16;
export const TERMS_VERSION = 1;

// T=木 .=草 ,=畑 P=道 ~=池 F=柵 H=家 M=郵便受け
// 左上の 16×12 は最初の農場。すでに蒔かれた種の位置がずれないよう、ここは動かさない。
export const MAP = [
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "T..HH....,,,,,....,,,,,,,,,....T",
  "T..HHM...,,,,,....,,,,,,,,,..TTT",
  "T..PP....,,,,,....,,,,,,,,,...TT",
  "T..PPPPPPPPP...PPPPPPPPPPPPPP..T",
  "T.~~.....P.....T....P.......P..T",
  "T.~~..,,,P,,,..T.,,,P,,,,,,.P..T",
  "T.....,,,P,,,..T.,,,P,,,,,,.P..T",
  "T.FFF.,,,P,,,....,,,P,,,,,,.P..T",
  "T.....PPPP..........P.......P..T",
  "T......P......T.....PPPPPPPPP.TT",
  "TTTTTTTP...TTTT.....P........TTT",
  "T......P............P..........T",
  "T.~~~~.P..,,,,,.....P..,,,,,,..T",
  "T.~~~~.P..,,,,,.....P..,,,,,,..T",
  "T.~~~~.PPPPPPPPPPPPPP..,,,,,,..T",
  "T......P............P..........T",
  "T.FFFF.P.,,,,,,..TT.P.,,,,,,,..T",
  "T......P.,,,,,,..TT.P.,,,,,,,..T",
  "T..T...P.,,,,,,.....P.,,,,,,,..T",
  "T.TTT..P............P......TT..T",
  "T..T...PPPPPPPPPPPPPP......TT..T",
  "T..............................T",
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
];
export const COLS = MAP[0].length;
export const ROWS = MAP.length;
// 画面に映す広さ。カメラが村人を追いかける
export const VIEW_COLS = 16;
export const VIEW_ROWS = 12;
export const WALKABLE = new Set([".", ",", "P"]);
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

export const tileAt = (x: number, y: number) => (MAP[y] && MAP[y][x]) || "T";
export const keyOf = (x: number, y: number) => `${x}_${y}`;
