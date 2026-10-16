/**
 * One literal `new URL(path, import.meta.url)` per asset — the same Vite-bundling pattern
 * `render/adapter/three/model-loader.ts` uses for the `.glb` models (see its doc comment for
 * why the literal form matters for static analysis). Small files under Vite's default 4KB
 * `assetsInlineLimit` (eat-food.wav, eat-bot.wav) end up inlined as base64 data URIs in a
 * production build; `HTMLAudioElement.src` accepts a `data:` URL the same way it accepts a
 * regular one, so no special-casing is needed here.
 */
export const SFX_URLS: Record<string, string> = {
  "eat-food": new URL("../../../assets/audio/eat-food.wav", import.meta.url).href,
  "eat-bot": new URL("../../../assets/audio/eat-bot.wav", import.meta.url).href,
  death: new URL("../../../assets/audio/death.wav", import.meta.url).href,
  victory: new URL("../../../assets/audio/victory.wav", import.meta.url).href,
};

export const MUSIC_URLS: Record<string, string> = {
  "ambient-music": new URL("../../../assets/audio/ambient-music.wav", import.meta.url).href,
};
