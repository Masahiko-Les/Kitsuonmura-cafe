// できたこと（自分で蒔いて、自分で水やりする種）の設定。できたこと農園と同じ値
export const MAX_WATER = 3; // 何回水やりで花が咲くか
export const WATER_MS = 3000; // 水やり中に、できたことを表示する時間
export const DONE_MAX_LINES = 3;
export const DONE_MAX_CHARS = 80;

export type Flower = { name: string; petal: string; dark: string; center: string };
export const FLOWERS: Flower[] = [
  { name: "ひまわり", petal: "#f4c430", dark: "#d9a514", center: "#7a4a12" },
  { name: "チューリップ", petal: "#e2483d", dark: "#b8322a", center: "#f6d36b" },
  { name: "コスモス", petal: "#f29cc0", dark: "#d67199", center: "#f4c430" },
  { name: "あさがお", petal: "#4f7fe0", dark: "#3559b0", center: "#f6f0dc" },
  { name: "すみれ", petal: "#9b6ad6", dark: "#7447ad", center: "#f6d36b" },
  { name: "マリーゴールド", petal: "#f08a24", dark: "#c96812", center: "#a3420f" },
  { name: "デイジー", petal: "#fbfbf2", dark: "#d8d8c8", center: "#f4c430" },
  { name: "ネモフィラ", petal: "#8ec8f0", dark: "#5ea6d6", center: "#ffffff" },
];
