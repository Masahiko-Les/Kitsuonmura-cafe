import * as Haptics from "expo-haptics";
import { type ReactNode, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";

import type { Dir } from "@/lib/game";
import { C } from "@/theme";
import { T } from "./ui";

const PAD = 56;
const SIZE = PAD * 3;
const DEAD = 14; // 中心からこの距離までは「方向なし」
const STICKY = 1.25; // 斜めでちらつかないよう、今の方向を少し優先する

const ARMS: { dir: Dir; glyph: string; label: string }[] = [
  { dir: "up", glyph: "▲︎", label: "上へ" },
  { dir: "left", glyph: "◀︎", label: "左へ" },
  { dir: "right", glyph: "▶︎", label: "右へ" },
  { dir: "down", glyph: "▼︎", label: "下へ" },
];

// 指のずれ（dx, dy）から上下左右を決める。dead 以内は「方向なし」
function dirFromDelta(dx: number, dy: number, current: Dir | null, dead = DEAD): Dir | null {
  if (Math.hypot(dx, dy) < dead) return null;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const horizontal = current === "left" || current === "right";
  const vertical = current === "up" || current === "down";
  const useX = horizontal ? ay < ax * STICKY : vertical ? ax > ay * STICKY : ax > ay;
  return useX ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
}

const dirFrom = (x: number, y: number, current: Dir | null) => dirFromDelta(x - SIZE / 2, y - SIZE / 2, current);

// 方向が変わったときだけ知らせ、軽く振動させる
function useDirState(onDirChange: (dir: Dir | null) => void) {
  const [active, setActive] = useState<Dir | null>(null);
  const current = useRef<Dir | null>(null);
  const set = (dir: Dir | null) => {
    if (dir === current.current) return;
    current.current = dir;
    setActive(dir);
    onDirChange(dir);
    if (dir) Haptics.selectionAsync().catch(() => {});
  };
  return { active, current, set };
}

// 十字キー全体が1つのタッチ面。指を置いたまま滑らせると方向が変わる。
export function DPad({ onDirChange, onStep }: {
  onDirChange: (dir: Dir | null) => void;
  onStep: (dir: Dir) => void; // 読み上げ機能から1歩ずつ動かすとき
}) {
  const { active, current, set } = useDirState(onDirChange);

  const pan = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    onBegin: (e) => set(dirFrom(e.x, e.y, current.current)),
    onUpdate: (e) => set(dirFrom(e.x, e.y, current.current)),
    onFinalize: () => set(null),
  });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={s.dpad}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="移動"
        accessibilityHint="上下左右のアクションで1マスずつ歩きます"
        accessibilityActions={ARMS.map((a) => ({ name: a.dir, label: a.label }))}
        onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName as Dir)}
      >
        {ARMS.map((a) => (
          <View key={a.dir} style={[s.pad, POS[a.dir], active === a.dir && s.padOn]}>
            <T style={s.padText}>{a.glyph}</T>
          </View>
        ))}
        <View style={s.center} />
      </View>
    </GestureDetector>
  );
}

// マップの上をなぞると、なぞった方向に歩く。指を離すと止まる
export function SwipeArea({ onDirChange, children }: { onDirChange: (dir: Dir | null) => void; children: ReactNode }) {
  const { current, set } = useDirState(onDirChange);
  const pan = usePanGesture({
    minDistance: 8,
    runOnJS: true,
    onUpdate: (e) => set(dirFromDelta(e.translationX, e.translationY, current.current, 16)),
    onFinalize: () => set(null),
  });
  return (
    <GestureDetector gesture={pan}>
      <View style={s.fill}>{children}</View>
    </GestureDetector>
  );
}

const POS = StyleSheet.create({
  up: { left: PAD, top: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  left: { left: 0, top: PAD, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  right: { left: PAD * 2, top: PAD, borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  down: { left: PAD, top: PAD * 2, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
});

const s = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  dpad: { width: SIZE, height: SIZE },
  pad: {
    position: "absolute",
    width: PAD,
    height: PAD,
    backgroundColor: "rgba(60,75,55,0.55)",
    borderColor: "rgba(31,39,29,0.7)",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  padOn: { backgroundColor: "rgba(31,39,29,0.85)" },
  center: { position: "absolute", left: PAD, top: PAD, width: PAD, height: PAD, backgroundColor: "rgba(60,75,55,0.55)" },
  padText: { fontSize: 18, color: C.soft },
});
