<script setup lang="ts">
import { cn } from '@/lib/utils'
import {
  ScrollAreaRoot,
  ScrollAreaViewport,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaCorner,
} from 'radix-vue'

interface Props {
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <ScrollAreaRoot :class="cn('relative overflow-hidden', props.class)">
    <ScrollAreaViewport class="h-full w-full rounded-[inherit]">
      <slot />
    </ScrollAreaViewport>
    <ScrollAreaScrollbar
      orientation="vertical"
      class="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-px"
    >
      <ScrollAreaThumb
        class="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaScrollbar>
    <ScrollAreaScrollbar
      orientation="horizontal"
      class="flex touch-none select-none transition-colors h-2.5 flex-col border-t border-t-transparent p-px"
    >
      <ScrollAreaThumb
        class="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaScrollbar>
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
