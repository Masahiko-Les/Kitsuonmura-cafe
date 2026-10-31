import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";

import type { Dir } from "@/lib/game";
import { C } from "@/theme";
import { T } from "./ui";

const PAD = 60;
const SIZE = PAD * 3;
const DEAD = 14; // 中心からこの距離までは「方向なし」
const STICKY = 1.25; // 斜めでちらつかないよう、今の方向を少し優先する

const ARMS: { dir: Dir; glyph: string; label: string }[] = [
  { dir: "up", glyph: "▲︎", label: "上へ" },
  { dir: "left", glyph: "◀︎", label: "左へ" },
  { dir: "right", glyph: "▶︎", label: "右へ" },
  { dir: "down", glyph: "▼︎", label: "下へ" },
];

function dirFrom(x: number, y: number, current: Dir | null): Dir | null {
  const dx = x - SIZE / 2;
  const dy = y - SIZE / 2;
  if (Math.hypot(dx, dy) < DEAD) return null;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const horizontal = current === "left" || current === "right";
  const vertical = current === "up" || current === "down";
  const useX = horizontal ? ay < ax * STICKY : vertical ? ax > ay * STICKY : ax > ay;
  return useX ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
}

// 十字キー全体が1つのタッチ面。指を置いたまま滑らせると方向が変わる。
export function DPad({ onDirChange, onStep }: {
  onDirChange: (dir: Dir | null) => void;
  onStep: (dir: Dir) => void; // 読み上げ機能から1歩ずつ動かすとき
}) {
  const [active, setActive] = useState<Dir | null>(null);
  const current = useRef<Dir | null>(null);

  const set = (dir: Dir | null) => {
    if (dir === current.current) return;
    current.current = dir;
    setActive(dir);
    onDirChange(dir);
    if (dir) Haptics.selectionAsync().catch(() => {});
  };

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
          <View key={a.dir} style={[s.pad, POS[a.dir], active === a.dir && { backgroundColor: C.mossDeep }]}>
            <T style={s.padText}>{a.glyph}</T>
          </View>
        ))}
        <View style={s.center} />
      </View>
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
  dpad: { width: SIZE, height: SIZE },
  pad: {
    position: "absolute",
    width: PAD,
    height: PAD,
    backgroundColor: C.mossSoft,
    borderColor: C.mossDeep,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { position: "absolute", left: PAD, top: PAD, width: PAD, height: PAD, backgroundColor: C.mossSoft },
  padText: { fontSize: 18, color: C.soft },
});
