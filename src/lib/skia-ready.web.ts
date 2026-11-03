// Web 版（ブラウザで動作確認するとき）だけ、Skia の描画エンジン（public/canvaskit.wasm）を先に読み込む
// @ts-ignore 型定義のない内部パス
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

export const loadSkia = (): Promise<void> => LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
