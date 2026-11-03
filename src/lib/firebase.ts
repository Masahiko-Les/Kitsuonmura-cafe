import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebaseコンソール > プロジェクトの設定 > マイアプリ で表示される値に置き換えてください。
// この値は公開されても問題ありません（守りは firestore.rules で行います）。
export const firebaseConfig = {
  apiKey: "AIzaSyAcZ0oai5ngynNuNEcBvtQUD_U6vZn09Bc",
  authDomain: "kitsuon-village.firebaseapp.com",
  projectId: "kitsuon-village",
  storageBucket: "kitsuon-village.firebasestorage.app",
  messagingSenderId: "184996264366",
  appId: "1:184996264366:web:fae51c8575cf1eb5bc303f",
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function makeAuth(): Auth {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // 開発中のリロードで二重に初期化したとき
    return getAuth(app);
  }
}

export const auth = makeAuth();
export const db = getFirestore(app);
