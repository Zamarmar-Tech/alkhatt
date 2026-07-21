<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useCanvasStore } from '@/stores/canvasStore'
import Button from '@/components/ui/button/Button'
import { Minus, Plus, Maximize } from '@lucide/vue'

const { t } = useI18n()
const store = useCanvasStore()
</script>

<template>
  <div class="flex h-8 items-center justify-between border-t border-border bg-background px-3">
    <!-- Left: status info -->
    <div class="flex items-center gap-2">
      <span class="text-[11px] text-muted-foreground">
        {{ t('status.layers', { count: store.layers.length }) }}
      </span>
    </div>

    <!-- Right: zoom controls -->
    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6"
        :title="t('status.zoomOut')"
        @click="store.zoomOut()"
      >
        <Minus class="h-3.5 w-3.5" />
      </Button>

      <span
        class="min-w-[4rem] cursor-pointer select-none text-center text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
        :title="t('status.resetZoom')"
        @click="store.zoomToFit()"
      >
        {{ Math.round(store.zoom) }}%
      </span>

      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6"
        :title="t('status.zoomIn')"
        @click="store.zoomIn()"
      >
        <Plus class="h-3.5 w-3.5" />
      </Button>

      <div class="mx-1 h-4 w-px bg-border" />

      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6"
        :title="t('status.zoomToFit')"
        @click="store.zoomToFit()"
      >
        <Maximize class="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
</template>
