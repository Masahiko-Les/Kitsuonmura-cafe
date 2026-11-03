import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useToast } from "@/components/toast";
import { Actions, Btn, Paper, Small, T } from "@/components/ui";
import { animalName, questionById } from "@/lib/cafe";
import {
  type CafeAnswer, type CafeReport, adminDeleteAnswer, loadOpenReports, loadPending, markReportsHandled, setAnswerStatus,
} from "@/lib/cafe-api";
import { dateText, millis } from "@/lib/farm-api";
import { useFarm } from "@/state/farm";
import { C } from "@/theme";

type Tab = "pending" | "reports";
type ReportGroup = { answer: CafeAnswer | null; targetId: string; reports: CafeReport[] };

// 運営用：カフェの言葉の承認と、通報の確認
export function CafeAdmin() {
  const { isAdmin } = useFarm();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<CafeAnswer[] | null>(null);
  const [reports, setReports] = useState<ReportGroup[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // 処理中の回答ID

  const fetchAll = useCallback(async () => {
    const [p, r] = await Promise.all([loadPending(), loadOpenReports()]);
    return {
      p: p.sort((a, b) => millis(a.createdAt) - millis(b.createdAt)), // 古いものから
      r,
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    fetchAll()
      .then(({ p, r }) => { if (alive) { setPending(p); setReports(r); } })
      .catch((e) => {
        console.error(e);
        if (alive) { setError("読み込めませんでした。ルールが反映されているか確認してください。"); setPending([]); setReports([]); }
      });
    return () => { alive = false; };
  }, [isAdmin, fetchAll]);

  const reload = async () => {
    setPending(null);
    setReports(null);
    setError("");
    try {
      const { p, r } = await fetchAll();
      setPending(p);
      setReports(r);
    } catch (e) {
      console.error(e);
      setError("読み込めませんでした。");
      setPending([]);
      setReports([]);
    }
  };

  /* ---------- 承認待ち ---------- */
  const decide = async (a: CafeAnswer, status: "public" | "private") => {
    setBusy(a.id);
    try {
      await setAnswerStatus(a.id, status);
      setPending((cur) => cur?.filter((x) => x.id !== a.id) ?? null);
      toast(status === "public" ? "承認しました。ほかの村人に届きます。" : "承認しませんでした。本人だけの言葉になります。");
    } catch (e) {
      console.error(e);
      toast("変えられませんでした。");
    }
    setBusy(null);
  };

  /* ---------- 通報 ---------- */
  const settle = async (g: ReportGroup, action: "ok" | "private" | "delete") => {
    const run = async () => {
      setBusy(g.targetId);
      try {
        if (g.answer && action === "private") await setAnswerStatus(g.answer.id, "private");
        if (g.answer && action === "delete") await adminDeleteAnswer(g.answer.id);
        await markReportsHandled(g.reports.map((r) => r.id));
        setReports((cur) => cur?.filter((x) => x.targetId !== g.targetId) ?? null);
        toast(action === "ok" ? "問題なしにしました。" : action === "private" ? "非公開にしました。" : "削除しました。");
      } catch (e) {
        console.error(e);
        toast("処理できませんでした。");
      }
      setBusy(null);
    };
    if (action === "delete") {
      Alert.alert("", "この言葉を削除しますか？　元には戻せません。", [
        { text: "やめる", style: "cancel" },
        { text: "削除する", style: "destructive", onPress: run },
      ]);
    } else {
      await run();
    }
  };

  if (!isAdmin) {
    return <View style={s.center}><Small>この画面は運営だけが使えます。</Small></View>;
  }

  const loading = pending === null || reports === null;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.tabs}>
        <TabBtn label={`承認待ち${pending ? `（${pending.length}）` : ""}`} on={tab === "pending"} onPress={() => setTab("pending")} />
        <TabBtn label={`通報${reports ? `（${reports.length}）` : ""}`} on={tab === "reports"} onPress={() => setTab("reports")} />
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.leaf} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.wrap}>
          {error ? <T style={s.error}>{error}</T> : null}
          {tab === "pending" ? (
            <>
              <Small>「未来の村人に届けてもよい」を選んだ言葉です。承認すると、同じ質問に答えたほかの村人に、動物の姿で紹介されます。</Small>
              {pending.length === 0 ? <T style={s.empty}>承認待ちの言葉はありません。</T> : null}
              {pending.map((a) => (
                <View key={a.id} style={s.item}>
                  <AnswerHead a={a} />
                  <Actions>
                    <Btn kind="quiet" label="承認しない" onPress={() => decide(a, "private")} disabled={busy === a.id} />
                    <Btn label="承認する" onPress={() => decide(a, "public")} disabled={busy === a.id} />
                  </Actions>
                </View>
              ))}
            </>
          ) : (
            <>
              <Small>カフェの言葉への通報です（24時間以内に確認する）。</Small>
              {reports.length === 0 ? <T style={s.empty}>未確認の通報はありません。</T> : null}
              {reports.map((g) => (
                <View key={g.targetId} style={s.item}>
                  <T style={s.badge}>{`通報 ${g.reports.length}件`}</T>
                  {g.answer ? <AnswerHead a={g.answer} /> : <Small>この言葉はすでに削除されています。</Small>}
                  <Actions>
                    <Btn kind="quiet" label="問題なし" onPress={() => settle(g, "ok")} disabled={busy === g.targetId} />
                    {g.answer && g.answer.status !== "private"
                      ? <Btn kind="quiet" label="非公開にする" onPress={() => settle(g, "private")} disabled={busy === g.targetId} />
                      : null}
                    {g.answer ? <Btn label="削除する" onPress={() => settle(g, "delete")} disabled={busy === g.targetId} /> : null}
                  </Actions>
                </View>
              ))}
            </>
          )}
          <View style={{ marginTop: 8 }}><Btn kind="quiet" label="読み込み直す" onPress={reload} /></View>
        </ScrollView>
      )}
    </View>
  );
}

function AnswerHead({ a }: { a: CafeAnswer }) {
  const q = questionById(a.questionId);
  return (
    <>
      <T style={s.meta}>{`${q ? q.theme.title : a.themeId}　${dateText(a.createdAt)}　${animalName(a.animal)}の姿`}</T>
      <T style={s.question}>{q ? q.question.text : a.questionId}</T>
      <Paper text={a.text} minLines={2} />
    </>
  );
}

function TabBtn({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={onPress} style={[s.tab, on && s.tabOn]}>
      <T style={[s.tabText, on && { color: C.ink }]}>{label}</T>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, width: "100%", maxWidth: 480, alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: C.error, marginBottom: 12 },
  empty: { fontSize: 15, color: C.soft, marginVertical: 20, textAlign: "center" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, borderWidth: 2, borderColor: C.mossDeep, borderRadius: 6, paddingVertical: 8, backgroundColor: C.mossSoft },
  tabOn: { backgroundColor: C.leaf },
  tabText: { fontSize: 14, textAlign: "center" },
  item: { backgroundColor: C.mossSoft, borderColor: C.mossDeep, borderWidth: 2, borderRadius: 8, padding: 12, marginTop: 14 },
  meta: { fontSize: 12, color: C.sub },
  question: { fontSize: 15, lineHeight: 22, marginTop: 2, marginBottom: 8 },
  badge: { alignSelf: "flex-start", fontSize: 12, color: "#fff", backgroundColor: C.mail, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 8, overflow: "hidden" },
});
