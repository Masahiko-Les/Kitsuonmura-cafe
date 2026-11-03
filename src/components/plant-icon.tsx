import { Canvas, Group, Picture, Skia, createPicture } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { View } from "react-native";

import { drawPlant } from "./flower-art";

// 植物のドット絵アイコン（思い出帳や水やり後の画面で使う）
export function PlantIcon({ stage, flower, size = 48, radius = 4 }: { stage: number; flower: number; size?: number; radius?: number }) {
  const pic = useMemo(() => createPicture((c) => {
    const p = Skia.Paint();
    p.setAntiAlias(false);
    drawPlant((x, y, w, h, col) => { p.setColor(Skia.Color(col)); c.drawRect(Skia.XYWHRect(x, y, w, h), p); }, 0, 0, stage, flower);
  }, Skia.XYWHRect(0, 0, 16, 16)), [stage, flower]);
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#9cc27a", overflow: "hidden" }}>
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[{ scale: size / 16 }]}>
          <Picture picture={pic} />
        </Group>
      </Canvas>
    </View>
  );
}

export function BigFlower({ stage, flower }: { stage: number; flower: number }) {
  return (
    <View style={{ alignSelf: "center", marginTop: 4, marginBottom: 8 }}>
      <PlantIcon stage={stage} flower={flower} size={96} radius={8} />
    </View>
  );
}
