import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useToast } from "@/components/toast";
import { Small, T } from "@/components/ui";
import { useFarm } from "@/state/farm";
import { C } from "@/theme";

export default function Settings() {
  const { deleteAllData } = useFarm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      "すべてのデータを削除",
      "あなたが蒔いた種、送った手紙・届いた手紙、作物、村人名をすべて消し、アカウントも削除します。元には戻せません。",
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
      <Row label="運営への連絡" onPress={() => router.push("/contact")} />
      <View style={{ height: 24 }} />
      <Row label="すべてのデータを削除" danger onPress={confirmDelete} disabled={busy} />
      <Small>自分の種・手紙・作物・村人名を消し、匿名アカウントも削除します。</Small>
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
});
