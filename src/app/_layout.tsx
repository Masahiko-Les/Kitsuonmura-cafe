import { DotGothic16_400Regular } from "@expo-google-fonts/dotgothic16";
import { KleeOne_400Regular, KleeOne_600SemiBold } from "@expo-google-fonts/klee-one";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ModalHost } from "@/components/modal-host";
import { ToastProvider } from "@/components/toast";
import { initDone } from "@/lib/dekitakoto/store";
import { loadSkia } from "@/lib/skia-ready";
import { FarmProvider } from "@/state/farm";
import { C, F } from "@/theme";

SplashScreen.preventAutoHideAsync();
// 「できたこと」の保存先（端末の中の SQLite）を開く
initDone();

export default function RootLayout() {
  const [loaded, error] = useFonts({ DotGothic16_400Regular, KleeOne_400Regular, KleeOne_600SemiBold });
  // Web 版では Skia の読み込みを待つ（iPhone ではすぐ終わる）
  const [skiaReady, setSkiaReady] = useState(false);
  useEffect(() => {
    loadSkia().then(() => setSkiaReady(true)).catch((e) => { console.error(e); setSkiaReady(true); });
  }, []);

  useEffect(() => {
    if ((loaded || error) && skiaReady) SplashScreen.hideAsync();
  }, [loaded, error, skiaReady]);

  if ((!loaded && !error) || !skiaReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.moss }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ToastProvider>
          <FarmProvider>
            <ModalHost>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: C.mossDeep },
                  headerTintColor: C.text,
                  headerTitleStyle: { fontFamily: F.ui },
                  headerBackButtonDisplayMode: "minimal",
                  contentStyle: { backgroundColor: C.moss },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="settings" options={{ title: "設定" }} />
                <Stack.Screen name="help" options={{ title: "あそびかた" }} />
                <Stack.Screen name="terms" options={{ title: "利用規約" }} />
                <Stack.Screen name="contact" options={{ title: "運営への連絡" }} />
                <Stack.Screen name="cafe" options={{ title: "吃音村カフェ" }} />
                <Stack.Screen name="cafe-mine" options={{ title: "わたしの言葉" }} />
                <Stack.Screen name="cafe-admin" options={{ title: "運営：カフェの確認" }} />
              </Stack>
            </ModalHost>
          </FarmProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
