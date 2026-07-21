# Developer Instructions: Arabic Calligraphy Canvas App - Alkhatt

This document serves as the architectural blueprint and standard operating procedure for building the Arabic calligraphy app.

## 1. Tech Stack Definition

**Core Framework & State**

* **Framework:** Vue 3 (Composition API, `<script setup>`, Vite build tool)
* **State Management:** Pinia (modular, typed stores)
* **Event Bus:** `mitt` (typed event emitter for cross-component communication)
* **Background Processing:** Native Web Workers (HarfBuzz + OpenType.js offloaded from main thread)
* **Deployment Target:** Cloudflare Pages (via standard Vite build output)

**Graphics & Typography Math**

* **Canvas Renderer:** Fabric.js v7 (Native ES Modules, TypeScript, Promise-based API)
* **Text Shaping:** `harfbuzzjs` (WebAssembly-based engine for complex Arabic text, mandatory for correct cursive joining and collision avoidance)
* **Path Extraction:** `opentype.js` (used strictly to extract SVG vector paths for the glyph coordinates determined by HarfBuzz)

**UI & Styling**

* **CSS Framework:** Tailwind CSS v4
* **UI Components:** Shadcn-Vue (using the 'New York' style for a compact, design-tool aesthetic)
* **Icons:** Lucide Vue (`@lucide/vue`)

---

## 2. Architecture & Event-Driven Data Flow

Do NOT attempt to tie Vue's standard text inputs directly to the canvas without the shaping layer. The app uses an **event-driven architecture** with `mitt` on the main thread and a **Web Worker** for background computation.

### Division of Labour

| Layer | Technology | Responsibility |
|---|---|---|
| **Main Thread** | Vue 3, Pinia, Fabric.js, `mitt` | UI rendering, state, canvas display, user interaction |
| **Background Thread** | Web Worker (`engine.worker.ts`) | HarfBuzz WASM shaping, OpenType.js path extraction |
| **Bridge** | `worker-bridge.ts` | Translates `mitt` events → Worker `postMessage` and back |

### Data Flow

```
User types Arabic text (UI component)
       │
       ▼
  Pinia Store (canvasStore.activeText)
       │ watcher
       ▼
  mitt event ──→ 'canvas:shape-request' ──→ Bridge
                                                 │
                                                 ▼
                                          Worker (postMessage)
                                                 │
                                    ┌────────────┴────────────┐
                                    │  HarfBuzz (WASM)         │
                                    │    → glyph IDs + offsets │
                                    │  OpenType.js             │
                                    │    → SVG path data       │
                                    └────────────┬────────────┘
                                                 │
                                          Worker (onmessage)
                                                 │
       ┌──────────────────────────────────────────┘
       ▼
  Bridge emits mitt event ──→ 'canvas:shaped'
       │
       ▼
  FabricCanvas listener updates store.currentPathData
       │
       ▼
  Fabric.js Path object rendered on <canvas>
```

### Rule of thumb

- **State lives in Pinia** (single source of truth)
- **Actions are triggered via mitt events** (decoupled, traceable)
- **Heavy computation runs in the Web Worker** (keeps UI responsive)
- **The Worker never touches Vue, Pinia, or the DOM**

---

## 3. Fabric.js v7 Integration Rules

Fabric.js v7 uses modern ES Modules (`import { Canvas, Path } from 'fabric'`). Do NOT attempt to bind Vue's reactive state directly to the Fabric canvas instance or Fabric objects. **CRITICAL RULES:**

* **No Deep Reactivity:** NEVER store the initialized `Canvas` instance in a standard `ref()`. Vue's Proxy system will intercept Fabric's internal properties, breaking hit-testing and control rendering.
* **Use shallowRef:** Always store the canvas instance using `const canvasRef = shallowRef<Canvas | null>(null)`.
* **No Callbacks in Options:** Fabric v7 methods are heavily Promise-based. Do not use legacy callbacks.
* **No Method Chaining:** Fabric v7 has deprecated method chaining. Set properties explicitly via `object.set({ ... })`.
* **Imperative Updates:** Fabric objects are NOT reactive Vue proxies. After changing a store value that should affect a fabric object, call `object.set({ ... })`, `object.setCoords()`, and `canvas.requestRenderAll()` explicitly.
* **Canvas Events:** Use Fabric's event system (`canvas.on('mouse:down', ...)`, `object.on('mousedown', ...)`), NOT Vue's `@click` on canvas DOM elements.
* **Zoom/Pan:** Use `canvas.setZoom(scale)` and `canvas.absolutePan({ x, y })`. The viewport transform is `[a,b,c,d,e,f]` where a=scaleX, d=scaleY, e=translateX, f=translateY. Use `canvas.getZoom()` and `canvas.viewportTransform` to inspect.

---

## 4. Project Structure

```text
src/
├── assets/
│   └── fonts/                     # Arabic font families
│       ├── Amiri/
│       ├── Aref_Ruqaa/
│       ├── Katibeh/
│       ├── Noto_Naskh_Arabic/
│       └── Reem_Kufi/
│
├── components/
│   ├── ui/                        # Shadcn-Vue design-system components
│   │   ├── button/
│   │   ├── dropdown-menu/
│   │   ├── label/
│   │   ├── resizable/
│   │   ├── scroll-area/
│   │   ├── select/
│   │   ├── separator/
│   │   └── slider/
│   │
│   └── editor/                    # App-specific components
│       ├── FabricCanvas.vue       # Fabric.js canvas wrapper, grid, layers, anchor editing
│       ├── LayersPanel.vue        # Layer list with visibility/lock/delete
│       ├── PropertiesPanel.vue    # Text input, font, size, colour controls
│       ├── StatusBar.vue          # Zoom controls, layer count
│       ├── TitleBar.vue           # Brand, theme/lang/panel toggles
│       └── ToolBar.vue            # Vertical tool sidebar (select/edit-path/pen/text/hand/zoom/eyedropper)
│
├── core/                          # Typography engine
│   ├── engine.ts                  # (Direct API fallback) HarfBuzz + OpenType.js
│   ├── engine.worker.ts           # Web Worker — runs shaping in background thread
│   ├── worker-bridge.ts           # mitt ↔ Worker communication bridge
│   ├── path-editor.ts             # SVG path parsing, anchor-point manipulation
│   ├── path-extractor.ts          # Font buffer loading utility
│   └── font-registry.ts           # Font name → asset URL mapping
│
├── lib/                           # Shared utilities
│   ├── eventBus.ts                # mitt typed event emitter
│   ├── i18n.ts                    # Vue I18n setup
│   ├── useShortcuts.ts            # Keyboard shortcuts (VueUse `useMagicKeys`)
│   ├── useTheme.ts                # Light/dark/system theme composable
│   └── utils.ts                   # cn() helper for Shadcn
│
├── locales/                       # Translation files
│   ├── ar.json                    # Arabic
│   └── en.json                    # English
│
├── stores/                        # Pinia state management
│   ├── canvasStore.ts             # Canvas layers, text, font, zoom, position
│   └── uiStore.ts                 # Panels, active tool
│
├── App.vue                        # Root layout, bridge initialisation
├── main.ts                        # App initialisation
└── style.css                      # Tailwind v4 + Shadcn CSS variables

public/
├── hb.wasm                        # HarfBuzz WASM binary (served statically)
└── vite.svg                       # Favicon
```

---

## 5. Event Bus API

All cross-component communication flows through `src/lib/eventBus.ts` using `mitt`.

```typescript
import { emitter } from '@/lib/eventBus'

// Emit an event
emitter.emit('canvas:shape-request', { text: 'مرحبا', fontUrl: '/fonts/...', fontSize: 72 })

// Listen for events
emitter.on('canvas:shaped', ({ pathData, success }) => {
  if (success) store.currentPathData = pathData
})
```

### Event Catalogue

| Event | Payload | Direction |
|---|---|---|
| `canvas:shape-request` | `{ text, fontUrl, fontSize }` | CanvasStage → Bridge → Worker |
| `canvas:shaped` | `{ pathData, success, error? }` | Worker → Bridge → CanvasStage |

---

## 6. Web Worker Architecture

The shaping pipeline runs in `src/core/engine.worker.ts` - a dedicated background thread.

### Message Protocol

**Main Thread → Worker:**
```
{ type: 'INIT_WASM',  payload: { wasmUrl: '/hb.wasm' }, id: number }
{ type: 'SHAPE_TEXT', payload: { text, fontBuffer: ArrayBuffer, fontSize }, id: number }
```

**Worker → Main Thread:**
```
{ type: 'WASM_LOADED', payload: { success: true }, id }
{ type: 'TEXT_SHAPED', payload: { pathData, glyphCount, unitsPerEm }, id }
{ type: 'ERROR',       payload: { error: string }, id }
```

### Bridge (`worker-bridge.ts`)

The bridge:
1. Spawns the Worker via `new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })`
2. Listens for `canvas:shape-request` mitt events
3. Loads the font buffer on the main thread (where asset URLs resolve)
4. Sends `SHAPE_TEXT` to the Worker
5. Receives the result and emits `canvas:shaped` back to the event bus

### Vite Configuration

Workers using dynamic `import()` (`import('harfbuzzjs/hbjs.js')`, `import('opentype.js')`) require ES module format:

```ts
// vite.config.ts
worker: { format: 'es' }
```

---

## 7. Design & UI Specifications

The application should resemble professional design software (like Figma or Illustrator).

* **Layout:** Three-pane layout.
  * Left: Tools sidebar (fixed width, not resizable).
  * Center: The Fabric.js Canvas (with a dotted grid background).
  * Right: Layers panel (top) + Properties panel (bottom) in a vertical split.
  * Bottom: Status bar (layer count, zoom level, zoom controls).
* **Theme:** Shadcn's neutral gray palette with light (`hsl(0 0% 94%)`) and dark (`hsl(0 0% 8%)`) modes, plus system follow.
* **Directionality:** `<html dir>` is set dynamically based on locale. Tailwind logical properties (`ms-*`, `me-*`, `border-s`, `border-e`) handle RTL automatically.
* **Keyboard shortcuts:** VueUse `useMagicKeys` — single-letter tool switches, arrow nudging, Delete, zoom.

### Tools

| Tool | Shortcut | Behaviour |
|---|---|---|
| Select | V | Click to select, drag to move, marquee to multi-select |
| Edit Path | A | Click path to show anchor points, drag anchors to deform |
| Pen | P | Draw bezier paths |
| Text | T | Add/edit text objects |
| Hand | H | Drag to pan the canvas |
| Zoom | Z | Click to zoom in, Alt+click to zoom out |
| Eyedropper | I | Pick colours from the canvas |

---

## 8. Keyboard Shortcuts

Defined in `src/lib/useShortcuts.ts`. Uses `useMagicKeys` from VueUse with an `onEventFired` callback.

- **Tool keys:** V, A, P, T, H, Z, I
- **Zoom:** + / −
- **Delete:** Delete / Backspace
- **Nudge:** Arrow keys (Shift for 10×)
- All shortcuts are suppressed when focus is on an `<input>` or `<textarea>`.

---

## 9. Anchor Point Editing

Located in `src/core/path-editor.ts`. The SVG path string is parsed into structured commands (`M`, `L`, `Q`, `C`, `Z`) with coordinate pairs. On-curve points are rendered as draggable blue circles; off-curve control handles are shown as white circles with dashed connecting lines.

Simplification (`simplifyAnchors`) removes nearly-collinear points for a cleaner editing experience without overwhelming the user with hundreds of points.

---

## 10. Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build locally |
