<script setup lang="ts">
import { cn } from '@/lib/utils'
import { Separator } from 'radix-vue'

interface Props {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'horizontal' as const,
  decorative: true,
})
</script>

<template>
  <Separator
    :orientation="orientation"
    :decorative="decorative"
    :class="cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
    )"
  />
</template>
