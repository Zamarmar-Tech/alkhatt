/**
 * @fileoverview Web Worker: HarfBuzz + OpenType.js shaping pipeline.
 *
 * Runs in a completely isolated thread. Communicates with the main thread
 * exclusively via `postMessage` / `onmessage`.
 *
 * ── Messages the worker accepts ──
 *   INIT_WASM   { wasmUrl: string }              — load HarfBuzz WASM once
 *   SHAPE_TEXT  { text, fontBuffer, fontSize }    — shape + extract SVG paths
 *
 * ── Messages the worker sends back ──
 *   WASM_LOADED { success }
 *   TEXT_SHAPED { pathData, glyphCount, unitsPerEm, error? }
 *   ERROR       { error }
 */

let hbjs: any = null
let opentypeParse: ((buf: ArrayBuffer) => any) | null = null

// ── Lazy initialisers ────────────────────────────────────────────────────

async function initHarfBuzz(wasmUrl: string): Promise<void> {
  const hbModule = await import('harfbuzzjs/hbjs.js')
  const hbjsFactory = hbModule.default ?? hbModule
  const response = await fetch(wasmUrl)
  if (!response.ok) throw new Error(`WASM fetch failed: ${response.status}`)
  const wasmBytes = await response.arrayBuffer()
  const result = await WebAssembly.instantiate(wasmBytes)
  hbjs = hbjsFactory(result.instance)
}

async function getOpenType(): Promise<(buf: ArrayBuffer) => any> {
  if (!opentypeParse) {
    const mod = await import('opentype.js')
    const ot = mod.default ?? mod
    opentypeParse = ot.parse.bind(ot)
  }
  return opentypeParse!
}

// ── Core shaping logic ───────────────────────────────────────────────────

async function doShape(payload: {
  text: string
  fontBuffer: ArrayBuffer
  fontSize: number
}): Promise<{ pathData: string; glyphCount: number; unitsPerEm: number }> {
  if (!hbjs) throw new Error('HarfBuzz not initialised')

  // 1. HarfBuzz shaping
  const blob = hbjs.createBlob(payload.fontBuffer)
  const face = hbjs.createFace(blob, 0)
  const font = hbjs.createFont(face)
  const upem = face.upem

  const buf = hbjs.createBuffer()
  buf.addText(payload.text)
  buf.setDirection('rtl')
  buf.setScript('Arab')
  buf.setLanguage('arb')
  hbjs.shape(font, buf)
  const glyphs = buf.json()
  buf.destroy()

  // 2. OpenType.js path extraction
  const parse = await getOpenType()
  const otFont = parse(payload.fontBuffer)
  const scale = payload.fontSize / upem

  let cursorX = 0
  let cursorY = 0
  const parts: string[] = []

  for (const g of glyphs) {
    const glyph = otFont.glyphs.get(g.g)
    if (!glyph) continue
    const posX = (cursorX + g.dx) * scale
    const posY = (cursorY + g.dy) * scale
    const gp = glyph.getPath(posX, posY, payload.fontSize)
    let pd = gp.toPathData(2)
    // Normalise SVG tokens for Konva
    pd = pd.replace(/([MLQCZ])/g, ' $1 ')
      .replace(/(\d)-/g, '$1 -')
      .replace(/\s+/g, ' ').trim()
    if (pd && pd !== 'M0 0Z') parts.push(pd)
    cursorX += g.ax
    cursorY += g.ay
  }

  font.destroy()
  face.destroy()
  blob.destroy()

  return { pathData: parts.join(' '), glyphCount: glyphs.length, unitsPerEm: upem }
}

// ── Message dispatcher ──────────────────────────────────────────────────

self.onmessage = async function (e: MessageEvent) {
  const { type, payload, id } = e.data

  try {
    switch (type) {
      case 'INIT_WASM':
        await initHarfBuzz(payload.wasmUrl)
        self.postMessage({ type: 'WASM_LOADED', payload: { success: true }, id })
        break

      case 'SHAPE_TEXT': {
        const result = await doShape(payload)
        self.postMessage({ type: 'TEXT_SHAPED', payload: result, id })
        break
      }

      default:
        self.postMessage({ type: 'ERROR', payload: { error: `Unknown type: ${type}` }, id })
    }
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', payload: { error: err.message ?? String(err) }, id })
  }
}
