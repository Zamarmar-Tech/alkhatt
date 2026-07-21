<script setup lang="ts">
import { cn } from '@/lib/utils'
import { SplitterPanel } from 'radix-vue'

interface Props {
  class?: string
  defaultSize?: number
  minSize?: number
  maxSize?: number
  order?: number
}

const props = defineProps<Props>()
</script>

<template>
  <SplitterPanel
    :default-size="props.defaultSize"
    :min-size="props.minSize"
    :max-size="props.maxSize"
    :order="props.order"
    :class="cn('overflow-hidden', props.class)"
  >
    <slot />
  </SplitterPanel>
</template>
