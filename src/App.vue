<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/uiStore'
import TitleBar from '@/components/editor/TitleBar.vue'
import ToolBar from '@/components/editor/ToolBar.vue'
import FabricCanvas from '@/components/editor/FabricCanvas.vue'
import LayersPanel from '@/components/editor/LayersPanel.vue'
import PropertiesPanel from '@/components/editor/PropertiesPanel.vue'
import StatusBar from '@/components/editor/StatusBar.vue'
import ResizablePanelGroup from '@/components/ui/resizable/ResizablePanelGroup.vue'
import ResizablePanel from '@/components/ui/resizable/ResizablePanel.vue'
import ResizableHandle from '@/components/ui/resizable/ResizableHandle.vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useShortcuts } from '@/lib/useShortcuts'
import { initWorkerBridge, initWorkerWasm } from '@/core/worker-bridge'

const { locale } = useI18n()
const ui = useUiStore()
const store = useCanvasStore()
const canvasRef = ref<InstanceType<typeof FabricCanvas> | null>(null)

// ── Initialise event bus + Web Worker bridge ────────────────────────────
initWorkerBridge()
initWorkerWasm()

function onDelete() {
  store.currentPathData = ''
  store.setActiveText('')
}

function onNudge(dx: number, dy: number) {
  canvasRef.value?.nudgeSelected(dx, dy)
}

useShortcuts(ui.setActiveTool, store.zoomIn, store.zoomOut, onDelete, onNudge)

const isLtr = computed(() => locale.value === 'en')
const showRight = computed(() => ui.layersPanelOpen || ui.propertiesPanelOpen)

function applyDirection(locale: string) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = locale
  localStorage.setItem('alkhatt-locale', locale)
}

applyDirection(locale.value)

watch(locale, (newLocale) => {
  applyDirection(newLocale)
})
</script>

<template>
  <div class="flex h-screen w-screen flex-col overflow-hidden bg-background">
    <!-- Title Bar -->
    <TitleBar />

    <!-- Main Content -->
    <div class="flex flex-1 min-h-0 h-full">
      <!-- Tools sidebar (fixed width, not resizable) -->
      <div class="flex w-12 shrink-0 border-e border-border bg-background">
        <ToolBar />
      </div>

      <!-- Canvas + Right stack (resizable) -->
      <ResizablePanelGroup direction="horizontal" class="h-full w-full">
        <!-- Canvas -->
        <ResizablePanel :default-size="showRight ? 78 : 100" class="min-w-0">
          <FabricCanvas ref="canvasRef" />
        </ResizablePanel>

        <!-- Right stack: Layers + Properties (vertical split) -->
        <template v-if="showRight">
          <ResizableHandle with-handle />

          <ResizablePanel
            :default-size="22"
            :min-size="15"
            :max-size="40"
            class="border-s border-border"
          >
            <ResizablePanelGroup direction="vertical" auto-save-id="alkhatt-right-main" class="h-full w-full">
              <ResizablePanel v-if="ui.layersPanelOpen" :default-size="50" :min-size="15">
                <LayersPanel />
              </ResizablePanel>
              <ResizableHandle v-if="ui.layersPanelOpen && ui.propertiesPanelOpen" with-handle />
              <ResizablePanel v-if="ui.propertiesPanelOpen" :default-size="50" :min-size="15">
                <PropertiesPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </template>
      </ResizablePanelGroup>
    </div>

    <!-- Status Bar -->
    <StatusBar />
  </div>
</template>
