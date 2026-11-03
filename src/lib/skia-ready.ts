// iPhone・Android では Skia はすぐ使える。Web 版は skia-ready.web.ts を使う
export const loadSkia = (): Promise<void> => Promise.resolve();
