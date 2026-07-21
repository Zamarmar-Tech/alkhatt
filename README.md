# Alkhatt — Arabic Calligraphy Canvas

A professional-grade Arabic calligraphy canvas app (like Figma for Arabic typography). Renders shaped Arabic text via HarfBuzz + OpenType.js on a Fabric.js canvas, with vector anchor-point editing.

## Features

- **Arabic Text Shaping** — HarfBuzz WASM + OpenType.js pipeline correctly joins Arabic glyphs and renders them as SVG vector paths
- **Canvas Interaction** — Fabric.js v7 with zoom (scroll wheel), pan (middle-click / Hand tool), marquee selection
- **Multi-Select** — Shift+click to toggle, marquee to batch-select, move all selected together
- **Duplicate** — Alt+drag to leave a copy behind
- **Edit Path** — Drag anchor points to deform letter shapes (Edit Path tool, shortcut A)
- **Keyboard Shortcuts** — V/A/P/T/H/Z/I for tools, Arrow keys to nudge, Delete to remove
- **RTL/LTR** — Full Arabic and English UI with dynamic `dir` switching
- **Dark/Light Themes** — Shadcn neutral palette with system-follow
- **Multiple Fonts** — Amiri, Aref Ruqaa, Katibeh, Noto Naskh Arabic, Reem Kufi

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| State | Pinia |
| Canvas | Fabric.js v7 |
| Text Shaping | HarfBuzz WASM + OpenType.js (Web Worker) |
| Event Bus | mitt |
| CSS | Tailwind CSS v4 |
| UI Components | Shadcn-Vue (New York style) |
| Icons | Lucide Vue |
| i18n | vue-i18n (English / Arabic) |

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── assets/fonts/         # Arabic font families
├── components/
│   ├── editor/           # FabricCanvas, ToolBar, PropertiesPanel, LayersPanel, etc.
│   └── ui/               # Shadcn-Vue design system components
├── core/                 # Typography engine (Worker, bridge, path-editor)
├── lib/                  # Shared utilities (eventBus, i18n, shortcuts, theme)
├── locales/              # English and Arabic translation files
├── stores/               # Pinia stores (canvasStore, uiStore)
├── App.vue               # Root layout
└── main.ts               # App initialisation
```

## Keyboard Shortcuts

| Key | Tool |
|---|---|
| V | Select |
| A | Edit Path |
| P | Pen |
| T | Text |
| H | Hand (pan) |
| Z | Zoom |
| I | Eyedropper |
| Delete | Remove selected |
| Arrow keys | Nudge 1px |
| Shift+Arrow | Nudge 10px |
| +/- | Zoom in/out |
| Alt+drag | Duplicate |

## License

MIT
