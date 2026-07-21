<script setup lang="ts">
/**
 * @fileoverview Fabric.js v7 canvas wrapper for the Arabic calligraphy editor.
 *
 * Handles:
 *  - Fabric.Canvas lifecycle (init, resize, dispose)
 *  - Grid dot rendering
 *  - Path rendering from shaped SVG data
 *  - Object selection with bounding box
 *  - Marquee (click-drag) selection
 *  - Zoom (scroll wheel) & pan (middle-click / Hand tool)
 *  - Anchor-point editing (Edit Path tool)
 *  - Reactive sync with canvasStore + mitt event bus
 *
 * CRITICAL: The Fabric Canvas instance is stored in a shallowRef() to
 * prevent Vue's deep Proxy from corrupting Fabric's internal state.
 */
import { ref, shallowRef, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { Canvas, Path, Group, Rect, Circle, Line, Point, ActiveSelection } from 'fabric'
import type { TPointerEventInfo } from 'fabric'
import { useCanvasStore } from '@/stores/canvasStore'
import { useUiStore } from '@/stores/uiStore'
import { emitter } from '@/lib/eventBus'
import { fontRegistry } from '@/core/font-registry'
import {
  parsePath,
  getAnchorPoints,
  updateAnchorPoint,
  simplifyAnchors,
  type AnchorPoint,
  type PathCommand,
} from '@/core/path-editor'

const store = useCanvasStore()
const ui = useUiStore()

// ── DOM refs ──────────────────────────────────────────────────────────────
const containerRef = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

// ── Fabric instance (shallowRef — never let Vue proxy it!) ────────────────
const canvasRef = shallowRef<Canvas | null>(null)

// ── Sizing ────────────────────────────────────────────────────────────────
const stageWidth = ref(1200)
const stageHeight = ref(800)

// ── Shaping state ─────────────────────────────────────────────────────────
const shaping = ref(false)
const shapingError = ref<string | null>(null)

// ── Selection ─────────────────────────────────────────────────────────────
const objectSelected = computed(() => selectedIndices.value.size > 0)
const showingAnchors = computed(() => selectedIndices.value.size === 1 && ui.activeTool === 'edit-path')
let selRects: Rect[] = []

// ── Marquee ───────────────────────────────────────────────────────────────
const isMarquee = ref(false)
const marqueeStart = ref({ x: 0, y: 0 })
const marqueeEnd = ref({ x: 0, y: 0 })
let marqueeObj: Rect | null = null

// ── Cursor ────────────────────────────────────────────────────────────────
const CURSOR: Record<string, string> = {
  select: 'default',
  'edit-path': 'default',
  pen: 'crosshair',
  text: 'text',
  hand: 'grab',
  zoom: 'zoom-in',
  eyedropper: 'crosshair',
}
const isStageDragging = ref(false)
const cursorStyle = computed(() => (isStageDragging.value ? 'grabbing' : (CURSOR[ui.activeTool] ?? 'default')))

// ── Fabric objects (NOT reactive — stored as plain variables) ─────────────
let gridGroup: Group | null = null
/** All text objects on the canvas. Index 0 is always the "main" shaped text. */
const textObjects: { group: Group; path: Path }[] = []
const selectedIndices = ref<Set<number>>(new Set())
const hasSelection = computed(() => selectedIndices.value.size > 0)
/** Return the "primary" selected object (last clicked / topmost) */
function getActiveGroup(): Group | null {
  const arr = [...selectedIndices.value]
  return arr.length ? textObjects[arr[arr.length - 1]]?.group ?? null : null
}
function getActivePath(): Path | null {
  const arr = [...selectedIndices.value]
  return arr.length ? textObjects[arr[arr.length - 1]]?.path ?? null : null
}
/** All selected groups (for ActiveSelection drag) */
function getSelectedGroups(): Group[] {
  return [...selectedIndices.value].map(i => textObjects[i]?.group).filter(Boolean) as Group[]
}
let anchorGroup: Group | null = null

// ── Anchor editing state ──────────────────────────────────────────────────
const parsedCommands = ref<PathCommand[]>([])
const anchorPoints = ref<AnchorPoint[]>([])
const editingPathData = ref('')
let anchorCircleObjs: Circle[] = []
let handleLineObjs: Line[] = []

// ── Path helpers ──────────────────────────────────────────────────────────

function parsePathData(data: string) {
  if (!data) {
    parsedCommands.value = []
    anchorPoints.value = []
    editingPathData.value = ''
    return
  }
  const commands = parsePath(data)
  parsedCommands.value = commands
  anchorPoints.value = simplifyAnchors(getAnchorPoints(commands), 12)
  editingPathData.value = data
}

watch(() => store.currentPathData, parsePathData)

// ── Text shaping via event bus ────────────────────────────────────────────

let shapeTimer: ReturnType<typeof setTimeout> | null = null

function requestShape() {
  const text = store.activeText.trim()
  if (!text) {
    store.currentPathData = ''
    shapingError.value = null
    return
  }
  const fontUrl = fontRegistry[store.selectedFont]
  if (!fontUrl) {
    shapingError.value = 'Unknown font: ' + store.selectedFont
    return
  }
  shaping.value = true
  shapingError.value = null
  emitter.emit('canvas:shape-request', {
    text,
    fontUrl,
    fontSize: store.fontSize,
    font: store.selectedFont,
  })
}

watch(
  () => [store.activeText, store.selectedFont, store.fontSize],
  () => {
    if (shapeTimer) clearTimeout(shapeTimer)
    shapeTimer = setTimeout(requestShape, 300)
  },
  { deep: true },
)

emitter.on('canvas:shaped', ({ pathData, success, error }: { pathData: string; success: boolean; error?: string }) => {
  shaping.value = false
  if (success) {
    store.currentPathData = pathData
    shapingError.value = null
  } else {
    shapingError.value = error ?? 'Shaping failed'
    store.currentPathData = ''
  }
})

// ═══════════════════════════════════════════════════════════════════════════
//  Canvas Setup
// ═══════════════════════════════════════════════════════════════════════════

function initCanvas() {
  const el = canvasEl.value
  if (!el) return

  const canvas = new Canvas(el, {
    width: stageWidth.value,
    height: stageHeight.value,
    backgroundColor: 'transparent',
    selection: false, // we manage selection ourselves
    renderOnAddRemove: false,
  })

  canvasRef.value = canvas

  // ── Set initial viewport ────────────────────────────────────────────
  syncViewport()

  // ── Render grid ─────────────────────────────────────────────────────
  renderGrid()

  // ── Render path if data exists ──────────────────────────────────────
  if (store.currentPathData) {
    renderPath()
  }

  // ── Remove built-in Fabric selection box ────────────────────────────
  if (canvas.getActiveSelection) {
    canvas.discardActiveObject()
  }

  canvas.requestRenderAll()
}

function syncViewport() {
  const canvas = canvasRef.value
  if (!canvas) return
  const zoom = store.zoom / 100
  canvas.setZoom(zoom)
  canvas.absolutePan(new Point(store.stageX, store.stageY))
  canvas.requestRenderAll()
}

// ═══════════════════════════════════════════════════════════════════════════
//  Grid
// ═══════════════════════════════════════════════════════════════════════════

const GRID_SIZE = 40
const GRID_DOT_R = 1.5

function renderGrid() {
  const canvas = canvasRef.value
  if (!canvas) return

  if (gridGroup) {
    canvas.remove(gridGroup)
    gridGroup = null
  }

  const dots: Circle[] = []
  const zoom = canvas.getZoom()
  const vpt = canvas.viewportTransform!
  const panX = -vpt[4] / zoom
  const panY = -vpt[5] / zoom
  const viewW = stageWidth.value / zoom + 200
  const viewH = stageHeight.value / zoom + 200
  const ox = Math.floor(panX / GRID_SIZE) * GRID_SIZE
  const oy = Math.floor(panY / GRID_SIZE) * GRID_SIZE

  for (let i = 0; i < Math.ceil(viewW / GRID_SIZE) + 2; i++) {
    for (let j = 0; j < Math.ceil(viewH / GRID_SIZE) + 2; j++) {
      dots.push(
        new Circle({
          left: ox + i * GRID_SIZE,
          top: oy + j * GRID_SIZE,
          radius: GRID_DOT_R / zoom,
          fill: getGridColor(),
          selectable: false,
          evented: false,
          hoverCursor: 'default',
        }),
      )
    }
  }

  gridGroup = new Group(dots, {
    selectable: false,
    evented: false,
    excludeFromExport: true,
  })
  canvas.add(gridGroup)
  canvas.sendObjectToBack(gridGroup)
}

function getGridColor(): string {
  const style = getComputedStyle(document.documentElement)
  const c = style.getPropertyValue('--muted-foreground').trim()
  const m = c.match(/hsl\((\d+)\s+([\d.]+%)\s+([\d.]+%)\)/i)
  return m ? `hsla(${m[1]}, ${m[2]}, ${m[3]}, 0.35)` : 'hsla(0,0%,60%,0.35)'
}

// ═══════════════════════════════════════════════════════════════════════════
//  Path Rendering
// ═══════════════════════════════════════════════════════════════════════════

function renderPath() {
  const canvas = canvasRef.value
  if (!canvas) return

  // Remove old
  if (getActiveGroup()) {
    canvas.remove(getActiveGroup()!)
    textObjects.length = 0
  }
  removeSelectionRects()
  clearAnchors()
  selectedIndices.value = new Set()

  const d = store.currentPathData
  if (!d) {
    canvas.requestRenderAll()
    return
  }

  const newPath = new Path(d, {
    fill: store.fillColor,
    stroke: store.strokeColor,
    strokeWidth: store.strokeWidth,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    selectable: false,
    evented: true,
    perPixelTargetFind: true,
  })

  const newGroup = new Group([newPath], {
    left: store.groupX,
    top: store.groupY || store.fontSize * 1.4,
    originX: 'left',
    originY: 'top',
    selectable: true,
    evented: true,
    hasControls: false,
    hasBorders: false,
    lockRotation: true,
    lockScaling: true,
    subTargetCheck: true,
  })

  // Replace index 0 (main text) or push if empty
  if (textObjects[0]) {
    canvas.remove(textObjects[0].group)
    textObjects[0] = { group: newGroup, path: newPath }
  } else {
    textObjects.push({ group: newGroup, path: newPath })
  }
  selectedIndices.value = new Set([0])

  canvas.add(newGroup)
  canvas.requestRenderAll()

  const po = (newPath as any).pathOffset
  const br = newPath.getBoundingRect()
  console.log('[RENDER] group pos:', { gx: newGroup.left, gy: newGroup.top })
  console.log('[RENDER] pathOffset:', po)
  console.log('[RENDER] getBoundingRect:', JSON.stringify(br))
  console.log('[RENDER] path data (first 120):', d.slice(0, 120))
}

// Re-render path when store data changes
watch(
  () => [store.currentPathData, store.fillColor, store.strokeColor, store.strokeWidth] as const,
  () => {
    const canvas = canvasRef.value
    if (!canvas) return
    if (store.currentPathData) {
      renderPath()
    } else if (getActiveGroup()) {
      deselectObject()
      canvas.remove(getActiveGroup()!)
      textObjects.length = 0
      canvas.requestRenderAll()
    }
  },
)

// Sync group position
watch(
  () => [store.groupX, store.groupY] as const,
  () => {
    if (getActiveGroup()) {
      getActiveGroup().set({ left: store.groupX, top: store.groupY ?? store.fontSize * 1.4 })
      getActiveGroup().setCoords()
      if (objectSelected.value) showSelectionBox()
      canvasRef.value?.requestRenderAll()
    }
  },
)

// ═══════════════════════════════════════════════════════════════════════════
//  Selection
// ═══════════════════════════════════════════════════════════════════════════

function removeSelectionRects() {
  const canvas = canvasRef.value
  for (const r of selRects) { canvas?.remove(r) }
  selRects = []
}

function showSelectionBox() {
  const canvas = canvasRef.value
  if (!canvas) return
  removeSelectionRects()
  for (const idx of selectedIndices.value) {
    const obj = textObjects[idx]
    if (!obj) continue
    const bounds = obj.path.getBoundingRect()
    const r = new Rect({
      left: bounds.left - 4,
      top: bounds.top - 4,
      width: bounds.width + 8,
      height: bounds.height + 8,
      originX: 'left',
      originY: 'top',
      fill: 'transparent',
      stroke: '#3b82f6',
      strokeWidth: 1.5,
      strokeDashArray: [5, 3],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    })
    canvas.add(r)
    selRects.push(r)
  }
  canvas.requestRenderAll()
}

function selectObject() {
  if (ui.activeTool !== 'select' && ui.activeTool !== 'edit-path') return
  if (selectedIndices.value.size === 0) return
  console.log('[SELECT] selected:', [...selectedIndices.value])
  showSelectionBox()
  if (ui.activeTool === 'edit-path' && selectedIndices.value.size === 1) {
    renderAnchors()
  }
}

// ── Alt+drag duplicate ───────────────────────────────────────────────

function duplicateAndDrag() {
  const canvas = canvasRef.value
  if (!canvas || !getActivePath() || !getActiveGroup()) return

  const d = store.currentPathData
  const newPath = new Path(d, {
    fill: store.fillColor,
    stroke: store.strokeColor,
    strokeWidth: store.strokeWidth,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    selectable: false,
    evented: false,
    perPixelTargetFind: true,
  })

  const newGroup = new Group([newPath], {
    left: getActiveGroup().left,
    top: getActiveGroup().top,
    originX: 'left',
    originY: 'top',
    selectable: true,
    evented: true,
    hasControls: false,
    hasBorders: false,
    lockRotation: true,
    lockScaling: true,
  })

  canvas.add(newGroup)
  textObjects.push({ group: newGroup, path: newPath })
  canvas.requestRenderAll()
}

// ── Multi-select drag ─────────────────────────────────────────────────
const isMultiDragging = ref(false)
let multiDragStart: Point | null = null
let multiDragOrigins: { left: number; top: number }[] = []

function startMultiDrag(scenePoint: Point) {
  const canvas = canvasRef.value
  if (!canvas) return

  // Disable individual Fabric drag on all selected groups
  for (const idx of selectedIndices.value) {
    textObjects[idx]?.group.set({ selectable: false })
  }

  multiDragStart = scenePoint
  multiDragOrigins = [...selectedIndices.value].map(i => {
    const g = textObjects[i]?.group
    return { left: g?.left ?? 0, top: g?.top ?? 0 }
  })
  isMultiDragging.value = true
  showSelectionBox()
}

function updateMultiDrag(scenePoint: Point) {
  if (!isMultiDragging.value || !multiDragStart) return
  const dx = scenePoint.x - multiDragStart.x
  const dy = scenePoint.y - multiDragStart.y
  const indices = [...selectedIndices.value]
  for (let j = 0; j < indices.length; j++) {
    const g = textObjects[indices[j]]?.group
    if (g) {
      g.set({
        left: multiDragOrigins[j].left + dx,
        top: multiDragOrigins[j].top + dy,
      })
      g.setCoords()
    }
  }
  removeSelectionRects()
  showSelectionBox()
  canvasRef.value?.requestRenderAll()
}

function endMultiDrag() {
  if (!isMultiDragging.value) return
  isMultiDragging.value = false
  multiDragStart = null
  // Re-enable individual Fabric drag
  for (const idx of selectedIndices.value) {
    textObjects[idx]?.group.set({ selectable: true })
  }
  // Sync primary object position to store
  const g = getActiveGroup()
  if (g) {
    store.groupX = g.left
    store.groupY = g.top
  }
}

function deselectObject() {
  selectedIndices.value = new Set()
  removeSelectionRects()
  clearAnchors()
  canvasRef.value?.requestRenderAll()
}

// ═══════════════════════════════════════════════════════════════════════════
//  Marquee Selection
// ═══════════════════════════════════════════════════════════════════════════

function startMarquee(scenePoint: Point) {
  const canvas = canvasRef.value
  if (!canvas) return
  isMarquee.value = true
  marqueeStart.value = { x: scenePoint.x, y: scenePoint.y }
  marqueeEnd.value = { x: scenePoint.x, y: scenePoint.y }

  marqueeObj = new Rect({
    left: scenePoint.x,
    top: scenePoint.y,
    width: 0,
    height: 0,
    originX: 'left',
    originY: 'top',
    fill: 'rgba(59,130,246,0.08)',
    stroke: '#3b82f6',
    strokeWidth: 1,
    strokeDashArray: [5, 3],
    selectable: false,
    evented: false,
    excludeFromExport: true,
  })
  canvas.add(marqueeObj)
  canvas.requestRenderAll()
}

function updateMarquee(scenePoint: Point) {
  if (!isMarquee.value || !marqueeObj) return
  marqueeEnd.value = { x: scenePoint.x, y: scenePoint.y }
  const x = Math.min(marqueeStart.value.x, marqueeEnd.value.x)
  const y = Math.min(marqueeStart.value.y, marqueeEnd.value.y)
  const w = Math.abs(marqueeEnd.value.x - marqueeStart.value.x)
  const h = Math.abs(marqueeEnd.value.y - marqueeStart.value.y)
  marqueeObj.set({ left: x, top: y, width: w, height: h })
  marqueeObj.setCoords()
  canvasRef.value?.requestRenderAll()
}

function endMarquee() {
  const canvas = canvasRef.value
  if (!isMarquee.value) return
  isMarquee.value = false

  if (marqueeObj) {
    canvas?.remove(marqueeObj)
    marqueeObj = null
  }
  canvas?.requestRenderAll()
}

// ═══════════════════════════════════════════════════════════════════════════
//  Anchor Editing
// ═══════════════════════════════════════════════════════════════════════════

function renderAnchors() {
  const canvas = canvasRef.value
  if (!canvas || !getActivePath() || !getActiveGroup()) return
  clearAnchors()

  const pts = anchorPoints.value
  if (!pts.length) return

  anchorCircleObjs = []
  handleLineObjs = []

  // Handle lines (control → anchor)
  const lineMap: { id: string; x1: number; y1: number; x2: number; y2: number }[] = []
  for (const pt of pts) {
    if (!pt.isControl || !pt.retained) continue
    const cmdAnchors = pts.filter(
      (p) => p.commandIndex === pt.commandIndex && !p.isControl && p.retained,
    )
    const anchor = cmdAnchors[cmdAnchors.length - 1]
    if (anchor) {
      lineMap.push({
        id: `h-${pt.index}`,
        x1: pt.x,
        y1: pt.y,
        x2: anchor.x,
        y2: anchor.y,
      })
    }
  }

  // Anchor circles (on-curve)
  for (const pt of pts.filter((x) => x.retained && !x.isControl)) {
    const c = new Circle({
      left: pt.x,
      top: pt.y,
      radius: 6,
      fill: '#3b82f6',
      stroke: '#fff',
      strokeWidth: 1.5,
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'grab',
      opacity: 0.9,
    })
    ;(c as any)._anchorData = pt
    anchorCircleObjs.push(c)
  }

  // Control circles (off-curve)
  for (const pt of pts.filter((x) => x.retained && x.isControl)) {
    const ln = lineMap.find((l) => l.id === `h-${pt.index}`)
    if (ln) {
      const line = new Line([ln.x1, ln.y1, ln.x2, ln.y2], {
        stroke: '#94a3b8',
        strokeWidth: 1,
        strokeDashArray: [4, 3],
        selectable: false,
        evented: false,
      })
      handleLineObjs.push(line)
      canvas.add(line)
    }
    const c = new Circle({
      left: pt.x,
      top: pt.y,
      radius: 4,
      fill: '#fff',
      stroke: '#94a3b8',
      strokeWidth: 1.5,
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'grab',
      opacity: 0.9,
    })
    ;(c as any)._anchorData = pt
    anchorCircleObjs.push(c)
  }

  const ag = new Group(anchorCircleObjs, {
    selectable: false,
    evented: true,
    subTargetCheck: true,
  })
  anchorGroup = ag
  canvas.add(ag)

  // Add drag handlers to each anchor circle
  for (const c of anchorCircleObjs) {
    c.on('moving', onAnchorMoving)
    c.on('modified', onAnchorModified)
  }

  canvas.requestRenderAll()
}

function clearAnchors() {
  const canvas = canvasRef.value
  if (!canvas) return
  if (anchorGroup) {
    for (const c of anchorCircleObjs) {
      c.off('moving', onAnchorMoving)
      c.off('modified', onAnchorModified)
    }
    canvas.remove(anchorGroup)
    anchorGroup = null
  }
  for (const l of handleLineObjs) {
    canvas.remove(l)
  }
  anchorCircleObjs = []
  handleLineObjs = []
}

function onAnchorMoving(e: any) {
  const circle = e.target
  const pt: AnchorPoint = (circle as any)._anchorData
  if (!pt || !getActivePath()) return

  const newLeft = circle.left
  const newTop = circle.top
  const newPathStr = updateAnchorPoint(
    parsedCommands.value,
    pt.commandIndex,
    pt.coordIndex,
    newLeft,
    newTop,
  )
  editingPathData.value = newPathStr
  getActivePath().set({ path: newPathStr })
  getActivePath().setCoords()

  // Update handle lines
  for (const hl of handleLineObjs) {
    const ctrlPt = anchorCircleObjs.find(
      (ac) => (ac as any)._anchorData?.isControl && (ac as any)._anchorData?.commandIndex === pt.commandIndex,
    )
    if (ctrlPt) {
      hl.set({ x1: ctrlPt.left, y1: ctrlPt.top, x2: newLeft, y2: newTop })
      hl.setCoords()
    }
  }

  canvasRef.value?.requestRenderAll()
}

function onAnchorModified(e: any) {
  store.currentPathData = editingPathData.value
  parsePathData(editingPathData.value)
  renderAnchors() // refresh anchor positions
  showSelectionBox()
}

// ═══════════════════════════════════════════════════════════════════════════
//  Fabric Event Handlers
// ═══════════════════════════════════════════════════════════════════════════

function onMouseDown(opt: TPointerEventInfo) {
  const canvas = canvasRef.value
  if (!canvas) return

  const native = opt.e as MouseEvent
  const btn = native.button ?? 0

  // Middle-click or Hand tool → start panning
  if (btn === 1 || ui.activeTool === 'hand') {
    isStageDragging.value = true
    lastPanPoint = canvas.getScenePoint(opt.e)
    canvas.selection = false
    canvas.defaultCursor = 'grabbing'
    return
  }

  if (ui.activeTool !== 'select' && ui.activeTool !== 'edit-path') return

  // Click on a shape → select it (check all tracked objects)
  if (opt.target) {
    let target: any = opt.target
    while (target) {
      for (let i = 0; i < textObjects.length; i++) {
        const { group, path } = textObjects[i]
        if (target === group || target === path) {
          const shiftHeld = native.shiftKey
          if (shiftHeld) {
            const next = new Set(selectedIndices.value)
            if (next.has(i)) next.delete(i); else next.add(i)
            selectedIndices.value = next
          } else {
            selectedIndices.value = new Set([i])
          }
          if (native.altKey && ui.activeTool === 'select') {
            duplicateAndDrag()
          } else if (selectedIndices.value.size > 1) {
            // Multi-select drag: disable Fabric's individual drag, handle manually
            startMultiDrag(canvas.getScenePoint(opt.e))
          } else if (selectedIndices.value.size > 0) {
            selectObject()
          }
          return
        }
      }
      target = target.group
    }
  }

  // Click on empty canvas → deselect (and start marquee in select mode)
  if (!opt.target && btn === 0) {
    deselectObject()
    if (ui.activeTool === 'select') {
      startMarquee(canvas.getScenePoint(opt.e))
    }
  }
}

function onMouseMove(opt: TPointerEventInfo) {
  const canvas = canvasRef.value
  if (!canvas) return
  const sp = canvas.getScenePoint(opt.e)

  // Panning (middle-click drag or Hand tool)
  if (isStageDragging.value && lastPanPoint) {
    const delta = sp.subtract(lastPanPoint)
    lastPanPoint = sp
    const vpt = canvas.viewportTransform!
    vpt[4] += delta.x * canvas.getZoom()
    vpt[5] += delta.y * canvas.getZoom()
    store.stageX = vpt[4]
    store.stageY = vpt[5]
    canvas.requestRenderAll()
    return
  }

  // Multi-select drag
  if (isMultiDragging.value) {
    updateMultiDrag(sp)
    return
  }

  if (isMarquee.value) {
    updateMarquee(sp)
  }
}

function onMouseUp(opt: TPointerEventInfo) {
  const canvas = canvasRef.value
  if (!canvas) return
  const native = opt.e as MouseEvent
  const btn = native.button ?? 0

  // End panning
  if (isStageDragging.value) {
    isStageDragging.value = false
    lastPanPoint = null
    canvas.defaultCursor = CURSOR[ui.activeTool] ?? 'default'
    renderGrid()
    canvas.requestRenderAll()
    return
  }

  // End multi-drag
  if (isMultiDragging.value) {
    endMultiDrag()
    return
  }

  if (isMarquee.value) {
    endMarquee()

    // Collect all intersecting objects
    const mx = Math.min(marqueeStart.value.x, marqueeEnd.value.x)
    const my = Math.min(marqueeStart.value.y, marqueeEnd.value.y)
    const mw = Math.abs(marqueeEnd.value.x - marqueeStart.value.x)
    const mh = Math.abs(marqueeEnd.value.y - marqueeStart.value.y)
    const found: number[] = []
    for (let i = 0; i < textObjects.length; i++) {
      const bounds = textObjects[i].group.getBoundingRect()
      if (
        bounds.left < mx + mw &&
        bounds.left + bounds.width > mx &&
        bounds.top < my + mh &&
        bounds.top + bounds.height > my
      ) {
        found.push(i)
      }
    }
    if (found.length > 0) {
      selectedIndices.value = new Set(found)
      selectObject()
    }
  }
}

function onMouseWheel(opt: TPointerEventInfo) {
  opt.e.preventDefault()
  const canvas = canvasRef.value
  if (!canvas) return

  const delta = (opt.e as WheelEvent).deltaY
  const oldZoom = canvas.getZoom()
  let newZoom = delta > 0 ? oldZoom * 0.9 : oldZoom * 1.1
  newZoom = Math.max(0.1, Math.min(5, newZoom))

  canvas.zoomToPoint(opt.scenePoint, newZoom)

  // Update store
  store.setZoom(newZoom * 100)
  const vpt = canvas.viewportTransform!
  store.stageX = vpt[4]
  store.stageY = vpt[5]

  renderGrid()
  canvas.requestRenderAll()
}

function onObjectMoving(e: any) {
  // Update selection rects live during drag
  if (selectedIndices.value.size > 0 && selRects.length > 0) {
    removeSelectionRects()
    showSelectionBox()
  }
}

function onObjectModified(e: any) {
  const moved = e.target
  if (moved && moved !== getActiveGroup() && getActiveGroup()) {
    // A duplicate was dragged — sync the moved group's position
    getActiveGroup().set({ left: moved.left, top: moved.top })
  }
  if (getActiveGroup()) {
    getActiveGroup().setCoords()
    console.log('[DRAG END] group left:', getActiveGroup().left, 'top:', getActiveGroup().top)
    store.groupX = getActiveGroup().left
    store.groupY = getActiveGroup().top
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Pan (Hand tool & middle-click)
// ═══════════════════════════════════════════════════════════════════════════

let lastPanPoint: Point | null = null

// ═══════════════════════════════════════════════════════════════════════════
//  Tool watcher
// ═══════════════════════════════════════════════════════════════════════════

watch(
  () => ui.activeTool,
  (tool) => {
    const canvas = canvasRef.value
    if (!canvas) return

    if (tool === 'edit-path' && objectSelected.value && getActivePath()) {
      renderAnchors()
    } else if (tool !== 'edit-path') {
      clearAnchors()
    }

    // Update cursor
    canvas.defaultCursor = CURSOR[tool] ?? 'default'
    canvas.hoverCursor = CURSOR[tool] ?? 'default'
    canvas.requestRenderAll()
  },
  { immediate: true },
)

// ═══════════════════════════════════════════════════════════════════════════
//  Lifecycle
// ═══════════════════════════════════════════════════════════════════════════

let resizeObserver: ResizeObserver | null = null

function attachEvents() {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.on('mouse:down', onMouseDown)
  canvas.on('mouse:move', onMouseMove)
  canvas.on('mouse:up', onMouseUp)
  canvas.on('mouse:wheel', onMouseWheel)

  // Object drag events
  canvas.on('object:moving', onObjectMoving)
  canvas.on('object:modified', onObjectModified)
}

function detachEvents() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.off('mouse:down', onMouseDown)
  canvas.off('mouse:move', onMouseMove)
  canvas.off('mouse:up', onMouseUp)
  canvas.off('mouse:wheel', onMouseWheel)
}

onMounted(async () => {
  await nextTick()
  initCanvas()

  const canvas = canvasRef.value
  if (canvas) {
    attachEvents()
    const container = containerRef.value
    if (container) {
      const r = container.getBoundingClientRect()
      stageWidth.value = r.width
      stageHeight.value = r.height
      canvas.setDimensions({ width: r.width, height: r.height })
    }

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        stageWidth.value = entry.contentRect.width
        stageHeight.value = entry.contentRect.height
        canvas.setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
        renderGrid()
        canvas.requestRenderAll()
      }
    })
    if (container) resizeObserver.observe(container)
  }
})

onUnmounted(() => {
  detachEvents()
  resizeObserver?.disconnect()
  if (shapeTimer) clearTimeout(shapeTimer)
  canvasRef.value?.dispose()
  canvasRef.value = null
})

// ═══════════════════════════════════════════════════════════════════════════
//  Expose for keyboard shortcuts
// ═══════════════════════════════════════════════════════════════════════════

/** Syncs the selected object's current position into the store, then nudges */
function nudgeSelected(dx: number, dy: number) {
  const g = getActiveGroup()
  if (!g) return
  // Sync current position to store before applying delta
  store.groupX = g.left
  store.groupY = g.top
  store.groupX += dx
  store.groupY += dy
}

defineExpose({
  getCanvasEl: () => canvasEl.value,
  getFabricCanvas: () => canvasRef.value,
  nudgeSelected,
})
</script>

<template>
  <div ref="containerRef" class="canvas-container relative h-full w-full overflow-hidden bg-background" :style="{ cursor: cursorStyle }">
    <!-- Shaping indicator -->
    <div
      v-if="shaping"
      class="pointer-events-none absolute start-2 top-2 z-10 rounded bg-background/80 px-2 py-1 text-[11px] text-muted-foreground"
    >
      Shaping…
    </div>
    <!-- Shaping error -->
    <div
      v-if="shapingError"
      class="pointer-events-none absolute start-2 top-8 z-10 rounded bg-destructive/90 px-2 py-1 text-[11px] text-destructive-foreground"
    >
      {{ shapingError }}
    </div>
    <!-- Fabric.js canvas -->
    <canvas ref="canvasEl" class="absolute inset-0" />
  </div>
</template>
