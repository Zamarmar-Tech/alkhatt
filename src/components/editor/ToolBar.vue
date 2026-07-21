<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/uiStore'
import Button from '@/components/ui/button/Button'
import Separator from '@/components/ui/separator/Separator'
import {
  MousePointer2,
  Pencil,
  Pen,
  Type,
  Hand,
  Search,
  Pipette,
} from '@lucide/vue'

const { t } = useI18n()
const ui = useUiStore()

const tools = [
  { id: 'select' as const, icon: MousePointer2, labelKey: 'toolbar.select', shortcut: 'V' },
  { id: 'edit-path' as const, icon: Pencil, labelKey: 'toolbar.editPath', shortcut: 'A' },
  { id: 'pen' as const, icon: Pen, labelKey: 'toolbar.pen', shortcut: 'P' },
  { id: 'text' as const, icon: Type, labelKey: 'toolbar.text', shortcut: 'T' },
  { id: 'hand' as const, icon: Hand, labelKey: 'toolbar.hand', shortcut: 'H' },
  { id: 'zoom' as const, icon: Search, labelKey: 'toolbar.zoom', shortcut: 'Z' },
  { id: 'eyedropper' as const, icon: Pipette, labelKey: 'toolbar.eyedropper', shortcut: 'I' },
]
</script>

<template>
  <div class="flex w-full flex-col items-center gap-2 bg-background py-2">
    <Button
      v-for="tool in tools"
      :key="tool.id"
      :variant="ui.activeTool === tool.id ? 'secondary' : 'ghost'"
      size="icon"
      :title="`${t(tool.labelKey)} (${tool.shortcut})`"
      @click="ui.setActiveTool(tool.id)"
    >
      <component :is="tool.icon" class="h-4 w-4" />
    </Button>
  </div>
</template>
