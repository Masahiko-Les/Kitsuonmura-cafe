import { deleteUser, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, type Timestamp, writeBatch, type DocumentReference } from "firebase/firestore";

import { cafeRefsOf } from "./cafe-api";
import { auth, db } from "./firebase";
import { TERMS_VERSION } from "./game";

// 村人の情報とアカウントの操作（サーバーに置くのは、村人名とカフェの言葉だけ。
// 「できたこと」は端末の中だけに保存する：src/lib/dekitakoto）

export type UserDoc = { villagerName: string; termsVersion?: number };

export const millis = (ts?: Timestamp | null) => (ts && ts.toMillis ? ts.toMillis() : Date.now());
export const dateText = (ts?: Timestamp | null) => {
  const d = ts && ts.toDate ? ts.toDate() : new Date();
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

/* ---------- 村人 ---------- */
export async function loadUser(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function registerName(uid: string, name: string) {
  await setDoc(doc(db, "users", uid), { villagerName: name, createdAt: serverTimestamp() });
}

export async function agreeTerms(uid: string, name: string) {
  await setDoc(doc(db, "users", uid), { villagerName: name, termsVersion: TERMS_VERSION, agreedAt: serverTimestamp() }, { merge: true });
}

/* ---------- すべてのデータを削除（サーバー側） ---------- */
async function deleteAll(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
}

export async function deleteEverything(uid: string) {
  await deleteAll(await cafeRefsOf(uid));
  await deleteAll([doc(db, "users", uid)]);

  const user = auth.currentUser;
  if (user && user.uid === uid) {
    try {
      await deleteUser(user);
    } catch (e) {
      // 匿名アカウントは再ログインできないため、消せなかった場合はログアウトだけする
      console.error(e);
      await signOut(auth);
    }
  }
}
