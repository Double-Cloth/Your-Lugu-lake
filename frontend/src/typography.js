/**
 * Single source of truth for the two brand faces.
 * CSS consumes the same stacks through `--font-ui` / `--font-display` in
 * ui-polish.css; canvas code (posters, exported images) uses these constants so
 * generated artwork can never drift back to a platform font.
 */
export const UI_FONT =
  "'MiSans VF', 'MiSans', 'PingFang SC', 'HarmonyOS Sans SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

export const DISPLAY_FONT =
  "'LXGW WenKai', 'LXGW WenKai Screen', 'STKaiti', 'KaiTi', 'Songti SC', serif";

export const MONO_FONT =
  "'LXGW WenKai Mono', 'LXGW WenKai', 'STKaiti', 'KaiTi', monospace";

export function canvasFont({
  weight = 400,
  size = 16,
  family = UI_FONT,
  style = "normal",
} = {}) {
  return `${style} ${weight} ${size}px ${family}`;
}

/**
 * Make sure the requested faces/glyphs are ready before drawing to a canvas.
 * `document.fonts.load` also works for the unicode-range subset files shipped
 * by the npm font packages.
 */
export async function loadBrandFonts(specs = []) {
  if (typeof document === "undefined" || !document.fonts) {
    return;
  }

  try {
    await Promise.all(
      specs.map(({ text = "泸沽湖", ...options }) =>
        document.fonts.load(canvasFont(options), text),
      ),
    );
    await document.fonts.ready;
  } catch {
    // Canvas keeps the family fallback in typography.js if a face fails.
  }
}
