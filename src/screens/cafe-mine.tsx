import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";

import { useToast } from "@/components/toast";
import { Actions, Btn, Paper, Small, T } from "@/components/ui";
import { REACTIONS, animalName, questionById } from "@/lib/cafe";
import {
  type CafeAnswer, type CafeReaction, type CafeStatus, deleteAnswer, loadMyAnswers, loadReactionsToMe, makePrivate,
} from "@/lib/cafe-api";
import { millis } from "@/lib/farm-api";
import { useFarm } from "@/state/farm";
import { C } from "@/theme";

const STATUS_TEXT: Record<CafeStatus, string> = {
  pending: "運営の確認待ちです。確認のあと、未来の村人に届きます。",
  public: "未来の村人に届いています。",
  private: "あなただけの言葉です。ほかの村人には届きません。",
  review: "確認中のため、ほかの村人には届きません。",
};

// わたしの言葉：自分が残した回答と、届いた気持ちを静かに読み返す
export function CafeMine() {
  const { uid } = useFarm();
  const toast = useToast();
  const offline = !uid || uid === "offline";
  const [answers, setAnswers] = useState<CafeAnswer[] | null>(offline ? [] : null);
  const [reactions, setReactions] = useState<CafeReaction[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (offline) return;
    let alive = true;
    Promise.all([loadMyAnswers(uid), loadReactionsToMe(uid)])
      .then(([a, r]) => {
        if (!alive) return;
        setAnswers(a.sort((x, y) => millis(y.createdAt) - millis(x.createdAt)));
        setReactions(r);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError("読み込めませんでした。通信を確認してください。");
        setAnswers([]);
      });
    return () => { alive = false; };
  }, [uid, offline]);

  const hide = (a: CafeAnswer) => {
    Alert.alert("", "この言葉を非公開にしますか？　ほかの村人には届かなくなります。もう一度公開することはできません。", [
      { text: "やめる", style: "cancel" },
      {
        text: "非公開にする",
        onPress: async () => {
          try {
            await makePrivate(a.id);
            setAnswers((cur) => cur?.map((x) => (x.id === a.id ? { ...x, status: "private" } : x)) ?? null);
            toast("非公開にしました。");
          } catch (e) {
            console.error(e);
            toast("変えられませんでした。通信を確認してください。");
          }
        },
      },
    ]);
  };

  const remove = (a: CafeAnswer) => {
    Alert.alert("", "この言葉を削除しますか？　元には戻せません。", [
      { text: "やめる", style: "cancel" },
      {
        text: "削除する",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAnswer(a.id);
            setAnswers((cur) => cur?.filter((x) => x.id !== a.id) ?? null);
            toast("削除しました。");
          } catch (e) {
            console.error(e);
            toast("削除できませんでした。通信を確認してください。");
          }
        },
      },
    ]);
  };

  if (answers === null) {
    return <View style={s.center}><ActivityIndicator color={C.leaf} /></View>;
  }

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      {error ? <T style={s.error}>{error}</T> : null}
      {answers.length === 0 && !error ? (
        <Small>まだ言葉は残されていません。カフェでマスターと話してみましょう。</Small>
      ) : null}
      {answers.map((a) => {
        const q = questionById(a.questionId);
        const got = reactions.filter((r) => r.answerId === a.id);
        const kinds = REACTIONS.filter((r) => got.some((g) => g.kind === r.id)).map((r) => `「${r.label}」`);
        return (
          <View key={a.id} style={s.item}>
            <T style={s.theme}>{q ? q.theme.title : ""}</T>
            <T style={s.question}>{q ? q.question.text : ""}</T>
            <Paper text={a.text} from={`${animalName(a.animal)}の姿で`} minLines={2} />
            <Small>{STATUS_TEXT[a.status] ?? ""}</Small>
            {kinds.length > 0 ? (
              <View style={s.gift}>
                <T style={s.giftText}>{`あなたの言葉を読んだ村人から、${kinds.join("")}という気持ちが届いています。`}</T>
              </View>
            ) : null}
            <Actions>
              {a.status === "pending" || a.status === "public" ? <Btn kind="quiet" label="非公開にする" onPress={() => hide(a)} /> : null}
              <Btn kind="quiet" label="削除する" onPress={() => remove(a)} />
            </Actions>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, width: "100%", maxWidth: 480, alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: C.error, marginBottom: 12 },
  item: {
    backgroundColor: C.mossSoft,
    borderColor: C.mossDeep,
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  theme: { fontSize: 12, color: C.sub },
  question: { fontSize: 15, lineHeight: 22, marginTop: 2, marginBottom: 8 },
  gift: { backgroundColor: C.mossDeep, borderRadius: 6, padding: 10, marginTop: 10 },
  giftText: { fontSize: 14, lineHeight: 22, color: C.leaf },
});
