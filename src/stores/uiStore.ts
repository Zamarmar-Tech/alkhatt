/**
 * @fileoverview UI state management.
 *
 * Controls which panels are open, which tool is active, and panel size
 * preferences. This store handles purely presentational state — it does not
 * touch canvas content.
 *
 * @example
 * ```ts
 * import { useUiStore } from '@/stores/uiStore'
 * const ui = useUiStore()
 * ui.setActiveTool('pen')
 * ui.toggleLayersPanel()
 * ```
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** The available interaction modes in the toolbar. */
export type ToolType = 'select' | 'edit-path' | 'pen' | 'text' | 'hand' | 'zoom' | 'eyedropper'

/**
 * UI Store — controls chrome-level UI state.
 *
 * Composition API (setup store) pattern. All state is reactive and
 * accessible across components.
 */
export const useUiStore = defineStore('ui', () => {
  // ── State ──────────────────────────────────────────────────────────────

  /** Currently active tool in the toolbar. */
  const activeTool = ref<ToolType>('select')

  /** Whether the left-side Layers panel is visible. */
  const layersPanelOpen = ref(true)

  /** Whether the right-side Properties panel is visible. */
  const propertiesPanelOpen = ref(true)

  /** Persisted size percentage for the Layers panel (0-100). */
  const layersPanelSize = ref(18)

  /** Persisted size percentage for the Properties panel (0-100). */
  const propertiesPanelSize = ref(22)

  // ── Actions ────────────────────────────────────────────────────────────

  /** Switch the active toolbar tool. */
  function setActiveTool(tool: ToolType) {
    activeTool.value = tool
  }

  /** Toggle the Layers panel open/closed. */
  function toggleLayersPanel() {
    layersPanelOpen.value = !layersPanelOpen.value
  }

  /** Toggle the Properties panel open/closed. */
  function togglePropertiesPanel() {
    propertiesPanelOpen.value = !propertiesPanelOpen.value
  }

  return {
    activeTool,
    layersPanelOpen,
    propertiesPanelOpen,
    layersPanelSize,
    propertiesPanelSize,
    setActiveTool,
    toggleLayersPanel,
    togglePropertiesPanel,
  }
})
