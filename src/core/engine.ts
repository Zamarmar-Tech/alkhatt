/**
 * @fileoverview Arabic text shaping engine powered by HarfBuzz (WASM).
 *
 * This module is the one mandatory piece that separates this app from a naive
 * canvas editor. Standard HTML/CSS or simple canvas text rendering cannot
 * handle Arabic calligraphy correctly because it lacks a shaping engine.
 *
 * ── Data Flow ──
 *   .ttf ArrayBuffer
 *        ↓
 *   HarfBuzz WASM ──→ shapeText() ──→ glyph IDs + x/y offsets
 *        ↓
 *   OpenType.js  ──→ shapeAndGetPaths() ──→ positioned SVG path string
 *        ↓
 *   Konva <v-path> renders the result
 *
 * ── WASM Initialization ──
 *   The HarfBuzz WASM binary (hb.wasm) is served from the `/public` directory
 *   and lazy-loaded on first call to getHbjs(). The instance is cached for
 *   subsequent calls.
 *   Konva <v-path> renders the result
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * A single positioned glyph after HarfBuzz shaping.
 * All measurements are in **font design units** (typically 1000 or 2048 per em).
 */
export interface ShapedGlyph {
  /** Glyph ID in the font's glyph table */
  glyphId: number
  /** Cluster index – which input character this glyph belongs to */
  cluster: number
  /** Horizontal advance (how far to move the cursor after this glyph) */
  advanceX: number
  /** Vertical advance (usually 0 for horizontal text) */
  advanceY: number
  /** Horizontal displacement offset (fine positioning adjustment) */
  dx: number
  /** Vertical displacement offset (fine positioning adjustment) */
  dy: number
  /** SVG path data string, populated later by OpenType.js */
  pathData: string
}

/**
 * Result returned by the shaping pipeline.
 */
export interface ShapingResult {
  /** Shaped glyphs in visual order (right-to-left for Arabic) */
  glyphs: ShapedGlyph[]
  /** Sum of all glyph advanceX values, in font units */
  totalAdvanceX: number
  /** Sum of all glyph advanceY values, in font units */
  totalAdvanceY: number
  /** Font's units-per-em (e.g. 1000, 2048) — used for pixel scaling */
  unitsPerEm: number
  /** True if at least one glyph was shaped */
  success: boolean
}

/**
 * Final output after path extraction: a combined SVG path string
 * ready for Konva rendering, plus the intermediate shaping result.
 */
export interface ShapedPathResult {
  /**
   * Combined SVG path data string.
   * Each glyph becomes a subpath (each starts with `M`).
   * Multiple subpaths in a single `d` attribute render correctly in SVG/Konva.
   */
  pathData: string
  /** The intermediate shaping result (glyph IDs, positions, metrics) */
  shapingResult: ShapingResult
}

// ────────────────────────────────────────────────────────────────────────────
// WASM Initialisation
// ────────────────────────────────────────────────────────────────────────────

/** Cached promise for the HarfBuzz JS API (singleton) */
let hbWasmPromise: Promise<any> | null = null

/**
 * Initialise (or return the cached) HarfBuzz WASM instance.
 *
 * Fetches `/hb.wasm` from the server, instantiates it, and wraps it with
 * the `harfbuzzjs` JS glue code. This is called lazily on the first
 * `shapeText()` call and cached thereafter.
 *
 * @internal
 */
async function getHbjs(): Promise<any> {
  if (!hbWasmPromise) {
    hbWasmPromise = (async () => {
      // The hbjs factory is the JS glue that maps WASM exports to a friendly API.
      // We import it dynamically to avoid loading it until shaping is needed.
      // CJS → ESM interop: `module.exports = fn` becomes the `default` export.
      const hbModule = await import('harfbuzzjs/hbjs.js')
      const hbjsFactory = hbModule.default ?? hbModule

      // Fetch the pre-built WASM binary (copied to /public during setup).
      const response = await fetch('/hb.wasm')
      if (!response.ok) {
        throw new Error(
          `Failed to fetch HarfBuzz WASM: ${response.status} ${response.statusText}`,
        )
      }
      const wasmBytes = await response.arrayBuffer()
      const result = await WebAssembly.instantiate(wasmBytes)

      return hbjsFactory(result.instance)
    })()
  }
  return hbWasmPromise
}

// ────────────────────────────────────────────────────────────────────────────
// Shaping
// ────────────────────────────────────────────────────────────────────────────

/**
 * Shape an Arabic (or any RTL/LTR) string using HarfBuzz.
 *
 * This is the core call that converts a Unicode string into positioned glyph
 * IDs. The caller is expected to take those glyph IDs and extract SVG paths
 * via OpenType.js (or use `shapeAndGetPaths()` which does both steps).
 *
 * @param fontBuffer - The `.ttf`/`.otf` font file as an `ArrayBuffer`.
 * @param text       - The text string to shape (Arabic, Persian, Urdu, etc.).
 * @param language   - BCP-47 language code (default `'arb'` for Arabic).
 *
 * @returns A `ShapingResult` containing the glyph array and font metrics.
 *
 * @example
 * ```ts
 * const buffer = await loadFontBuffer('/fonts/Amiri-Regular.ttf')
 * const result = await shapeText(buffer, 'السلام')
 * // result.glyphs → [{ glyphId: 12, advanceX: 560, dx: 0, dy: 0, ... }, ...]
 * ```
 */
export async function shapeText(
  fontBuffer: ArrayBuffer,
  text: string,
  language: string = 'arb',
): Promise<ShapingResult> {
  const hb = await getHbjs()

  // ── 1. Create HarfBuzz objects ──────────────────────────────────────────
  const blob = hb.createBlob(fontBuffer)
  const face = hb.createFace(blob, 0)
  const font = hb.createFont(face)

  // face.upem gives the font's units-per-em (e.g. 1000, 2048).
  const upem = face.upem

  // ── 2. Prepare a buffer with the text ───────────────────────────────────
  const buf = hb.createBuffer()
  buf.addText(text)

  // Arabic text flows right-to-left with the 'Arab' script tag.
  buf.setDirection('rtl')
  buf.setScript('Arab')
  buf.setLanguage(language)

  // ── 3. Shape! ───────────────────────────────────────────────────────────
  hb.shape(font, buf)

  // ── 4. Read results ────────────────────────────────────────────────────
  // json() returns an array of { g, cl, ax, ay, dx, dy, flags }.
  const glyphsJson = buf.json()

  // ── 5. Clean up ─────────────────────────────────────────────────────────
  buf.destroy()
  font.destroy()
  face.destroy()
  blob.destroy()

  const glyphs: ShapedGlyph[] = glyphsJson.map((g: any) => ({
    glyphId: g.g,
    cluster: g.cl,
    advanceX: g.ax,
    advanceY: g.ay,
    dx: g.dx,
    dy: g.dy,
    pathData: '',
  }))

  // Compute totals so the caller can calculate bounding-box / centering.
  let totalAdvanceX = 0
  let totalAdvanceY = 0
  for (const g of glyphs) {
    totalAdvanceX += g.advanceX
    totalAdvanceY += g.advanceY
  }

  return {
    glyphs,
    totalAdvanceX,
    totalAdvanceY,
    unitsPerEm: upem,
    success: glyphs.length > 0,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Shaping + Path extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Shape Arabic text and produce a single combined SVG path string ready for
 * Konva rendering.
 *
 * This is a convenience that runs both HarfBuzz (shaping) and OpenType.js
 * (path extraction) in sequence, applying the correct positioning offsets.
 *
 * @param fontBuffer - The `.ttf` font file as `ArrayBuffer`.
 * @param text       - The Arabic text string to render.
 * @param fontSize   - Desired font size in **pixels** (e.g. `72`).
 *
 * @returns A `ShapedPathResult` containing:
 *   - `pathData`: a combined SVG `d` string for Konva `<v-path>`.
 *   - `shapingResult`: the full glyph-level shaping data.
 *
 * @example
 * ```ts
 * const buffer = await loadFontBuffer('/fonts/Amiri-Regular.ttf')
 * const { pathData } = await shapeAndGetPaths(buffer, 'مرحبا', 72)
 * // pathData → "M 0 0 C 10 20 ... M 40 0 C 50 20 ..."
 * ```
 */
export async function shapeAndGetPaths(
  fontBuffer: ArrayBuffer,
  text: string,
  fontSize: number,
): Promise<ShapedPathResult> {
  // ── Step 1: HarfBuzz shaping ──────────────────────────────────────────
  const shapingResult = await shapeText(fontBuffer, text)

  if (!shapingResult.success) {
    return { pathData: '', shapingResult }
  }

  // ── Step 2: OpenType.js path extraction ───────────────────────────────
  // Dynamic import keeps the initial bundle smaller; OpenType.js is ~500 kB.
  const otModule = await import('opentype.js')
  const ot = otModule.default ?? otModule
  const font = ot.parse(fontBuffer)

  // Scale factor: convert font design units → pixels.
  //   pixel = fontUnit × (fontSize / unitsPerEm)
  const scale = fontSize / shapingResult.unitsPerEm

  let cursorX = 0 // accumulates advance in font units
  let cursorY = 0
  const pathParts: string[] = []

  for (const g of shapingResult.glyphs) {
    const glyph = font.glyphs.get(g.glyphId)
    if (!glyph) continue

    // Apply HarfBuzz's displacement offsets (dx, dy) scaled to pixels.
    const posX = (cursorX + g.dx) * scale
    const posY = (cursorY + g.dy) * scale

    // getPath(x, y, fontSize) returns an opentype.js Path object whose
    // coordinates are already absolute and scaled by fontSize.
    const glyphPath = glyph.getPath(posX, posY, fontSize)
    let pathData = glyphPath.toPathData(2) // 2 decimal places

    // Normalise SVG path data so Konva's parser can handle it.
    // OpenType.js produces compact output like "M48.31-20.74L..." which is
    // valid SVG but Konva's parser expects explicit token separators.
    // 1. Space after command letters (M, L, Q, C, Z, etc.)
    pathData = pathData.replace(/([MLQCZ])/g, ' $1 ')
    // 2. Space before a minus sign that follows a digit
    pathData = pathData.replace(/(\d)-/g, '$1 -')
    // 3. Collapse multiple spaces
    pathData = pathData.replace(/\s+/g, ' ').trim()

    if (pathData && pathData !== 'M0 0Z') {
      pathParts.push(pathData)
    }

    // Advance the cursor in font units (OpenType.js handles its own scaling).
    cursorX += g.advanceX
    cursorY += g.advanceY
  }

  return {
    // Multiple SVG subpaths (each starting with M) render correctly in Konva.
    pathData: pathParts.join(' '),
    shapingResult,
  }
}
