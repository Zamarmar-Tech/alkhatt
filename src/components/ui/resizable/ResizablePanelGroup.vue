<script setup lang="ts">
import { cn } from '@/lib/utils'
import { SplitterGroup } from 'radix-vue'

interface Props {
  direction?: 'horizontal' | 'vertical'
  class?: string
  autoSaveId?: string
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'horizontal' as const,
})
</script>

<template>
  <SplitterGroup
    :direction="props.direction"
    :class="cn(
      'flex h-full w-full',
      'data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col',
      props.class,
    )"
    :auto-save-id="props.autoSaveId"
  >
    <slot />
  </SplitterGroup>
</template>
