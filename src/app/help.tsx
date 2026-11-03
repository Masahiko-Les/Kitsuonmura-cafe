import { ScrollView } from "react-native";

import { Small, Tips } from "@/components/ui";
import { HELP_ITEMS } from "@/modals";

export default function Help() {
  return (
    <ScrollView contentContainerStyle={{ padding: 18, width: "100%", maxWidth: 480, alignSelf: "center" }}>
      <Tips items={HELP_ITEMS} />
      <Small>「できたこと」はこのスマホの中だけに保存され、ほかの村人には見えません。カフェで「届けてもよい」を選んだ言葉だけが、運営の確認のあとで、名前を出さずにほかの村人に紹介されます。</Small>
    </ScrollView>
  );
}
