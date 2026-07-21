<script setup lang="ts">
import { cn } from '@/lib/utils'
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'radix-vue'

interface Props {
  class?: string
  defaultValue?: number[]
  modelValue?: number[]
  min?: number
  max?: number
  step?: number
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()
</script>

<template>
  <SliderRoot
    :model-value="modelValue ?? defaultValue"
    :min="min"
    :max="max"
    :step="step"
    :class="cn('relative flex w-full touch-none select-none items-center', props.class)"
    @update:model-value="(val: number[]) => emit('update:modelValue', val)"
  >
    <SliderTrack
      class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary"
    >
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      class="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderRoot>
</template>
