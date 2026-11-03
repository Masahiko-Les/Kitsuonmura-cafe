import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { exportJSON, getDone, restoreBackup } from "./store";

// JSON を書き出して共有シートを開く（「ファイル」に保存など）
export async function shareBackup() {
  const file = new File(Paths.cache, `kitsuonmura-dekitakoto-${getDone().today}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(exportJSON());
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: "バックアップを保存" });
}

// JSON を選んで復元する。'canceled' か 'ok' を返し、読めなければ例外
export async function pickAndRestore(): Promise<"canceled" | "ok"> {
  const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return "canceled";
  const text = await new File(res.assets[0].uri).text();
  restoreBackup(text);
  return "ok";
}
