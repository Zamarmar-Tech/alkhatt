/**
 * @fileoverview Bridge: mitt event bus ↔ Web Worker.
 *
 * ── Flow ──
 *   UI emits `canvas:shape-request` (mitt)
 *        ↓
 *   Bridge catches it, loads font, sends `SHAPE_TEXT` to Worker (postMessage)
 *        ↓
 *   Worker processes HarfBuzz + OpenType.js
 *        ↓
 *   Worker replies with `TEXT_SHAPED` (postMessage)
 *        ↓
 *   Bridge emits `canvas:shaped` (mitt) → CanvasStage updates Konva
 */
import { emitter } from '@/lib/eventBus'
import { loadFontBuffer } from '@/core/path-extractor'

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, (result: any) => void>()

/**
 * Spawn the Web Worker and wire up the mitt ↔ Worker bridge.
 * Call once from App.vue.
 */
export function initWorkerBridge() {
  if (worker) return

  // ── Spawn worker ──────────────────────────────────────────────────────
  worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })

  // ── Listen for Worker replies ─────────────────────────────────────────
  worker.onmessage = function (e: MessageEvent) {
    const { type, payload, id } = e.data

    // Resolve a pending Promise-based request
    if (id !== undefined && pending.has(id)) {
      pending.get(id)!(payload)
      pending.delete(id)
      return
    }

    // WASM initialised (fire-and-forget)
    if (type === 'WASM_LOADED') {
      console.log('[Bridge] HarfBuzz WASM ready in worker')
      return
    }

    // Relay errors
    if (type === 'ERROR') {
      console.error('[Bridge] Worker error:', payload.error)
    }
  }

  worker.onerror = (err) => console.error('[Bridge] Unhandled worker error:', err.message)

  // ── Listen for mitt events → forward to Worker ────────────────────────
  emitter.on('canvas:shape-request', async ({ text, fontUrl, fontSize }) => {
    try {
      const fontBuffer = await loadFontBuffer(fontUrl)
      const result: any = await sendToWorker('SHAPE_TEXT', { text, fontBuffer, fontSize })
      emitter.emit('canvas:shaped', {
        pathData: result.pathData,
        success: true,
      })
    } catch (err: any) {
      emitter.emit('canvas:shaped', {
        pathData: '',
        success: false,
        error: err.message ?? String(err),
      })
    }
  })
}

/**
 * Initialise HarfBuzz WASM inside the worker.
 * Call after `initWorkerBridge()`.
 */
export function initWorkerWasm() {
  return sendToWorker('INIT_WASM', { wasmUrl: '/hb.wasm' })
}

/**
 * Send a message to the worker and return a Promise for the response.
 */
function sendToWorker(type: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('Worker not initialised')); return }
    const id = ++requestId
    pending.set(id, resolve)
    worker.postMessage({ type, payload, id })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error('Worker request timed out'))
      }
    }, 30_000)
  })
}

/**
 * Terminate the worker (e.g. on app unmount).
 */
export function destroyWorker() {
  worker?.terminate()
  worker = null
  pending.clear()
}
