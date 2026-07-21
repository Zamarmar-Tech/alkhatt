/**
 * @fileoverview Vue I18n initialisation.
 *
 * Detects the user's language preference from (in order):
 *   1. `localStorage` key `alkhatt-locale` (from a previous manual switch)
 *   2. The browser's `navigator.language` / `navigator.languages`
 *   3. Falls back to Arabic (`'ar'`)
 *
 * @example
 * ```ts
 * // main.ts
 * import i18n from '@/lib/i18n'
 * app.use(i18n)
 *
 * // In a component:
 * const { t, locale } = useI18n()
 * locale.value = 'en' // switches language
 * ```
 */
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import ar from '@/locales/ar.json'

/**
 * Determine the initial locale.
 * Checks localStorage first, then the browser language.
 */
function getBrowserLocale(): string {
  const stored = localStorage.getItem('alkhatt-locale')
  if (stored === 'en' || stored === 'ar') return stored

  const navLangs = navigator.languages || [navigator.language]
  for (const lang of navLangs) {
    if (lang.startsWith('ar')) return 'ar'
    if (lang.startsWith('en')) return 'en'
  }
  return 'ar'
}

const locale = getBrowserLocale()

export default createI18n({
  legacy: false,       // Use Composition API (`useI18n()`)
  locale,
  fallbackLocale: 'ar',
  messages: { en, ar },
})
