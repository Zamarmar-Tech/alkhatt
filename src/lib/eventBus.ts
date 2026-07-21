/**
 * @fileoverview Central typed event bus powered by `mitt`.
 *
 * All cross-component communication flows through this bus. Events are
 * categorised by domain prefix:
 *   - `ui:*`       — toolbar, panel, theme, language
 *   - `text:*`     — content, font, size, stroke, fill
 *   - `canvas:*`   — shaping requests/results, group moves
 *   - `selection:*`— object selection state
 *   - `history:*`  — undo/redo stack
 *
 * Components should **emit** events for actions and **listen** for results.
 * Pinia stores remain the single source of truth for state; events are the
 * trigger layer that sits between the UI and the stores.
 */
import mitt from 'mitt'
import type { ToolType } from '@/stores/uiStore'

/** The full event catalog. */
export type Events = {
  // ── UI ──────────────────────────────────────────────────────────────────
  'ui:tool-changed': { tool: ToolType }
  'ui:locale-changed': { locale: string }
  'ui:theme-changed': { mode: string }
  'ui:panels-changed': { layers?: boolean; properties?: boolean }

  // ── Text / font ────────────────────────────────────────────────────────
  'text:changed': { text: string }
  'font:changed': { font: string }
  'font-size:changed': { size: number }
  'stroke:changed': { strokeColor?: string; strokeWidth?: number }
  'fill:changed': { fillColor: string }

  // ── Canvas (shaping engine bridge) ──────────────────────────────────────
  /** Sent by the UI when text/font changes → forwarded to the Web Worker. */
  'canvas:shape-request': { text: string; font: string; fontSize: number; fontUrl: string }
  /** Received from the Web Worker with the result. */
  'canvas:shaped': { pathData: string; success: boolean; error?: string }
  /** Fired when the user drags anchor points (path editing). */
  'canvas:path-edited': { pathData: string }
  /** Fired when the user drags the whole text group. */
  'canvas:group-moved': { x: number; y: number }

  // ── Selection ───────────────────────────────────────────────────────────
  'selection:changed': { selected: boolean }

  // ── History (Undo / Redo) ───────────────────────────────────────────────
  'history:undo': void
  'history:redo': void
  /** Snapshot of the current state for the undo stack. */
  'history:push': Record<string, unknown>
}

/** Singleton event emitter. */
export const emitter = mitt<Events>()
