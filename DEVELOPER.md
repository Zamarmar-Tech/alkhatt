# Alkhatt — Developer Guide

> Arabic Calligraphy Canvas — a professional-grade design tool for Arabic
> typography, powered by HarfBuzz (WASM) for precise text shaping and Konva
> for canvas rendering.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Architecture & Data Flow](#2-architecture--data-flow)
3. [Project Structure](#3-project-structure)
4. [Component Tree](#4-component-tree)
5. [Event Bus API](#5-event-bus-api)
6. [Web Worker Bridge](#6-web-worker-bridge)
7. [State Management](#7-state-management)
8. [The Typography Pipeline](#8-the-typography-pipeline)
9. [Internationalisation & RTL](#9-internationalisation--rtl)
10. [Theme System](#10-theme-system)
11. [Keyboard Shortcuts](#11-keyboard-shortcuts)
12. [Anchor Point Editing](#12-anchor-point-editing)
13. [Available Scripts](#13-available-scripts)
14. [Adding a Feature](#14-adding-a-feature)

---

## 1. Tech Stack

| Category | Library | Purpose |
|---|---|---|
| **Framework** | Vue 3 (Composition API, `<script setup>`) | UI framework |
| **Build** | Vite 6 | Dev server + production bundler |
| **Language** | TypeScript ~5.6 | Type safety |
| **State** | Pinia 2 | Modular stores |
| **Event Bus** | `mitt` 3 | Typed cross-component events |
| **Background Proc.** | Web Worker | HarfBuzz + OpenType.js offloaded from main thread |
| **Canvas** | Konva.js + vue-konva 3 | Declarative canvas rendering |
| **Text Shaping** | HarfBuzz (WASM via `harfbuzzjs`) | Arabic glyph positioning |
| **Path Extraction** | OpenType.js 1.3 | SVG path extraction from fonts |
| **UI Components** | Shadcn-Vue (New York style) + Radix Vue | Design-system primitives |
| **CSS** | Tailwind CSS 4 | Utility-first styling |
| **Icons** | Lucide (`@lucide/vue`) | Icon set |
| **i18n** | vue-i18n 9 | Internationalisation |
| **Keyboard** | VueUse (`useMagicKeys`) | Key bindings |
| **Deployment** | Cloudflare Pages | Static hosting |

---

## 2. Architecture & Data Flow

### Golden Rule

**Do NOT bypass the shaping layer.** Vue's standard text inputs must never
feed directly into the canvas. Arabic text requires a shaping engine to handle
cursive joining, ligature selection, and glyph positioning.

### Event-Driven Architecture

The app uses three layers that communicate through typed channels:

```
┌─────────────────────────────────────────────────────────┐
│                   MAIN THREAD (UI)                       │
│                                                          │
│  ┌──────────┐   mitt events    ┌───────────────────┐     │
│  │ Vue 3    │ ←────────────── →│   eventBus.ts     │     │
│  │ Components│                  │   (typed mitt)    │     │
│  │ Pinia    │                  └────────┬──────────┘     │
│  │ Konva    │                           │                │
│  └──────────┘                           │                │
│                                         ▼                │
│                              ┌──────────────────┐        │
│                              │  worker-bridge.ts │        │
│                              │  (translator)     │        │
│                              └────────┬─────────┘        │
│                                       │ postMessage       │
├───────────────────────────────────────┼──────────────────┤
│                    BACKGROUND THREAD  │                  │
│                                       ▼                  │
│                              ┌──────────────────┐        │
│                              │ engine.worker.ts  │        │
│                              │                   │        │
│                              │  HarfBuzz (WASM)  │        │
│                              │  OpenType.js      │        │
│                              └──────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Flow for text shaping

```
User types in PropertiesPanel
       │
       ▼
canvasStore.activeText = 'السلام'
       │ watcher (CanvasStage)
       ▼
emitter.emit('canvas:shape-request', { text, fontUrl, fontSize })
       │
       ▼
worker-bridge catches the event
       │ loads font buffer via fetch()
       │
       ▼
worker.postMessage({ type: 'SHAPE_TEXT', payload: { text, fontBuffer, fontSize }, id: N })
       │
       ▼
Worker processes:
  1. HarfBuzz shapes → glyph IDs + offsets
  2. OpenType.js extracts → SVG path strings
       │
       ▼
worker.onmessage → { type: 'TEXT_SHAPED', payload: { pathData, ... }, id: N }
       │
       ▼
worker-bridge emits 'canvas:shaped' event on mitt
       │
       ▼
CanvasStage listener → store.currentPathData = pathData
       │
       ▼
Konva <v-path> reactively re-renders
```

---

## 3. Project Structure

```
src/
├── assets/fonts/          # Arabic font families
├── components/
│   ├── ui/                # Shadcn-Vue components
│   └── editor/
│       ├── CanvasStage.vue     # Konva stage, grid, layers, anchor editing
│       ├── LayersPanel.vue     # Layer list UI
│       ├── PropertiesPanel.vue # Text input, font/size/stroke/color controls
│       ├── StatusBar.vue       # Zoom, layer count
│       ├── TitleBar.vue        # Brand, theme/lang/panel toggles
│       └── ToolBar.vue         # Vertical tool buttons
├── core/
│   ├── engine.ts               # (Fallback) shaping API
│   ├── engine.worker.ts        # Web Worker — shaping in background
│   ├── worker-bridge.ts        # mitt ↔ Worker bridge
│   ├── path-editor.ts          # SVG path parsing + anchor editing
│   ├── path-extractor.ts       # Font loading utility
│   └── font-registry.ts        # Font name → asset URL map
├── lib/
│   ├── eventBus.ts             # Typed mitt event emitter
│   ├── i18n.ts                 # Vue I18n setup
│   ├── useShortcuts.ts         # Keyboard shortcuts
│   ├── useTheme.ts             # Theme composable
│   └── utils.ts                # cn() helper
├── locales/
│   ├── ar.json                 # Arabic translations
│   └── en.json                 # English translations
├── stores/
│   ├── canvasStore.ts          # Canvas state
│   └── uiStore.ts              # UI state
├── App.vue                     # Root layout, bridge init
├── main.ts                     # App init
└── style.css                   # Tailwind v4 + theme variables

public/
├── hb.wasm                     # HarfBuzz WASM
└── vite.svg
```

---

## 4. Component Tree

```
App.vue
├── TitleBar.vue
│   ├── Button (theme → DropdownMenu)
│   ├── Button (language → DropdownMenu)
│   ├── Button (layers toggle)
│   └── Button (properties toggle)
│
├── ToolBar.vue (fixed, outside resizable split)
│
├── ResizablePanelGroup (horizontal)
│   ├── ResizablePanel: Canvas → CanvasStage.vue
│   │   └── (Konva <v-stage> with grid + objects layers)
│   ├── ResizableHandle
│   └── ResizablePanel (conditional)
│       └── ResizablePanelGroup (vertical)
│           ├── ResizablePanel: LayersPanel.vue
│           ├── ResizableHandle
│           └── ResizablePanel: PropertiesPanel.vue
│
└── StatusBar.vue
```

---

## 5. Event Bus API

All events are typed in `src/lib/eventBus.ts`.

```typescript
import { emitter } from '@/lib/eventBus'

// Emit
emitter.emit('canvas:shape-request', { text, fontUrl, fontSize: 72 })

// Listen
emitter.on('canvas:shaped', ({ pathData, success }) => {
  if (success) store.currentPathData = pathData
})

// Clean up
emitter.off('canvas:shaped', handler)
```

### Event Catalogue

| Event | Payload | Trigger | Consumer |
|---|---|---|---|
| `ui:tool-changed` | `{ tool }` | ToolBar | CanvasStage |
| `ui:locale-changed` | `{ locale }` | TitleBar | App.vue (`dir`/`lang`) |
| `ui:theme-changed` | `{ mode }` | TitleBar | useTheme |
| `text:changed` | `{ text }` | PropertiesPanel | CanvasStage |
| `font:changed` | `{ font }` | PropertiesPanel | CanvasStage |
| `font-size:changed` | `{ size }` | PropertiesPanel | CanvasStage |
| `stroke:changed` | `{ strokeColor?, strokeWidth? }` | PropertiesPanel | CanvasStage |
| `fill:changed` | `{ fillColor }` | PropertiesPanel | CanvasStage |
| `canvas:shape-request` | `{ text, fontUrl, fontSize }` | CanvasStage | worker-bridge |
| `canvas:shaped` | `{ pathData, success, error? }` | worker-bridge | CanvasStage |
| `canvas:path-edited` | `{ pathData }` | CanvasStage | CanvasStage |
| `canvas:group-moved` | `{ x, y }` | CanvasStage | store |
| `selection:changed` | `{ selected }` | CanvasStage | any |
| `history:push` | snapshot | any | history |
| `history:undo` | — | shortcut | store |
| `history:redo` | — | shortcut | store |

---

## 6. Web Worker Bridge

Defined in `src/core/worker-bridge.ts`.

### Initialisation

```typescript
// App.vue
initWorkerBridge()   // spawns the Worker, wires mitt → postMessage
initWorkerWasm()     // loads HarfBuzz WASM inside the Worker
```

### Message Protocol

```
Main → Worker:
  { type: 'INIT_WASM',  payload: { wasmUrl: '/hb.wasm' }, id }
  { type: 'SHAPE_TEXT', payload: { text, fontBuffer: ArrayBuffer, fontSize }, id }

Worker → Main:
  { type: 'WASM_LOADED',  payload: { success } }
  { type: 'TEXT_SHAPED',  payload: { pathData, glyphCount, unitsPerEm } }
  { type: 'ERROR',        payload: { error } }
```

### Why a bridge?

- The Worker cannot access `mitt` (different memory space)
- The Worker cannot resolve Vite asset URLs — fonts are fetched on the main thread
- The bridge translates mitt payloads to plain objects for `postMessage`
- `ArrayBuffer` (font files) is transferable and zero-copy

### Vite config

```ts
// vite.config.ts
worker: { format: 'es' }
```

Required because the Worker uses dynamic `import()` statements for HarfBuzz and
OpenType.js, which require code-splitting (not supported in IIFE worker format).

---

## 7. State Management

### canvasStore (`useCanvasStore`)

The single source of truth for all canvas content and viewport state.

| State | Type | Description |
|---|---|---|
| `layers` | `CanvasLayer[]` | All canvas layers |
| `activeLayerId` | `string \| null` | Selected layer |
| `activeText` | `string` | Raw Arabic text input |
| `selectedFont` | `string` | Font family name |
| `fontSize` | `number` | Font size in px |
| `currentPathData` | `string` | SVG `d` string for rendering |
| `groupX`, `groupY` | `number` | Text group position |
| `zoom` | `number` | Zoom percentage (10–500) |
| `stageX`, `stageY` | `number` | Pan offset |
| `strokeColor`, `fillColor`, `strokeWidth` | — | Visual properties |

| Action | Description |
|---|---|
| `addLayer`, `removeLayer`, `updateLayer` | Layer CRUD |
| `setZoom(n)`, `zoomIn()`, `zoomOut()`, `zoomToFit()` | Zoom control |

### uiStore (`useUiStore`)

Pure presentational state.

| State | Type | Description |
|---|---|---|
| `activeTool` | `'select' \| 'edit-path' \| 'pen' \| 'text' \| 'hand' \| 'zoom' \| 'eyedropper'` | Current tool |
| `layersPanelOpen` | `boolean` | Left panel visibility |
| `propertiesPanelOpen` | `boolean` | Right panel visibility |

---

## 8. The Typography Pipeline

```
Font (.ttf ArrayBuffer)
    │
    ▼
HarfBuzz (WASM)
    │ shapeText(text)
    │
    ▼
Glyph IDs + dx, dy, advanceX/Y (in font units)
    │
    ▼
OpenType.js
    │ glyph.getPath(x, y, fontSize)
    │
    ▼
Positioned SVG path data (in pixels)
    │
    ▼
Konva <v-path>
```

### Coordinate Systems

| System | Unit | Used by |
|---|---|---|
| Font design units | 1/upem (e.g. 1/1000) | HarfBuzz positions |
| Pixels | `fontUnit × fontSize / upem` | OpenType.js path data, Konva rendering |

The worker handles the conversion using `scale = fontSize / unitsPerEm`.

---

## 9. Internationalisation & RTL

- Two locales: **English** (`en`) and **Arabic** (`ar`)
- Locale detected from `localStorage` → browser language → fallback `'ar'`
- `<html dir>` and `<html lang>` are set dynamically when locale changes
- Tailwind's **logical properties** (`ms-*`, `me-*`, `border-s`, `border-e`) adapt automatically
- Language switch via globe icon → dropdown in TitleBar

---

## 10. Theme System

Three modes managed by `src/lib/useTheme.ts`:

| Mode | Behaviour |
|---|---|
| `dark` | Adds `class="dark"` to `<html>` |
| `light` | Removes `class="dark"` |
| `system` | Follows `prefers-color-scheme` media query in real time |

Preference saved in `localStorage` under `alkhatt-theme`.

CSS variables are defined in `src/style.css`:
- `:root` — light palette (gray `#f0f0f0` background)
- `.dark` — dark palette (gray `#141414` background)
- `@theme` block maps them to Tailwind utilities (`bg-background`, `text-foreground`)

---

## 11. Keyboard Shortcuts

Defined in `src/lib/useShortcuts.ts`. Powered by VueUse `useMagicKeys`.

| Key | Action |
|---|---|
| `V` | Select tool |
| `A` | Edit Path tool |
| `P` | Pen tool |
| `T` | Text tool |
| `H` | Hand (pan) tool |
| `Z` | Zoom tool |
| `I` | Eyedropper tool |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `Delete` / `Backspace` | Delete selected |
| `↑ ↓ ← →` | Nudge by 1 px |
| `Shift + ↑ ↓ ← →` | Nudge by 10 px |

All shortcuts suppressed when focus is on `<input>` / `<textarea>`.

---

## 12. Anchor Point Editing

Located in `src/core/path-editor.ts`.

- **`parsePath(data)`** — SVG `d` string → `PathCommand[]`
- **`getAnchorPoints(commands)`** — Flatten to `AnchorPoint[]` with on/off-curve flags
- **`simplifyAnchors(points, angle)`** — Remove collinear points (default 12° threshold)
- **`updateAnchorPoint(commands, ci, pi, x, y)`** — Mutate + rebuild path string

Anchors appear when clicking the path with the **Edit Path** tool (A). On-curve
points are blue circles (radius 6), control handles are white circles with
dashed connector lines. Dragging updates the Konva path imperatively during
drag and commits to the store on `dragend`.

---

## 13. Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | `vue-tsc` type-check + `vite build` |
| `npm run preview` | Preview production build |

---

## 14. Adding a Feature

### Example: New tool

1. Add tool ID to `ToolType` in `uiStore.ts`
2. Add button to `tools` array in `ToolBar.vue`
3. Add icon import from `@lucide/vue`
4. Add label to both locale files
5. Add shortcut key in `useShortcuts.ts`
6. Handle the tool in `CanvasStage.vue` (cursor, click behaviour, drag)

### Example: New panel

1. Create component in `src/components/editor/`
2. Add visibility toggle to `uiStore.ts`
3. Add component to `App.vue` inside the right vertical `ResizablePanelGroup`
4. Add toggle button in `TitleBar.vue`
5. Add labels to locale files

### Example: New event

1. Add the event type to `Events` in `src/lib/eventBus.ts`
2. Emit it where the action happens: `emitter.emit('domain:action', payload)`
3. Listen for it where the effect should occur: `emitter.on('domain:action', handler)`
4. If the handler needs cleanup, store the reference and call `emitter.off()` in `onUnmounted`

---

## Key Files at a Glance

| File | What it does |
|---|---|
| `src/lib/eventBus.ts` | Typed mitt event emitter |
| `src/core/engine.worker.ts` | Web Worker — HarfBuzz + OpenType.js |
| `src/core/worker-bridge.ts` | Translates mitt events ↔ Worker messages |
| `src/core/engine.ts` | Direct API fallback for shaping |
| `src/core/path-editor.ts` | SVG path parsing and anchor manipulation |
| `src/stores/canvasStore.ts` | Canvas state, text, zoom |
| `src/stores/uiStore.ts` | UI state, tool, panels |
| `src/lib/useShortcuts.ts` | Keyboard shortcuts |
| `src/lib/useTheme.ts` | Dark/light/system theme |
| `src/style.css` | Tailwind v4 theme, CSS variables |
| `src/App.vue` | Root layout, event bus + worker init |
| `public/hb.wasm` | HarfBuzz WASM binary |

---

*Last updated: July 2026*
