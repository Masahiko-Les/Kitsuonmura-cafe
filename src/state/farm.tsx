import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { CAFE_HIDDEN_KEY } from "@/lib/cafe-api";
import { CAFE_TALKS_KEY } from "@/lib/dekitakoto/review";
import { deleteAllDone } from "@/lib/dekitakoto/store";
import { agreeTerms, deleteEverything, loadUser, registerName } from "@/lib/farm-api";
import { auth, db, isConfigured } from "@/lib/firebase";
import { TERMS_VERSION } from "@/lib/game";

export type Phase = "loading" | "error" | "name" | "terms" | "ready";

type FarmState = {
  phase: Phase;
  errorMessage: string;
  uid: string;
  name: string;
  isAdmin: boolean; // 運営（admins/{uid} がある）
  register: (name: string) => Promise<void>;
  agree: () => Promise<void>;
  deleteAllData: () => Promise<void>;
};

const FarmContext = createContext<FarmState | null>(null);
export function useFarm() {
  const v = useContext(FarmContext);
  if (!v) throw new Error("FarmProvider がありません");
  return v;
}

// 村人（匿名ログイン・村人名・規約同意・運営かどうか）
export function FarmProvider({ children }: { children: ReactNode }) {
  // Firebase の設定値が未入力のあいだは、保存なしでマップだけ歩ける
  const [phase, setPhase] = useState<Phase>(isConfigured ? "loading" : "ready");
  const [errorMessage, setErrorMessage] = useState("");
  const [uid, setUid] = useState(isConfigured ? "" : "offline");
  const [name, setName] = useState(isConfigured ? "" : "おためし");
  const [isAdmin, setIsAdmin] = useState(false);

  // 匿名ログインと村人情報
  useEffect(() => {
    if (!isConfigured) return;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPhase("loading");
        setUid("");
        setName("");
        try { await signInAnonymously(auth); } catch (e) {
          setErrorMessage("ログインできませんでした。Firebaseの設定（匿名認証）を確認してください。");
          setPhase("error");
          console.error(e);
        }
        return;
      }
      try {
        const u = await loadUser(user.uid);
        setUid(user.uid);
        setName(u?.villagerName ?? "");
        setPhase(!u ? "name" : (u.termsVersion ?? 0) < TERMS_VERSION ? "terms" : "ready");
      } catch (e) {
        setErrorMessage("読み込めませんでした。Firebaseの設定を確認してください。");
        setPhase("error");
        console.error(e);
      }
    });
  }, []);

  // 運営かどうか
  useEffect(() => {
    if (phase !== "ready" || !uid || !isConfigured) return;
    const unsub = onSnapshot(doc(db, "admins", uid), (snap) => setIsAdmin(snap.exists()), (e) => console.error("admin", e));
    return () => { unsub(); setIsAdmin(false); };
  }, [phase, uid]);

  const register = useCallback(async (n: string) => {
    await registerName(uid, n);
    setName(n);
    setPhase("terms");
  }, [uid]);

  const agree = useCallback(async () => {
    await agreeTerms(uid, name);
    setPhase("ready");
  }, [uid, name]);

  // すべてのデータを削除。サーバーのデータとアカウントを消し、端末の「できたこと」も消す。
  // そのあと新しい匿名アカウントで最初からになる。
  const deleteAllData = useCallback(async () => {
    const current = uid;
    setPhase("loading");
    try {
      await deleteEverything(current);
    } catch (e) {
      setPhase("ready");
      throw e;
    }
    deleteAllDone();
    await AsyncStorage.multiRemove([CAFE_HIDDEN_KEY, CAFE_TALKS_KEY]).catch(() => {});
  }, [uid]);

  const value: FarmState = { phase, errorMessage, uid, name, isAdmin, register, agree, deleteAllData };
  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}
