<script setup lang="ts">
import { cn } from '@/lib/utils'
import { Label } from 'radix-vue'
</script>

<template>
  <Label
    :class="cn(
      'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    )"
  >
    <slot />
  </Label>
</template>
