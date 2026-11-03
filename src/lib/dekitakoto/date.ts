// 端末のローカル日付 YYYY-MM-DD（開発中だけ dayOffset 日ずらせる）
export function todayStr(dayOffset = 0) {
  const d = new Date(Date.now() + dayOffset * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const jp = (s: string) => {
  const [, m, d] = s.split("-").map(Number);
  return `${m}月${d}日`;
};
export const jpY = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
