<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTheme, type ThemeMode } from '@/lib/useTheme'
import { useUiStore } from '@/stores/uiStore'
import { Moon, Sun, Monitor, Languages, Layers, Settings2 } from '@lucide/vue'
import { computed } from 'vue'
import Button from '@/components/ui/button/Button'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem'
import DropdownMenuRadioGroup from '@/components/ui/dropdown-menu/DropdownMenuRadioGroup'

const { t, locale } = useI18n()
const { preferredTheme, setTheme } = useTheme()
const ui = useUiStore()

const themeIcon = computed(() => {
  switch (preferredTheme.value) {
    case 'dark': return Moon
    case 'light': return Sun
    case 'system': return Monitor
  }
})

const themeOptions: { mode: ThemeMode; labelKey: string; icon: any }[] = [
  { mode: 'light', labelKey: 'theme.light', icon: Sun },
  { mode: 'dark', labelKey: 'theme.dark', icon: Moon },
  { mode: 'system', labelKey: 'theme.system', icon: Monitor },
]
</script>

<template>
  <div class="flex h-10 items-center gap-2 border-b border-border bg-background px-3">
    <!-- Brand -->
    <span class="text-base font-bold tracking-tight text-foreground">
      {{ t('app.title') }}
    </span>

    <div class="flex-1" />

    <!-- Theme dropdown -->
    <DropdownMenu>
      <template #trigger>
        <Button variant="ghost" size="icon">
          <component :is="themeIcon" class="h-4 w-4" />
        </Button>
      </template>

      <DropdownMenuRadioGroup
        :model-value="preferredTheme"
        @update:model-value="(val: string) => setTheme(val as ThemeMode)"
      >
        <DropdownMenuItem
          v-for="opt in themeOptions"
          :key="opt.mode"
          class="flex items-center gap-3 ps-2 pe-4"
          :class="{ 'bg-accent': preferredTheme === opt.mode }"
          @click="setTheme(opt.mode)"
        >
          <component :is="opt.icon" class="h-4 w-4 text-muted-foreground" />
          <span class="text-xs">{{ t(opt.labelKey) }}</span>
        </DropdownMenuItem>
      </DropdownMenuRadioGroup>
    </DropdownMenu>

    <!-- Language dropdown -->
    <DropdownMenu>
      <template #trigger>
        <Button variant="ghost" size="icon">
          <Languages class="h-4 w-4" />
        </Button>
      </template>

      <DropdownMenuItem
        class="flex items-center gap-3 ps-2 pe-6"
        :class="{ 'bg-accent': locale === 'en' }"
        @click="locale = 'en'"
      >
        <span class="text-xs">{{ t('language.en') }}</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        class="flex items-center gap-3 ps-2 pe-6"
        :class="{ 'bg-accent': locale === 'ar' }"
        @click="locale = 'ar'"
      >
        <span class="text-xs">{{ t('language.ar') }}</span>
      </DropdownMenuItem>
    </DropdownMenu>

    <!-- Panel toggles -->
    <Button variant="ghost" size="icon" @click="ui.toggleLayersPanel()">
      <Layers class="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="icon" @click="ui.togglePropertiesPanel()">
      <Settings2 class="h-4 w-4" />
    </Button>
  </div>
</template>
