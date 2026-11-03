import * as Haptics from "expo-haptics";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { addEffect } from "@/components/farm-map";
import { useModal } from "@/components/modal-host";
import { BigFlower, PlantIcon } from "@/components/plant-icon";
import { stageOf } from "@/components/flower-art";
import { Actions, Body, Btn, DoneInput, LinkBtn, Paper, Small, T, Title } from "@/components/ui";
import { FLOWERS, MAX_WATER, WATER_MS } from "@/lib/dekitakoto/constants";
import { jp, jpY } from "@/lib/dekitakoto/date";
import { maybeAskReview } from "@/lib/dekitakoto/review";
import { type DoneSeed, canWater, plantSeed, pullSeed, useDone, waterSeed } from "@/lib/dekitakoto/store";
import { SUPPORT_LINES, SUPPORT_NOTE } from "@/lib/safety";
import { C, F } from "@/theme";

// 思い出帳の「育てている種」をタップしたとき、その種の上へ村人を移す。マップの画面が登録する
type GoTo = (s: DoneSeed) => void;
let goToHandler: GoTo | null = null;
export function setGoToSeed(fn: GoTo | null) { goToHandler = fn; }

/* =========================================================
   モーダルを開く関数をまとめたもの
   ========================================================= */
export function useActions() {
  const modal = useModal();
  return {
    close: modal.close,
    showSupport: (kind: "cafe", onBack?: () => void) => modal.open(<SupportModal kind={kind} onBack={onBack} />),
    showPlant: (x: number, y: number) => modal.open(<PlantModal x={x} y={y} />),
    showDoneSeed: (id: number) => modal.open(<SeedModal id={id} />),
    showMemory: (id: number, fromBook = false) => modal.open(<MemoryModal id={id} fromBook={fromBook} />),
    showBook: (tab: "bloom" | "grow" = "bloom") => modal.open(<BookModal tab={tab} />),
    showHelp: (sign?: boolean) => modal.open(<HelpModal sign={sign} />),
  };
}

const useSeed = (id: number) => useDone().seeds.find((s) => s.id === id);
const Pop = ({ children }: { children: ReactNode }) => (
  <Animated.View entering={ZoomIn.duration(350).easing(Easing.out(Easing.quad))}>{children}</Animated.View>
);

function Drops({ n, center }: { n: number; center?: boolean }) {
  return (
    <View style={[s.drops, center && { justifyContent: "center" }]}>
      {Array.from({ length: MAX_WATER }, (_, i) => (
        <Text key={i} style={[s.drop, i >= n && s.dropOff]}>💧</Text>
      ))}
    </View>
  );
}

/* =========================================================
   できたことを植える
   ========================================================= */
function PlantModal({ x, y }: { x: number; y: number }) {
  const a = useActions();
  const modal = useModal();
  const [text, setText] = useState("");
  const go = () => {
    const t = text.trim();
    if (!t) return;
    if (plantSeed(x, y, t)) {
      addEffect("sow", x, y);
      modal.open(<PlantedModal />);
    } else {
      a.close();
    }
  };
  return (
    <>
      <Title>🌱 「できたこと」を植える</Title>
      <Small style={{ marginTop: 0, marginBottom: 10 }}>どんなに小さなことでも大丈夫。</Small>
      <DoneInput value={text} onChange={setText} />
      <Actions>
        <Btn kind="quiet" label="やめる" onPress={a.close} />
        <Btn label="種を植える" onPress={go} disabled={!text.trim()} />
      </Actions>
    </>
  );
}

function PlantedModal() {
  const a = useActions();
  return (
    <Pop>
      <BigFlower stage={0} flower={0} />
      <Title style={s.tc}>種を植えました</Title>
      <Body style={s.tc}>{`毎日1回、水やりをしながら\n今日のできたことを振り返ろう。\n${MAX_WATER}回水をあげると花が咲きます。`}</Body>
      <Actions center><Btn label="OK" onPress={a.close} /></Actions>
    </Pop>
  );
}

/* =========================================================
   種を見る・水やり
   ========================================================= */
function SeedModal({ id }: { id: number }) {
  const { today } = useDone();
  const a = useActions();
  const modal = useModal();
  const sd = useSeed(id);
  const [armed, setArmed] = useState(false);
  if (!sd) return null;
  const ok = canWater(sd, today);
  const last = sd.waters.length ? `最後の水やり：${jp(sd.waters[sd.waters.length - 1])}` : "まだ水やりしていません";
  return (
    <>
      <Title>{`🌱 ${jp(sd.planted)}に植えた種`}</Title>
      <Paper text={sd.text} minLines={3} />
      <Drops n={sd.waters.length} />
      <Small style={{ marginTop: 2 }}>{`水やり ${sd.waters.length} / ${MAX_WATER}・${last}`}</Small>
      {!ok ? <Body style={{ marginTop: 10 }}>今日はもう水やりしました。また明日、会いに来よう。</Body> : null}
      <Actions>
        <View style={{ marginRight: "auto", justifyContent: "center" }}>
          <LinkBtn
            label={armed ? "本当に抜く？（もう一度タップ）" : "この種を抜く"}
            onPress={() => {
              if (!armed) { setArmed(true); return; }
              pullSeed(sd.id);
              a.close();
            }}
          />
        </View>
        <Btn kind="quiet" label="閉じる" onPress={a.close} />
        <Btn kind="water" label="💧 水やりする" disabled={!ok} onPress={() => modal.open(<WateringModal id={sd.id} />, { locked: true })} />
      </Actions>
    </>
  );
}

// 水やり中（3秒・スキップできない）
function WateringModal({ id }: { id: number }) {
  const modal = useModal();
  const a = useActions();
  const sd = useSeed(id);
  const [text] = useState(sd?.text ?? "");
  const pos = useRef(sd ? { x: sd.x, y: sd.y } : null);
  const p = useSharedValue(0);
  const bar = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  useEffect(() => {
    p.value = withTiming(1, { duration: WATER_MS, easing: Easing.linear });
    const timer = setTimeout(() => {
      const after = waterSeed(id);
      if (!after) { a.close(); return; }
      if (pos.current) addEffect("water", pos.current.x, pos.current.y);
      if (after.bloomed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        modal.open(<BloomedModal id={id} />, { locked: true });
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        modal.open(<WateredModal id={id} />, { locked: true });
      }
    }, WATER_MS + 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    <View>
      <Small style={[s.tc, { marginTop: 0 }]}>あなたの「できたこと」</Small>
      <Text style={s.wtext}>{text}</Text>
      <View style={s.bar}>
        <Animated.View style={[s.barFill, bar]} />
      </View>
      <Small style={[s.tc, { marginTop: 8 }]}>💧 水をあげています…</Small>
    </View>
  );
}

function WateredModal({ id }: { id: number }) {
  const a = useActions();
  const sd = useSeed(id);
  if (!sd) return null;
  return (
    <Pop>
      <BigFlower stage={stageOf(sd)} flower={sd.flower} />
      <Title style={s.tc}>水をあげました</Title>
      <Drops n={sd.waters.length} center />
      <Body style={[s.tc, { marginTop: 8 }]}>{"できたことに水やりしました。\nできていることがたくさんありますね。"}</Body>
      <Actions center><Btn label="OK" onPress={a.close} /></Actions>
    </Pop>
  );
}

function BloomedModal({ id }: { id: number }) {
  const a = useActions();
  const sd = useSeed(id);
  if (!sd) return null;
  return (
    <Pop>
      <BigFlower stage={5} flower={sd.flower} />
      <Title style={s.tc}>{`🌸 ${FLOWERS[sd.flower].name}が咲きました！`}</Title>
      <Body style={s.tc}>{`${jp(sd.planted)}の「できたこと」が花になりました。\n思い出帳にしまっておきます。`}</Body>
      <Actions center>
        <Btn
          label="うれしい"
          onPress={() => {
            a.close();
            // 開花の画面が閉じてから、評価のお願いを出す
            setTimeout(maybeAskReview, 500);
          }}
        />
      </Actions>
    </Pop>
  );
}

/* =========================================================
   思い出帳
   ========================================================= */
function Tab({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} style={[s.tab, on && s.tabOn]} onPress={onPress}>
      <T style={[s.tabText, on && { color: C.ink }]}>{label}</T>
    </Pressable>
  );
}

function BookModal({ tab }: { tab: "bloom" | "grow" }) {
  const { seeds, today } = useDone();
  const a = useActions();
  const modal = useModal();
  const bl = seeds
    .filter((v) => v.bloomed)
    .sort((x, y) => (y.bloomed as string).localeCompare(x.bloomed as string) || y.id - x.id);
  const gr = seeds.filter((v) => !v.bloomed).sort((x, y) => x.id - y.id);
  return (
    <>
      <Title>📖 思い出帳</Title>
      <View style={s.tabs}>
        <Tab on={tab === "bloom"} label={`咲いた花 ${bl.length}`} onPress={() => modal.open(<BookModal tab="bloom" />)} />
        <Tab on={tab === "grow"} label={`育てている種 ${gr.length}`} onPress={() => modal.open(<BookModal tab="grow" />)} />
      </View>
      {tab === "bloom" ? (
        bl.length ? bl.map((v) => (
          <Pressable key={v.id} style={s.entry} onPress={() => a.showMemory(v.id, true)} accessibilityRole="button">
            <PlantIcon stage={5} flower={v.flower} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={s.entryText}>{v.text}</Text>
              <T style={s.meta}>{`${FLOWERS[v.flower].name}・${jp(v.planted)}に植えて ${jp(v.bloomed as string)}に咲いた`}</T>
            </View>
          </Pressable>
        )) : (
          <T style={s.empty}>{`まだ花は咲いていません。\n種に${MAX_WATER}回水をあげると、ここに思い出が増えていきます。`}</T>
        )
      ) : gr.length ? gr.map((v) => (
        <Pressable key={v.id} style={s.entry} onPress={() => { a.close(); goToHandler?.(v); }} accessibilityRole="button">
          <PlantIcon stage={stageOf(v)} flower={v.flower} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={s.entryText}>{v.text}</Text>
            <T style={s.meta}>
              {`${jp(v.planted)}に植えた・水やり ${v.waters.length}/${MAX_WATER}`}
              {canWater(v, today) ? <Text style={{ color: C.water }}>・今日まだ水やりできる</Text> : "・今日は済み"}
            </T>
            <T style={s.meta}>タップでこの種のところへ行く</T>
          </View>
        </Pressable>
      )) : (
        <T style={s.empty}>{"育てている種はありません。\nマップで今日のできたことを植えてみよう。"}</T>
      )}
      <Actions><Btn label="閉じる" onPress={a.close} /></Actions>
    </>
  );
}

function MemoryModal({ id, fromBook }: { id: number; fromBook?: boolean }) {
  const a = useActions();
  const sd = useSeed(id);
  if (!sd || !sd.bloomed) return null;
  return (
    <>
      <BigFlower stage={5} flower={sd.flower} />
      <Title style={s.tc}>{FLOWERS[sd.flower].name}</Title>
      <Paper text={sd.text} minLines={3} />
      <Small style={{ marginTop: 12 }}>
        {`植えた日：${jpY(sd.planted)}\n水やりした日：${sd.waters.map(jp).join("・")}\n咲いた日：${jpY(sd.bloomed)}`}
      </Small>
      <Actions>
        {fromBook ? <Btn kind="quiet" label="思い出帳へ" onPress={() => a.showBook("bloom")} /> : null}
        <Btn label="閉じる" onPress={a.close} />
      </Actions>
    </>
  );
}

/* =========================================================
   あそびかた（看板）
   ========================================================= */
export const HELP_ITEMS = [
  "画面をなぞった方向へ歩きます（指を置いたままで歩き続けます）。",
  "カフェに入り、カウンターの空いている席に座ると、マスターとお話しできます。質問に答えたあと、隣の席の村人の言葉を読めます。",
  "草地や畑の上で A を押すと、立っている場所に今日の小さな「できたこと」を種として蒔けます。道には蒔けません。",
  `水やりは1つの種につき1日1回。水をあげる間、そのできたことが3秒間表示されます。${MAX_WATER}回水をあげると花が咲きます。`,
  "咲いた花は📖思い出帳でいつでも見返せます。💧マークがついている種は、今日まだ水やりできる種です。",
];

function HelpModal({ sign }: { sign?: boolean }) {
  const a = useActions();
  return (
    <>
      <Title>{sign ? "🪧 看板" : "あそびかた"}</Title>
      <Body>吃音村へようこそ。カフェで語り合い、自分の「できたこと」を花に育てていく村です。</Body>
      {HELP_ITEMS.map((t, i) => (
        <View key={t} style={s.li}>
          <T style={s.liNum}>{`${i + 1}.`}</T>
          <T style={s.liText}>{t}</T>
        </View>
      ))}
      <Small>「できたこと」はこのスマホの中だけに保存され、ほかの村人には見えません。</Small>
      <Actions><Btn label="閉じる" onPress={a.close} /></Actions>
    </>
  );
}

/* =========================================================
   相談窓口
   ========================================================= */
export function SupportList() {
  return (
    <View style={{ marginBottom: 12 }}>
      {SUPPORT_LINES.map((l) => (
        <View key={l.tel} style={s.support}>
          <T style={s.supportText}>{`${l.name}　`}</T>
          <Pressable onPress={() => Linking.openURL(`tel:${l.tel}`)} accessibilityRole="link" hitSlop={6}>
            <T style={s.supportLink}>{l.label}</T>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function SupportModal({ onBack }: { kind: "cafe"; onBack?: () => void }) {
  const a = useActions();
  return (
    <>
      <Title>ひとりで抱えこまないで</Title>
      <Body>とてもつらい気持ちが書かれていたので、この言葉はほかの村人には届けず、運営が確認します。</Body>
      <Body>苦しいときは、話を聞いてくれる窓口があります。</Body>
      <SupportList />
      <Small>{SUPPORT_NOTE}</Small>
      <Actions>
        {onBack ? <Btn kind="quiet" label="書き直す" onPress={onBack} /> : null}
        <Btn label="とじる" onPress={a.close} />
      </Actions>
    </>
  );
}

const s = StyleSheet.create({
  tc: { textAlign: "center" },
  drops: { flexDirection: "row", gap: 6, marginTop: 10, marginBottom: 4 },
  drop: { fontSize: 22 },
  dropOff: { opacity: 0.25 },
  wtext: {
    fontFamily: F.letter,
    fontSize: 22,
    lineHeight: 37,
    color: C.text,
    textAlign: "center",
    marginTop: 18,
    marginBottom: 22,
    marginHorizontal: 4,
  },
  bar: { height: 12, backgroundColor: C.mossDeep, borderColor: C.mossDeep, borderWidth: 2, borderRadius: 8, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: C.water },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 10 },
  tab: { flex: 1, padding: 8, borderWidth: 2, borderColor: C.mossDeep, borderRadius: 6, backgroundColor: C.moss, alignItems: "center" },
  tabOn: { backgroundColor: C.leaf },
  tabText: { fontSize: 14 },
  entry: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 10,
    borderWidth: 2,
    borderColor: C.mossDeep,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: C.paper,
  },
  entryText: { fontFamily: F.letter, fontSize: 15, lineHeight: 24, color: C.ink },
  meta: { fontSize: 11, lineHeight: 16, color: "#6b6254", marginTop: 2 },
  empty: { textAlign: "center", fontSize: 13, lineHeight: 22, color: C.sub, paddingVertical: 24 },
  li: { flexDirection: "row", marginBottom: 4 },
  liNum: { width: 22, fontSize: 14, lineHeight: 23, color: C.soft },
  liText: { flex: 1, fontSize: 14, lineHeight: 23, color: C.soft },
  support: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", backgroundColor: C.moss, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6 },
  supportText: { fontSize: 15 },
  supportLink: { fontSize: 15, color: C.leaf, textDecorationLine: "underline" },
});
