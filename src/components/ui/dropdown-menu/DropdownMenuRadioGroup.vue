<script setup lang="ts">
import { cn } from '@/lib/utils'
import {
  DropdownMenuRadioGroup as RadioGroup,
  DropdownMenuRadioItem as RadioItem,
  DropdownMenuItemIndicator,
} from 'radix-vue'
import { Check } from '@lucide/vue'

interface GroupProps {
  class?: string
  modelValue?: string
}

const groupProps = defineProps<GroupProps>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <RadioGroup
    :model-value="groupProps.modelValue"
    @update:model-value="(val: string) => emit('update:modelValue', val)"
    :class="cn('', groupProps.class)"
  >
    <slot />
  </RadioGroup>
</template>
