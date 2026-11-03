import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FarmMap, type PlantVis, type Player, type Scene, playerPos } from "@/components/farm-map";
import { stageOf } from "@/components/flower-art";
import { useModal } from "@/components/modal-host";
import { SwipeArea } from "@/components/swipe-walk";
import { T } from "@/components/ui";
import { FLOWERS, MAX_WATER } from "@/lib/dekitakoto/constants";
import { type DoneSeed, canWater, doneSeedAt, plantable, refreshToday, useDone } from "@/lib/dekitakoto/store";
import {
  type Area, BUILDINGS, CAFE_GUESTS, DIRS, type Dir, ROOMS, type RoomId, START, WALKABLE, buildingAt, keyOf, roomTileAt, tileAt,
} from "@/lib/game";
import { animalName } from "@/lib/cafe";
import { setGoToSeed, useActions } from "@/modals";
import { useFarm } from "@/state/farm";
import { C } from "@/theme";

// go は建物への出入りと、カフェの丸椅子に座ること（描画ループの状態を変えるので、run とは分けて pressA で扱う）
type Action = { label: string; hint: string; run: (() => void) | null; go?: RoomId | "leave" | "sit"; seat?: { x: number; y: number } };

const ROOM_HINTS: Record<RoomId, Record<string, string>> = {
  house: {
    B: "ふかふかのベッドだ。",
    L: "木のテーブルだ。",
    K: "本がたくさん並んでいる。",
  },
  cafe: {
    "#": "棚にカップがきれいに並んでいる。",
    b: "カウンターの向こうだ。",
    P: "よく手入れされた鉢植えだ。",
  },
};
const ROOM_IDLE: Record<RoomId, string> = {
  house: "自分の家だ。ほっとする。",
  cafe: "コーヒーの香りがする。静かで、あたたかい。",
};
const doorOf = (id: RoomId) => BUILDINGS.find((b) => b.id === id)!.door;
const isRoom = (a: Area): a is RoomId => a !== "farm";

export function FarmScreen() {
  const farm = useFarm();
  const modal = useModal();
  const done = useDone();
  const a = useActions();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // カフェの会話画面などに移っているあいだは、マップの描画を止める
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  // 立ち位置と向き。ヒントとAボタンの表示に使う
  const [pos, setPos] = useState({ x: START.x, y: START.y, dir: "up" as Dir, area: "farm" as Area });

  /* ---------- できたことの種 ---------- */
  // 日付が変わったら、水やりできる種を更新する（アプリに戻ってきたときと、1分ごと）
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") refreshToday(); });
    const timer = setInterval(refreshToday, 60000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);

  /* ---------- 描画ループに渡すもの ---------- */
  const plants = useMemo<PlantVis[]>(() => done.seeds.map((sd) => ({
    x: sd.x, y: sd.y, stage: stageOf(sd), flower: sd.flower, drop: canWater(sd, done.today),
  })), [done.seeds, done.today]);
  const sceneRef = useRef<Scene>({
    area: "farm",
    player: { x: START.x, y: START.y, dir: "up", fromX: START.x, fromY: START.y, moveStart: 0, walkStart: 0, walkUntil: 0 } satisfies Player,
    plants: [],
  });
  useEffect(() => {
    sceneRef.current.plants = plants;
  }, [plants]);

  /* ---------- 移動 ---------- */
  const modalOpen = useRef(modal.isOpen);
  useEffect(() => { modalOpen.current = modal.isOpen; }, [modal.isOpen]);

  // 村と建物の中を行き来する。歩かずに、その場に立たせる
  const warp = useCallback((area: Area, x: number, y: number, dir: Dir) => {
    const sc = sceneRef.current;
    sc.area = area;
    Object.assign(sc.player, { x, y, dir, fromX: x, fromY: y, moveStart: 0, walkUntil: 0 });
    setPos({ x, y, dir, area });
  }, []);
  const enterRoom = useCallback((id: RoomId) => warp(id, ROOMS[id].entry.x, ROOMS[id].entry.y, "up"), [warp]);
  // 思い出帳の「育てている種」から、その種の上へ移る（建物の中にいても外に出る）
  useEffect(() => {
    setGoToSeed((sd: DoneSeed) => warp("farm", sd.x, sd.y, "down"));
    return () => setGoToSeed(null);
  }, [warp]);
  const leaveRoom = useCallback(() => {
    const id = sceneRef.current.area;
    if (!isRoom(id)) return;
    const door = doorOf(id);
    warp("farm", door.x, door.y + 1, "down");
  }, [warp]);

  // 1マス進む。歩いている途中でも、今いる場所から次のマスへ向かい直す
  const move = useCallback((dir: Dir) => {
    if (modalOpen.current) return;
    const sc = sceneRef.current;
    const p = sc.player;
    const now = performance.now();
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = p.x + dx;
    const ny = p.y + dy;
    const area = sc.area;
    if (isRoom(area)) {
      // 出入り口へ歩くと外に出る
      const c = roomTileAt(area, nx, ny);
      if (c === "E") { leaveRoom(); return; }
      if (!ROOMS[area].walkable.has(c)) { setPos({ x: p.x, y: p.y, dir, area }); return; }
    } else {
      // 入れる建物の扉へ歩くと中に入る
      const b = buildingAt(nx, ny);
      if (b && b.enterable && b.door.x === nx && b.door.y === ny) { enterRoom(b.id as RoomId); return; }
      if (!WALKABLE.has(tileAt(nx, ny))) { setPos({ x: p.x, y: p.y, dir, area: "farm" }); return; }
    }
    const { fx, fy } = playerPos(p, now);
    p.fromX = fx; p.fromY = fy;
    p.x = nx; p.y = ny;
    p.moveStart = now;
    if (now > p.walkUntil) p.walkStart = now;
    p.walkUntil = now + 230;
    setPos({ x: nx, y: ny, dir, area: sc.area });
  }, [enterRoom, leaveRoom]);

  /* ---------- ヒントとAボタン ---------- */
  const openCafe = () => router.push("/cafe");
  const action: Action = (() => {
    const [dx, dy] = DIRS[pos.dir];
    if (isRoom(pos.area)) {
      const room = pos.area;
      const fx = pos.x + dx, fy = pos.y + dy;
      const front = roomTileAt(room, fx, fy);
      if (front === "E") return { label: "出る", hint: "外に出られる。", run: null, go: "leave" };
      if (room === "cafe") {
        const seated = roomTileAt("cafe", pos.x, pos.y) === "s";
        const guestName = () => {
          const g = CAFE_GUESTS[keyOf(fx, fy)];
          return g ? `${animalName(g)}の村人` : "村人";
        };
        if (seated && front === "C") {
          return { label: "話す", hint: "マスター「いらっしゃい。今日は、どんなお話をしましょうか」", run: openCafe };
        }
        if (seated) {
          return { label: "話す", hint: "カウンター席に座っている。隣の村人も、静かにカップを傾けている。", run: openCafe };
        }
        if (front === "C" || front === "O") {
          return { label: "…", hint: "マスター「どうぞ、カウンターの空いている席へ」", run: null };
        }
        if (front === "s") {
          // 空いている丸椅子に座る。両隣の村人をヒントで伝える
          const near = [CAFE_GUESTS[keyOf(fx - 1, fy)], CAFE_GUESTS[keyOf(fx + 1, fy)]].filter(Boolean).map((g) => animalName(g!));
          const side = near.length ? `隣には${near.join("と")}の村人が座っている。` : "";
          return {
            label: "座る",
            hint: `カウンターの席が空いている。${side}`,
            run: null,
            go: "sit",
            seat: { x: fx, y: fy },
          };
        }
        if (front === "g") return { label: "…", hint: `${guestName()}が、カウンターでくつろいでいる。`, run: null };
        if (front === "a") return { label: "…", hint: `${guestName()}が、静かにカップを傾けている。`, run: null };
        if (front === "T") return { label: "…", hint: "テーブル席は埋まっているようだ。カウンターに座ろう。", run: null };
      }
      const h = ROOM_HINTS[room][front];
      if (h) return { label: "…", hint: h, run: null };
      return { label: "…", hint: ROOM_IDLE[room], run: null };
    }
    if (tileAt(pos.x + dx, pos.y + dy) === "N") {
      return { label: "読む", hint: "看板を読む", run: () => a.showHelp(true) };
    }
    if (tileAt(pos.x + dx, pos.y + dy) === "~") {
      return { label: "…", hint: "小さな池だ。水面がきらきらしている。", run: null };
    }
    const building = buildingAt(pos.x + dx, pos.y + dy);
    if (building && building.enterable && building.door.x === pos.x + dx && building.door.y === pos.y + dy) {
      const hint = building.id === "house" ? "自分の家だ。" : `${building.name}の入り口だ。いい香りがする。`;
      return { label: "入る", hint, run: null, go: building.id as RoomId };
    }
    if (building) {
      const atDoor = building.door.x === pos.x + dx && building.door.y === pos.y + dy;
      return { label: "…", hint: atDoor ? `${building.name}の入り口だ。今はまだ入れない。` : `${building.name}だ。`, run: null };
    }
    // できたことの種（自分で蒔いて、自分で水やりする）
    const sd = doneSeedAt(done.seeds, pos.x, pos.y);
    if (sd) {
      if (sd.bloomed) return { label: "読む", hint: `思い出を読む（${FLOWERS[sd.flower].name}）`, run: () => a.showMemory(sd.id) };
      if (canWater(sd, done.today)) {
        return { label: "水やり", hint: `種を見る・水やりする（${sd.waters.length}/${MAX_WATER}）`, run: () => a.showDoneSeed(sd.id) };
      }
      return { label: "見る", hint: `種を見る（今日は水やり済み・${sd.waters.length}/${MAX_WATER}）`, run: () => a.showDoneSeed(sd.id) };
    }
    const here = tileAt(pos.x, pos.y);
    if (here === "P") return { label: "…", hint: "道には種を蒔けません。草地か畑へ行こう。", run: null };
    if (plantable(pos.x, pos.y)) {
      const hint = here === "," ? "この畑に種を蒔く" : "ここに種を蒔く";
      return { label: "蒔く", hint, run: () => a.showPlant(pos.x, pos.y) };
    }
    return { label: "…", hint: "", run: null };
  })();

  const canPress = !!action.run || !!action.go;
  const pressA = () => {
    if (modal.isOpen) return;
    if (action.go === "sit" && action.seat) { warp("cafe", action.seat.x, action.seat.y, "up"); openCafe(); }
    else if (action.go === "leave") leaveRoom();
    else if (action.go && action.go !== "sit") enterRoom(action.go);
    else action.run?.();
  };

  const bloomN = done.seeds.filter((v) => v.bloomed).length;
  const waterN = done.seeds.filter((v) => canWater(v, done.today)).length;

  // 村人は、上の帯と操作部のあいだの真ん中に置く
  const topH = insets.top + HUD_H;
  const bottomH = insets.bottom + BOTTOM_PAD + A_SIZE + GAP;
  const focusY = height > 0 ? (topH + (height - bottomH)) / 2 / height : 0.5;

  return (
    <View style={s.root}>
      <SwipeArea onMove={move}>
        <FarmMap scene={sceneRef} paused={modal.isOpen || !focused} focusY={focusY} />
      </SwipeArea>

      <View style={[s.hud, { paddingTop: insets.top + 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
        <View style={s.hudRow}>
          <T style={s.villager} numberOfLines={1}>{`${farm.name}さん`}</T>
          <View style={s.hudActions}>
            <HudBtn label="📖 思い出帳" onPress={() => a.showBook()} />
            <HudBtn label="設定" onPress={() => router.push("/settings")} />
          </View>
        </View>
        <View style={s.stats} pointerEvents="none">
          <T style={s.stat}>{`🌸 咲いた花 ${bloomN}`}</T>
          <T style={s.stat}>{`🌱 育てている種 ${done.seeds.length - bloomN}`}</T>
          <T style={s.stat}>{`💧 今日水やりできる種 ${waterN}`}</T>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[s.bottom, { paddingBottom: insets.bottom + BOTTOM_PAD, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}
      >
        <View style={s.controls} pointerEvents="box-none">
          <View style={s.hint} pointerEvents="none">
            <T style={s.hintText} accessibilityLiveRegion="polite">{action.hint}</T>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPress }}
            disabled={!canPress}
            onPress={pressA}
            style={({ pressed }) => [s.aBtn, pressed && s.aBtnPressed, !canPress && s.aBtnOff]}
          >
            {/* できることがないときは何も出さない */}
            <T style={s.aText}>{action.label === "…" ? "" : action.label}</T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function HudBtn({ label, badge = 0, onPress }: { label: string; badge?: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}　未読${badge}通` : label}
      style={({ pressed }) => [s.hudBtn, pressed && s.hudBtnPressed]}
    >
      <T style={s.hudText}>{label}</T>
      {badge > 0 ? <View style={s.badge}><T style={s.badgeText}>{String(badge)}</T></View> : null}
    </Pressable>
  );
}

const HUD_H = 74; // 上の帯（ステータスバーを除く）
const GAP = 8;
const BOTTOM_PAD = 12;
const A_SIZE = 84;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.moss },
  hud: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 6,
    backgroundColor: "rgba(31,39,29,0.78)",
  },
  hudRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stats: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, marginTop: 6 },
  stat: { fontSize: 12, color: C.soft },
  villager: { fontSize: 15, color: C.leaf, flexShrink: 1 },
  hudActions: { flexDirection: "row", gap: 6, flexShrink: 0 },
  hudBtn: {
    backgroundColor: C.mossSoft,
    borderColor: C.mossDeep,
    borderWidth: 2,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    shadowColor: C.mossDeep,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  hudBtnPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 0, height: 1 } },
  hudText: { fontSize: 14 },
  badge: {
    position: "absolute",
    top: -8,
    right: -8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: C.mail,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 12, color: "#fff", lineHeight: 16 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  hint: {
    flex: 1,
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(31,39,29,0.82)",
    borderRadius: 6,
    justifyContent: "center",
  },
  hintText: { fontSize: 15, lineHeight: 22 },
  controls: { flexDirection: "row", alignItems: "center", gap: 12 },
  aBtn: {
    width: A_SIZE,
    height: A_SIZE,
    borderRadius: A_SIZE / 2,
    marginRight: 4,
    backgroundColor: "rgba(156,200,106,0.82)",
    borderColor: "rgba(31,39,29,0.7)",
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  aBtnPressed: { backgroundColor: "rgba(156,200,106,0.95)", transform: [{ translateY: 2 }] },
  aBtnOff: { backgroundColor: "rgba(111,154,68,0.6)" },
  aText: { fontSize: 18, color: C.ink },
});
