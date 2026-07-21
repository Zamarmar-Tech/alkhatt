/**
 * @fileoverview Canvas state management.
 *
 * The central store for all canvas content: layers, text input, font
 * selection, and viewport (zoom/pan). This store is the single source of
 truth that drives what appears on the Fabric.js canvas.
 *
 * ── Data Flow ──
 *   User types text → canvasStore.activeText changes
 *        ↓
 *   A watcher (in the component layer) calls the shaping engine
 *        ↓
 *   New SVG path data is written to the active layer
 *        ↓
 Fabric.js Path object is rendered on <canvas>
 *
 * @see {@link shapeAndGetPaths} in `@/core/engine.ts`
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * A single layer on the canvas.
 *
 * Each layer corresponds to one rendered element (a text path, a group,
 * etc.) on the Fabric.js canvas.
 */
export interface CanvasLayer {
  /** Unique identifier (generated via `crypto.randomUUID()` or similar). */
  id: string
  /** Human-readable name shown in the Layers panel. */
  name: string
  /** Layer type — eventually may include 'group' for compound objects. */
  type: 'path' | 'group'
  /** Whether the layer is visible on the canvas. */
  visible: boolean
  /** Whether the layer is locked (prevents selection/editing). */
  locked: boolean
  /** Opacity from 0 (transparent) to 1 (opaque). */
  opacity: number
  /** SVG path `d` attribute string rendered on the canvas. */
  pathData?: string
  /** X position offset on the stage. */
  x: number
  /** Y position offset on the stage. */
  y: number
  /** Fill colour (CSS colour string). */
  fill?: string
  /** Stroke colour (CSS colour string). */
  stroke?: string
  /** Stroke width in pixels. */
  strokeWidth?: number
}

/**
 * Canvas Store — manages canvas content, text input, font settings,
 * and viewport (zoom/pan) state.
 */
export const useCanvasStore = defineStore('canvas', () => {
  // ── Layers ─────────────────────────────────────────────────────────────

  /** Ordered array of all layers on the canvas. */
  const layers = ref<CanvasLayer[]>([])

  /** ID of the currently selected (highlighted) layer, or `null`. */
  const activeLayerId = ref<string | null>(null)

  /**
   * Convenience getter — returns the currently active layer object,
   * or `null` if nothing is selected.
   */
  const activeLayer = computed(() => {
    if (!activeLayerId.value) return null
    return layers.value.find((l) => l.id === activeLayerId.value) ?? null
  })

  // ── Text input ─────────────────────────────────────────────────────────

  /** The raw Arabic text the user has typed. */
  const activeText = ref('')
  /** Which font family to use (folder name under `src/assets/fonts/`). */
  const selectedFont = ref('Amiri')
  /** Font size in pixels. */
  const fontSize = ref(72)

  /** SVG path data for the current shaped text (populated by the shaping engine). */
  const currentPathData = ref('')

  /** Current position of the text group (used for nudging / dragging). */
  const groupX = ref(40)
  const groupY = ref(0) // set dynamically by fontSize

  // ── Stroke / fill ──────────────────────────────────────────────────────

  const strokeColor = ref('#ffffff')
  const fillColor = ref('#ffffff')
  const strokeWidth = ref(2)

  // ── Viewport ───────────────────────────────────────────────────────────

  /** Current zoom level as a percentage (100 = 100%). Clamped 10–500. */
  const zoom = ref(100)
  /** Horizontal scroll / pan offset on the stage. */
  const stageX = ref(0)
  /** Vertical scroll / pan offset on the stage. */
  const stageY = ref(0)

  // ── Layer actions ──────────────────────────────────────────────────────

  /** Add a new layer and auto-select it. */
  function addLayer(layer: CanvasLayer) {
    layers.value.push(layer)
    activeLayerId.value = layer.id
  }

  /** Remove a layer by ID. If it was active, select the next one. */
  function removeLayer(id: string) {
    const idx = layers.value.findIndex((l) => l.id === id)
    if (idx !== -1) {
      layers.value.splice(idx, 1)
      if (activeLayerId.value === id) {
        activeLayerId.value = layers.value[layers.value.length - 1]?.id ?? null
      }
    }
  }

  /** Merge a partial patch into an existing layer. */
  function updateLayer(id: string, patch: Partial<CanvasLayer>) {
    const layer = layers.value.find((l) => l.id === id)
    if (layer) {
      Object.assign(layer, patch)
    }
  }

  // ── Text / font actions ────────────────────────────────────────────────

  function setActiveText(text: string) {
    activeText.value = text
  }

  function setActiveLayer(id: string | null) {
    activeLayerId.value = id
  }

  // ── Zoom actions ───────────────────────────────────────────────────────

  /**
   * Set zoom level, clamped to the valid range [10, 500].
   * Rounds to the nearest integer.
   */
  function setZoom(value: number) {
    zoom.value = Math.round(Math.max(10, Math.min(500, value)))
  }

  /** Zoom in by 10%. */
  function zoomIn() {
    setZoom(zoom.value * 1.1)
  }

  /** Zoom out by 10%. */
  function zoomOut() {
    setZoom(zoom.value / 1.1)
  }

  /** Reset zoom to 100% and centre the viewport. */
  function zoomToFit() {
    setZoom(100)
    stageX.value = 0
    stageY.value = 0
  }

  return {
    layers,
    activeLayerId,
    activeLayer,
    activeText,
    selectedFont,
    fontSize,
    currentPathData,
    groupX,
    groupY,
    strokeColor,
    fillColor,
    strokeWidth,
    zoom,
    stageX,
    stageY,
    addLayer,
    removeLayer,
    updateLayer,
    setActiveText,
    setActiveLayer,
    setZoom,
    zoomIn,
    zoomOut,
    zoomToFit,
  }
})
