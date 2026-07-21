/**
 * @fileoverview Keyboard shortcuts composable using VueUse `useMagicKeys`.
 *
 * Provides reactive key tracking for all toolbar tools and common actions.
 * Shortcuts are suppressed when focus is on an input / textarea element.
 *
 * @see https://vueuse.org/core/useMagicKeys/
 */
import { useMagicKeys } from '@vueuse/core'
import type { ToolType } from '@/stores/uiStore'

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName ?? ''
  return tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.getAttribute('contenteditable') === 'true'
}

const toolKeys: Record<string, ToolType> = {
  v: 'select',
  a: 'edit-path',
  p: 'pen',
  t: 'text',
  h: 'hand',
  z: 'zoom',
  i: 'eyedropper',
}

/**
 * Activate keyboard shortcuts for the application.
 * Call once in a root-level component (e.g. App.vue).
 */
export function useShortcuts(
  setTool: (tool: ToolType) => void,
  zoomIn: () => void,
  zoomOut: () => void,
  /** Called when Delete / Backspace is pressed. */
  onDelete?: () => void,
  /** Called with (dx, dy) to nudge the selection. */
  onNudge?: (dx: number, dy: number) => void,
) {
  useMagicKeys({
    passive: false,
    onEventFired(e) {
      if (e.type !== 'keydown') return
      if (isInputFocused()) return

      const key = e.key.toLowerCase()

      // Delete / Backspace
      if ((key === 'delete' || key === 'backspace') && onDelete) {
        e.preventDefault()
        onDelete()
        return
      }

      // Arrow nudges (with optional Shift for 10×)
      if (onNudge && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        switch (key) {
          case 'arrowup': onNudge(0, -step); break
          case 'arrowdown': onNudge(0, step); break
          case 'arrowleft': onNudge(-step, 0); break
          case 'arrowright': onNudge(step, 0); break
        }
        return
      }

      // Tool shortcuts
      if (toolKeys[key]) {
        e.preventDefault()
        setTool(toolKeys[key])
        return
      }

      // Zoom shortcuts
      if (key === '+' || key === '=') { e.preventDefault(); zoomIn(); return }
      if (key === '-') { e.preventDefault(); zoomOut(); return }
    },
  })
}
