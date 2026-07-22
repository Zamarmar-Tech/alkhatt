# Alkhatt - Arabic Calligraphy Canvas

An Arabic calligraphy editor that runs in the browser. Type Arabic text, pick a font, and the app shapes it with HarfBuzz before rendering it as vector paths you can edit anchor by anchor.

## Features

- **Arabic shaping** - HarfBuzz WASM handles glyph joining and positioning before OpenType.js converts the result to SVG paths
- **Vector editing** - Switch to Edit Path tool (A) to see anchor points and drag them to deform letters
- **Duplicate** - Hold Alt while dragging to leave a copy behind
- **Multi-select** - Shift+click or use the marquee to pick multiple objects, then drag them all at once
- **Zoom and pan** - Scroll to zoom, middle-click or Hand tool to pan
- **RTL support** - The whole UI flips for Arabic, including the canvas direction
- **Dark mode** - Follows system preference or toggle manually
- **Five fonts** - Amiri, Aref Ruqaa, Katibeh, Noto Naskh Arabic, Reem Kufi

## Tech stack

| Layer | |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| State | Pinia |
| Canvas | Fabric.js v7 |
| Text shaping | HarfBuzz WASM + OpenType.js in a Web Worker |
| Event bus | mitt |
| CSS | Tailwind CSS v4 |
| UI | Shadcn-Vue (New York style) |
| Icons | Lucide Vue |
| i18n | vue-i18n (English / Arabic) |

## Getting started

```bash
npm install
npm run dev       # starts on port 5173
npm run build     # type-check + production build to dist/
npm run preview   # preview the build
```

## Project structure

```
src/
├── assets/fonts/
├── components/
│   ├── editor/       # FabricCanvas, ToolBar, PropertiesPanel, LayersPanel
│   └── ui/           # Shadcn-Vue components
├── core/             # Worker, bridge, path-editor, font registry
├── lib/              # eventBus, i18n, shortcuts, theme
├── locales/          # en.json, ar.json
├── stores/           # canvasStore, uiStore
├── App.vue
└── main.ts
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| V / A / P / T / H / Z / I | Select / Edit Path / Pen / Text / Hand / Zoom / Eyedropper |
| Delete | Remove selected |
| Arrow keys | Nudge 1px |
| Shift+Arrow | Nudge 10px |
| + / - | Zoom in / out |
| Alt+drag | Duplicate |

## License

MIT
