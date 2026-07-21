/**
 * @fileoverview Theme management composable.
 *
 * Provides a reactive theme toggle with three modes:
 *   - `'light'`  → always light (no `dark` class on `<html>`)
 *   - `'dark'`   → always dark  (`dark` class on `<html>`)
 *   - `'system'` → follows the OS `prefers-color-scheme` media query
 *
 * The preference is persisted to `localStorage` under the key `alkhatt-theme`.
 *
 * @example
 * ```ts
 * import { useTheme } from '@/lib/useTheme'
 * const { preferredTheme, cycleTheme } = useTheme()
 * ```
 */
import { ref, onMounted, onUnmounted } from 'vue'

/** Possible theme modes. */
export type ThemeMode = 'light' | 'dark' | 'system'

// ── Internal state (module-level so composable calls share the same ref) ──

const STORAGE_KEY = 'alkhatt-theme'

const preferredTheme = ref<ThemeMode>('dark')
const isDark = ref(false)

let mediaQuery: MediaQueryList | null = null

function loadTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored as ThemeMode
  }
  return 'dark'
}

function applyTheme(mode: ThemeMode) {
  let dark: boolean
  if (mode === 'system') {
    dark = mediaQuery ? mediaQuery.matches : false
  } else {
    dark = mode === 'dark'
  }

  isDark.value = dark
  const root = document.documentElement

  if (dark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function setTheme(mode: ThemeMode) {
  preferredTheme.value = mode
  localStorage.setItem(STORAGE_KEY, mode)
  applyTheme(mode)
}

function cycleTheme() {
  const order: ThemeMode[] = ['dark', 'light', 'system']
  const idx = order.indexOf(preferredTheme.value)
  setTheme(order[(idx + 1) % order.length])
}

/**
 * Reactive theme composable.
 *
 * Call this in any component that needs to read or change the theme.
 * The `dark` CSS class is managed on `document.documentElement`.
 *
 * @returns An object with:
 *   - `preferredTheme` — current mode (`'light'` | `'dark'` | `'system'`)
 *   - `isDark`         — whether the effective theme is dark right now
 *   - `setTheme(mode)` — switch to a specific mode
 *   - `cycleTheme()`   — rotate to the next mode
 */
export function useTheme() {
  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setTheme(loadTheme())

    mediaQuery.addEventListener('change', () => {
      if (preferredTheme.value === 'system') {
        applyTheme('system')
      }
    })
  })

  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', () => {})
    }
  })

  return {
    preferredTheme,
    isDark,
    setTheme,
    cycleTheme,
  }
}
