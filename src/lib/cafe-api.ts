import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, type Query, type Timestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";

import { MAX_VOICES, type ReactionId, questionById } from "./cafe";
import { db } from "./firebase";

/* =========================================================
   吃音村カフェの回答と、届いた気持ち
   - 回答は名前を持たない（匿名）。紹介するときは動物の姿だけを出す。
   - 「届けてもよい」を選んだ回答は pending で保存し、運営が確認して public に変えたものだけが、ほかの村人に届く。
   - 危機的な言葉を含む回答は review で保存し、誰にも届かない。
   ========================================================= */

// 通報して隠した回答（端末に保存）
export const CAFE_HIDDEN_KEY = "kitsuon-cafe-hidden";

export type CafeStatus = "pending" | "public" | "private" | "review";

export type CafeAnswer = {
  id: string;
  uid: string;
  themeId: string;
  questionId: string;
  text: string;
  animal: string;
  status: CafeStatus;
  createdAt?: Timestamp | null;
};

export type CafeReaction = {
  id: string;
  answerId: string;
  toUid: string;
  fromUid: string;
  kind: ReactionId;
  createdAt?: Timestamp | null;
};

// 画面に出す「ほかの村人の言葉」。sample はお手本（運営が用意した文章）
export type Voice = { key: string; animal: string; text: string; sample: boolean; answer?: CafeAnswer };

export async function saveAnswer(a: Omit<CafeAnswer, "id" | "createdAt">) {
  const ref = doc(collection(db, "cafeAnswers"));
  await setDoc(ref, { ...a, createdAt: serverTimestamp() });
  return ref.id;
}

// 同じ質問への、ほかの村人の公開済みの言葉。足りないぶんはお手本で補う
export async function loadVoices(questionId: string, uid: string, hidden: Set<string>): Promise<Voice[]> {
  let real: Voice[] = [];
  try {
    const snap = await getDocs(query(
      collection(db, "cafeAnswers"),
      where("questionId", "==", questionId),
      where("status", "==", "public"),
      limit(30),
    ));
    real = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as CafeAnswer)
      .filter((a) => a.uid !== uid && !hidden.has(a.id))
      .map((a) => ({ key: a.id, animal: a.animal, text: a.text, sample: false, answer: a }));
  } catch (e) {
    console.error("cafe voices", e);
  }
  shuffle(real);
  const samples: Voice[] = (questionById(questionId)?.question.samples ?? [])
    .map((s, i) => ({ key: `sample-${questionId}-${i}`, animal: s.animal, text: s.text, sample: true }));
  return [...real, ...samples].slice(0, MAX_VOICES);
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ---------- 気持ちを届ける（1つの言葉に1人1つ。あとから選び直せる） ---------- */
export async function sendReaction(uid: string, answer: CafeAnswer, kind: ReactionId) {
  await setDoc(doc(db, "cafeReactions", `${answer.id}_${uid}`), {
    answerId: answer.id,
    toUid: answer.uid,
    fromUid: uid,
    kind,
    createdAt: serverTimestamp(),
  });
}

/* ---------- わたしの言葉 ---------- */
export async function loadMyAnswers(uid: string): Promise<CafeAnswer[]> {
  const snap = await getDocs(query(collection(db, "cafeAnswers"), where("uid", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CafeAnswer);
}

export async function loadReactionsToMe(uid: string): Promise<CafeReaction[]> {
  const snap = await getDocs(query(collection(db, "cafeReactions"), where("toUid", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CafeReaction);
}

export async function makePrivate(answerId: string) {
  await updateDoc(doc(db, "cafeAnswers", answerId), { status: "private" });
}

export async function deleteAnswer(answerId: string) {
  await deleteDoc(doc(db, "cafeAnswers", answerId));
}

/* ---------- 通報 ---------- */
export async function reportAnswer(uid: string, answerId: string) {
  const b = writeBatch(db);
  b.set(doc(collection(db, "reports")), { targetType: "cafeAnswer", targetId: answerId, reporterUid: uid, createdAt: serverTimestamp() });
  await b.commit();
}

/* ---------- すべてのデータを削除（farm-api の deleteEverything から呼ぶ） ---------- */
export async function cafeRefsOf(uid: string) {
  const refs = async (q: Query) => (await getDocs(q)).docs.map((d) => d.ref);
  return [
    ...(await refs(query(collection(db, "cafeReactions"), where("fromUid", "==", uid)))),
    ...(await refs(query(collection(db, "cafeReactions"), where("toUid", "==", uid)))),
    ...(await refs(query(collection(db, "cafeAnswers"), where("uid", "==", uid)))),
  ];
}

/* =========================================================
   運営用（admins/{uid} に登録された人だけが使える。ルールで守っている）
   ========================================================= */
export type CafeReport = { id: string; targetId: string; reporterUid: string; handled?: boolean; createdAt?: Timestamp | null };

export async function loadPending(): Promise<CafeAnswer[]> {
  const snap = await getDocs(query(collection(db, "cafeAnswers"), where("status", "==", "pending")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CafeAnswer);
}

export async function setAnswerStatus(answerId: string, status: "public" | "private") {
  await updateDoc(doc(db, "cafeAnswers", answerId), { status });
}

// まだ確認していない、カフェの言葉への通報。回答ごとにまとめる
export async function loadOpenReports(): Promise<{ answer: CafeAnswer | null; targetId: string; reports: CafeReport[] }[]> {
  const snap = await getDocs(query(collection(db, "reports"), where("targetType", "==", "cafeAnswer")));
  const open = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CafeReport)
    .filter((r) => !r.handled);
  const byTarget = new Map<string, CafeReport[]>();
  for (const r of open) byTarget.set(r.targetId, [...(byTarget.get(r.targetId) ?? []), r]);
  return Promise.all([...byTarget.entries()].map(async ([targetId, reports]) => {
    const a = await getDoc(doc(db, "cafeAnswers", targetId));
    return { targetId, reports, answer: a.exists() ? ({ id: a.id, ...a.data() } as CafeAnswer) : null };
  }));
}

export async function markReportsHandled(reportIds: string[]) {
  const b = writeBatch(db);
  reportIds.forEach((id) => b.update(doc(db, "reports", id), { handled: true, handledAt: serverTimestamp() }));
  await b.commit();
}

export async function adminDeleteAnswer(answerId: string) {
  await deleteDoc(doc(db, "cafeAnswers", answerId));
}
