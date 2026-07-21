<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useCanvasStore } from '@/stores/canvasStore'
import ScrollArea from '@/components/ui/scroll-area/ScrollArea'
import Button from '@/components/ui/button/Button'
import Separator from '@/components/ui/separator/Separator'
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Layers,
} from '@lucide/vue'

const { t } = useI18n()
const store = useCanvasStore()
</script>

<template>
  <div class="flex h-full flex-col bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border px-3 py-2">
      <div class="flex items-center gap-2">
        <Layers class="h-4 w-4 text-muted-foreground" />
        <span class="text-xs font-medium text-foreground">{{ t('layers.title') }}</span>
      </div>
    </div>

    <Separator />

    <!-- Layer list -->
    <ScrollArea class="flex-1">
      <div class="p-2">
        <div
          v-for="layer in store.layers"
          :key="layer.id"
          :class="[
            'group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer transition-colors',
            store.activeLayerId === layer.id
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted',
          ]"
          @click="store.setActiveLayer(layer.id)"
        >
          <!-- Visibility toggle -->
          <Button
            variant="ghost"
            size="icon"
            class="h-6 w-6 opacity-0 group-hover:opacity-100"
            @click.stop="store.updateLayer(layer.id, { visible: !layer.visible })"
          >
            <component :is="layer.visible ? Eye : EyeOff" class="h-3.5 w-3.5" />
          </Button>

          <!-- Layer name -->
          <span class="flex-1 truncate text-xs">{{ layer.name }}</span>

          <!-- Lock toggle -->
          <Button
            variant="ghost"
            size="icon"
            class="h-6 w-6 opacity-0 group-hover:opacity-100"
            @click.stop="store.updateLayer(layer.id, { locked: !layer.locked })"
          >
            <component :is="layer.locked ? Lock : Unlock" class="h-3.5 w-3.5" />
          </Button>

          <!-- Delete -->
          <Button
            variant="ghost"
            size="icon"
            class="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100"
            :title="t('layers.delete')"
            @click.stop="store.removeLayer(layer.id)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </Button>
        </div>

        <!-- Empty state -->
        <div
          v-if="store.layers.length === 0"
          class="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground"
        >
          <Layers class="mb-2 h-8 w-8 opacity-30" />
          <span>{{ t('layers.empty') }}</span>
          <span class="mt-1">{{ t('layers.addTextToStart') }}</span>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
