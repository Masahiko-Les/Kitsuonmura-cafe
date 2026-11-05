import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useToast } from "@/components/toast";
import { SectionLabel, Small, T } from "@/components/ui";
import { pickAndRestore, shareBackup } from "@/lib/dekitakoto/backup";
import { jpY } from "@/lib/dekitakoto/date";
import { setDayOffset, useDone } from "@/lib/dekitakoto/store";
import { OPERATOR } from "@/lib/safety";
import { useFarm } from "@/state/farm";
import { C } from "@/theme";

export default function Settings() {
  const { deleteAllData, uid, isAdmin } = useFarm();
  const toast = useToast();
  const { today, dayOffset } = useDone();
  const [busy, setBusy] = useState(false);

  const restore = () => {
    Alert.alert("バックアップから戻す", "保存しておいたバックアップのファイル（.json）を選んでください。今の「できたこと」は上書きされます。", [
      { text: "やめる", style: "cancel" },
      {
        text: "ファイルを選ぶ",
        onPress: async () => {
          try {
            if ((await pickAndRestore()) === "ok") toast("✅ バックアップから戻しました");
          } catch (e) {
            console.error(e);
            toast("⚠ 読み込めませんでした。バックアップファイルか確認してください。");
          }
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      "すべてのデータを削除",
      "カフェで残した言葉、届いた気持ち、「できたこと」の種と花、村人名をすべて消し、アカウントも削除します。元には戻せません。",
      [
        { text: "やめる", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              router.dismissAll();
              await deleteAllData();
              toast("すべてのデータを削除しました。");
            } catch (e) {
              setBusy(false);
              toast("削除できませんでした。通信を確認して、もう一度試してください。");
              console.error(e);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Row label="あそびかた" onPress={() => router.push("/help")} />
      <Row label="利用規約" onPress={() => router.push("/terms")} />
      <Row label="プライバシーポリシー" onPress={() => Linking.openURL(OPERATOR.privacyUrl).catch(() => toast("⚠ ページを開けませんでした。"))} />
      <Row label="運営への連絡" onPress={() => router.push("/contact")} />

      <SectionLabel>「できたこと」のバックアップ</SectionLabel>
      <Small>「できたこと」はこのスマホの中にだけ保存されています。アプリの削除や機種変更で消えるので、ときどきバックアップを保存しておくと安心です。</Small>
      <View style={{ height: 8 }} />
      <Row label="バックアップを保存" onPress={() => shareBackup().catch(() => toast("⚠ バックアップを書き出せませんでした。"))} />
      <Row label="バックアップから戻す" onPress={restore} />
      {__DEV__ ? (
        <>
          <SectionLabel>お試し用（開発中だけ表示）</SectionLabel>
          <Small>{`日付を進めて、水やり〜開花までを今すぐ試せます。\n現在の日付扱い：${jpY(today)}${dayOffset ? `（+${dayOffset}日）` : ""}`}</Small>
          <View style={{ height: 8 }} />
          <Row label="日付を1日進める" onPress={() => setDayOffset(dayOffset + 1)} />
          {dayOffset ? <Row label="本当の日付に戻す" onPress={() => setDayOffset(0)} /> : null}
        </>
      ) : null}
      {isAdmin ? (
        <>
          <View style={{ height: 24 }} />
          <Row label="運営：カフェの言葉の確認" onPress={() => router.push("/cafe-admin")} />
        </>
      ) : null}
      <View style={{ height: 24 }} />
      <Row label="すべてのデータを削除" danger onPress={confirmDelete} disabled={busy} />
      <Small>カフェの言葉・「できたこと」・村人名を消し、匿名アカウントも削除します。</Small>
      <View style={{ height: 32 }} />
      <Small>村人ID（運営に問い合わせるときに使います。長押しでコピーできます）</Small>
      <T selectable style={s.uid}>{uid}</T>
    </ScrollView>
  );
}

function Row({ label, onPress, danger, disabled }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: C.mossDeep }, disabled && { opacity: 0.5 }]}
    >
      <T style={[s.label, danger && { color: C.error }]}>{label}</T>
      <T style={s.chev}>›</T>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 14, width: "100%", maxWidth: 480, alignSelf: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.mossSoft,
    borderColor: C.mossDeep,
    borderWidth: 2,
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  label: { fontSize: 16 },
  chev: { fontSize: 20, color: C.sub },
  uid: { fontSize: 12, color: C.sub, marginTop: 4 },
});
