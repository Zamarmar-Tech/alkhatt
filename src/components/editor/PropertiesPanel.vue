<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useCanvasStore } from '@/stores/canvasStore'
import ScrollArea from '@/components/ui/scroll-area/ScrollArea'
import Label from '@/components/ui/label/Label'
import Slider from '@/components/ui/slider/Slider'
import Select from '@/components/ui/select/Select'
import SelectItem from '@/components/ui/select/SelectItem'
import Separator from '@/components/ui/separator/Separator'
import Button from '@/components/ui/button/Button'
import { Type, Settings2 } from '@lucide/vue'

const { t } = useI18n()
const store = useCanvasStore()

const fontIds = ['Amiri', 'Aref_Ruqaa', 'Katibeh', 'Noto_Naskh_Arabic', 'Reem_Kufi']
</script>

<template>
  <div class="flex h-full flex-col bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border px-3 py-2">
      <div class="flex items-center gap-2">
        <Settings2 class="h-4 w-4 text-muted-foreground" />
        <span class="text-xs font-medium text-foreground">{{ t('properties.title') }}</span>
      </div>
    </div>

    <Separator />

    <ScrollArea class="flex-1">
      <div class="space-y-4 p-4">
        <!-- Text Input -->
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <Type class="h-3.5 w-3.5 text-muted-foreground" />
            <Label>{{ t('properties.text') }}</Label>
          </div>
          <textarea
            :value="store.activeText"
            @input="(e: Event) => store.setActiveText((e.target as HTMLTextAreaElement).value)"
            :placeholder="t('properties.textPlaceholder')"
            dir="rtl"
            class="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        <!-- Font Select -->
        <div class="space-y-2">
          <Label>{{ t('properties.font') }}</Label>
          <Select
            :model-value="store.selectedFont"
            @update:model-value="(val: string) => store.selectedFont = val"
          >
            <SelectItem v-for="fontId in fontIds" :key="fontId" :value="fontId">
              {{ t(`fonts.${fontId}`) }}
            </SelectItem>
          </Select>
        </div>

        <!-- Font Size -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>{{ t('properties.fontSize') }}</Label>
            <span class="text-xs text-muted-foreground">{{ store.fontSize }}</span>
          </div>
          <Slider
            :model-value="[store.fontSize]"
            :min="12"
            :max="200"
            :step="1"
            @update:model-value="(val: number[]) => store.fontSize = val[0]"
          />
        </div>

        <!-- Stroke Width -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>{{ t('properties.strokeWidth') }}</Label>
            <span class="text-xs text-muted-foreground">{{ store.strokeWidth }}</span>
          </div>
          <Slider
            :model-value="[store.strokeWidth]"
            :min="0"
            :max="20"
            :step="0.5"
            @update:model-value="(val: number[]) => store.strokeWidth = val[0]"
          />
        </div>

        <!-- Stroke Color -->
        <div class="space-y-2">
          <Label>{{ t('properties.strokeColor') }}</Label>
          <div class="flex items-center gap-3">
            <input
              type="color"
              :value="store.strokeColor"
              @input="(e: any) => store.strokeColor = e.target.value"
              class="h-8 w-8 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
            />
            <span class="text-xs text-muted-foreground font-mono">{{ store.strokeColor }}</span>
          </div>
        </div>

        <!-- Fill Color -->
        <div class="space-y-2">
          <Label>{{ t('properties.fillColor') }}</Label>
          <div class="flex items-center gap-3">
            <input
              type="color"
              :value="store.fillColor"
              @input="(e: any) => store.fillColor = e.target.value"
              class="h-8 w-8 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
            />
            <span class="text-xs text-muted-foreground font-mono">{{ store.fillColor }}</span>
          </div>
        </div>

        <!-- No layer selected state -->
        <div
          v-if="!store.activeLayer"
          class="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground"
        >
          <Settings2 class="mb-2 h-8 w-8 opacity-30" />
          <span>{{ t('properties.selectHint') }}</span>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
