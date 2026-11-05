import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

import * as db from "./db";
import { getDone } from "./store";

export const REVIEW_AT_BLOOMS = 10; // 花がこの数だけ咲いたら、評価とレビューをお願いする
export const REVIEW_AT_TALKS = 5; // カフェの会話（3問1シリーズ）がこの数になったら、評価とレビューをお願いする

// 3問答えた会話の数。kv はバックアップから戻すと入れ替わるので、端末の AsyncStorage に数える
export const CAFE_TALKS_KEY = "kitsuon-cafe-talks";

// お願いは花とカフェを合わせて一度だけ。OS 標準の評価ダイアログを出す
async function askOnce() {
  if (db.kvGet("reviewAsked") === "1") return;
  if (!(await StoreReview.isAvailableAsync())) return;
  db.kvSet("reviewAsked", "1");
  await StoreReview.requestReview();
}

// 開花の画面を閉じたあとに呼ぶ
export async function maybeAskReview() {
  const blooms = getDone().seeds.filter((s) => s.bloomed).length;
  if (blooms < REVIEW_AT_BLOOMS) return;
  try { await askOnce(); } catch {}
}

// 3問答えた会話で、届けるかどうかを決めたあとに呼ぶ
export async function countCafeTalk() {
  try {
    const talks = (Number(await AsyncStorage.getItem(CAFE_TALKS_KEY)) || 0) + 1;
    await AsyncStorage.setItem(CAFE_TALKS_KEY, String(talks));
    if (talks >= REVIEW_AT_TALKS) await askOnce();
  } catch {}
}
