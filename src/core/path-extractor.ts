/**
 * @fileoverview Font loading utility.
 *
 * Provides a single function to fetch `.ttf` / `.otf` font files from the
 * server and return them as `ArrayBuffer`, which is the format required by
 * both HarfBuzz (for shaping) and OpenType.js (for path extraction).
 *
 * Font files live under `src/assets/fonts/`. Vite serves them as static
 * assets during development and copies them to the build output.
 */

/**
 * Fetch a font file from its URL path and return the raw bytes.
 *
 * The font path should be relative to the site root. For fonts in
 * `src/assets/fonts/`, use e.g. `'/fonts/Amiri/Amiri-Regular.ttf'`.
 *
 * @param fontPath - URL path to the `.ttf` or `.otf` font file.
 * @returns The font file contents as an `ArrayBuffer`.
 *
 * @throws Will throw if the HTTP request fails (network error or non-2xx).
 *
 * @example
 * ```ts
 * const buf = await loadFontBuffer('/fonts/Amiri/Amiri-Regular.ttf')
 * const { pathData } = await shapeAndGetPaths(buf, 'سلام', 72)
 * ```
 */
export async function loadFontBuffer(fontPath: string): Promise<ArrayBuffer> {
  const response = await fetch(fontPath)
  if (!response.ok) {
    throw new Error(
      `Failed to load font (${response.status}): ${fontPath}`,
    )
  }
  return await response.arrayBuffer()
}
