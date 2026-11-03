import * as StoreReview from "expo-store-review";

import * as db from "./db";
import { getDone } from "./store";

export const REVIEW_AT_BLOOMS = 10; // 花がこの数だけ咲いたら、評価とレビューをお願いする

// 開花の画面を閉じたあとに呼ぶ。条件を満たしたら一度だけ、OS 標準の評価ダイアログを出す
export async function maybeAskReview() {
  const blooms = getDone().seeds.filter((s) => s.bloomed).length;
  if (blooms < REVIEW_AT_BLOOMS || db.kvGet("reviewAsked") === "1") return;
  try {
    if (!(await StoreReview.isAvailableAsync())) return;
    db.kvSet("reviewAsked", "1");
    await StoreReview.requestReview();
  } catch {}
}
