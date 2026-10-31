import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebaseコンソール > プロジェクトの設定 > マイアプリ で表示される値に置き換えてください。
// この値は公開されても問題ありません（守りは firestore.rules で行います）。
export const firebaseConfig = {
  apiKey: "AIzaSyCw70CqCojGGuUSrdC50oCGz1bxWyXO1y4",
  authDomain: "kitsuonnojo.firebaseapp.com",
  projectId: "kitsuonnojo",
  storageBucket: "kitsuonnojo.firebasestorage.app",
  messagingSenderId: "706557087517",
  appId: "1:706557087517:web:6a65cf1896c595a4b15bf4",
  measurementId: "G-WP9W0Q6JZZ",
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
