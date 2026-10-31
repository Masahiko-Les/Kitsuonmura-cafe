import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DPad } from "@/components/dpad";
import { FarmMap, MOVE_MS, type Player, type Scene, type SeedKind } from "@/components/farm-map";
import { useModal } from "@/components/modal-host";
import { useToast } from "@/components/toast";
import { T } from "@/components/ui";
import type { Seed } from "@/lib/farm-api";
import { DIRS, type Dir, MAX_WATERERS, SOWABLE, WALKABLE, buildingAt, keyOf, tileAt } from "@/lib/game";
import { useActions } from "@/modals";
import { useFarm } from "@/state/farm";
import { C } from "@/theme";

type Action = { label: string; hint: string; run: (() => void) | null };

export function FarmScreen() {
  const farm = useFarm();
  const modal = useModal();
  const toast = useToast();
  const a = useActions();

  // 立ち位置と向き。ヒントとAボタンの表示に使う
  const [pos, setPos] = useState({ x: 8, y: 9, dir: "down" as Dir });

  /* ---------- 種の判定 ---------- */
  const seedAt = useCallback((x: number, y: number): Seed | null => {
    const k = keyOf(x, y);
    if (farm.mySeeds.has(k)) return farm.mySeeds.get(k)!;
    if (farm.hiddenSeeds.has(k)) return null;
    return farm.publicSeeds.get(k) ?? null;
  }, [farm.mySeeds, farm.publicSeeds, farm.hiddenSeeds]);

  const kindOf = useCallback((seed: Seed | null): SeedKind => {
    if (!seed) return null;
    if (seed.ownerUid === farm.uid) return seed.status === "review" ? "mine-review" : "mine";
    if ((seed.waterers || []).includes(farm.uid)) return "watered";
    if ((seed.waterCount || 0) >= MAX_WATERERS) return "full";
    return "open";
  }, [farm.uid]);

  const nearOpenSeed = useMemo(() => {
    for (const s of farm.publicSeeds.values()) {
      if (kindOf(s) !== "open" || farm.hiddenSeeds.has(s.id)) continue;
      if (Math.abs(s.x - pos.x) + Math.abs(s.y - pos.y) <= 2) return true;
    }
    return false;
  }, [farm.publicSeeds, farm.hiddenSeeds, kindOf, pos.x, pos.y]);

  /* ---------- ヒントとAボタン ---------- */
  const action: Action = (() => {
    const [dx, dy] = DIRS[pos.dir];
    if (tileAt(pos.x + dx, pos.y + dy) === "M") {
      return { label: "開く", hint: "郵便受けだ。", run: a.showMailbox };
    }
    if (tileAt(pos.x + dx, pos.y + dy) === "W") {
      return { label: "…", hint: "風が強すぎて危険だ。これ以上進めない。", run: null };
    }
    const building = buildingAt(pos.x + dx, pos.y + dy);
    if (building) {
      return { label: "…", hint: `${building.name}だ。今はまだ入れない。`, run: null };
    }
    const seed = seedAt(pos.x, pos.y);
    const kind = kindOf(seed);
    if (seed && (kind === "mine" || kind === "mine-review")) {
      return { label: "見る", hint: "あなたが蒔いた種だ。", run: () => a.showOwnSeed(seed) };
    }
    if (seed && kind === "open") {
      return { label: "調べる", hint: "土の中に種が埋まっている！", run: () => { a.showSeed(seed); } };
    }
    if (kind === "watered") {
      return { label: "見る", hint: "あなたが水やりした種だ。", run: () => toast("この種にはもう水やりしました。") };
    }
    if (kind === "full") {
      return { label: "見る", hint: "5人に水やりされて、すっかり育った。", run: () => toast("この種は5人に水やりされ、育ちきりました。") };
    }
    if (tileAt(pos.x, pos.y) === "D") {
      return { label: "…", hint: "砂漠だ。ここには種を蒔けない。", run: null };
    }
    if (SOWABLE.has(tileAt(pos.x, pos.y))) {
      const near = nearOpenSeed ? "近くに種の気配がする…　" : "";
      return { label: "蒔く", hint: `${near}ここに種を蒔ける。`, run: () => a.showSow(pos.x, pos.y) };
    }
    return { label: "…", hint: nearOpenSeed ? "近くに種の気配がする…" : "道の上には種を蒔けない。", run: null };
  })();

  /* ---------- 描画ループに渡すもの ---------- */
  const visibleSeeds = useMemo(() => {
    const m = new Map<string, Seed>();
    for (const s of farm.publicSeeds.values()) if (!farm.hiddenSeeds.has(s.id)) m.set(s.id, s);
    for (const s of farm.mySeeds.values()) m.set(s.id, s);
    return [...m.values()];
  }, [farm.publicSeeds, farm.mySeeds, farm.hiddenSeeds]);
  const sceneRef = useRef<Scene>({
    player: { x: 8, y: 9, dir: "down", fromX: 8, fromY: 9, moveStart: 0, walking: false, frame: 0 } satisfies Player,
    seeds: [],
    kindOf: () => null,
    hasUnread: false,
  });
  const hasUnread = farm.unreadCount > 0;
  useEffect(() => {
    Object.assign(sceneRef.current, { seeds: visibleSeeds, kindOf, hasUnread });
  }, [visibleSeeds, kindOf, hasUnread]);

  /* ---------- 移動 ---------- */
  const modalOpen = useRef(modal.isOpen);
  useEffect(() => { modalOpen.current = modal.isOpen; }, [modal.isOpen]);
  // 十字キーで押している方向。押しているあいだは歩き続ける
  const heldDir = useRef<Dir | null>(null);

  const tryMove = useCallback(function step(dir: Dir) {
    if (modalOpen.current) { heldDir.current = null; return; }
    const p = sceneRef.current.player;
    if (p.walking) return;
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!WALKABLE.has(tileAt(nx, ny))) { setPos({ x: p.x, y: p.y, dir }); return; }
    p.fromX = p.x; p.fromY = p.y;
    p.x = nx; p.y = ny;
    p.walking = true;
    p.moveStart = performance.now();
    p.frame = (p.frame + 1) % 2;
    setTimeout(() => {
      p.walking = false;
      setPos({ x: p.x, y: p.y, dir: p.dir });
      if (heldDir.current) step(heldDir.current);
    }, MOVE_MS);
  }, []);

  const onDirChange = useCallback((dir: Dir | null) => {
    heldDir.current = dir;
    if (dir && !sceneRef.current.player.walking) tryMove(dir);
  }, [tryMove]);

  const pressA = () => {
    if (modal.isOpen) return;
    action.run?.();
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom", "left", "right"]}>
      <View style={s.app}>
        <View style={s.hud}>
          <T style={s.villager} numberOfLines={1}>{`${farm.name}さん`}</T>
          <View style={s.hudActions}>
            <HudBtn label="郵便受け" badge={farm.unreadCount} onPress={a.showMailbox} />
            <HudBtn label="思い出帳" onPress={a.showBook} />
            <HudBtn label="設定" onPress={() => router.push("/settings")} />
          </View>
        </View>

        <FarmMap scene={sceneRef} paused={modal.isOpen} />
        <View style={s.hint}><T style={s.hintText} accessibilityLiveRegion="polite">{action.hint}</T></View>

        <View style={s.controls}>
          <DPad onDirChange={onDirChange} onStep={tryMove} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !action.run }}
            disabled={!action.run}
            onPress={pressA}
            style={({ pressed }) => [s.aBtn, pressed && s.aBtnPressed, !action.run && { opacity: 0.6 }]}
          >
            <T style={s.aText}>{action.label}</T>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.moss },
  app: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },
  hud: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
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
  hint: { minHeight: 52, marginTop: 10, marginBottom: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.mossDeep, borderRadius: 6, justifyContent: "center" },
  hintText: { fontSize: 15, lineHeight: 22 },
  controls: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 8 },
  aBtn: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: C.leaf,
    borderColor: C.mossDeep,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.mossDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  aBtnPressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 2 } },
  aText: { fontSize: 18, color: C.ink },
});
