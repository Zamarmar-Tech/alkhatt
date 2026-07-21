/**
 * @fileoverview Application entry point.
 *
 * Initialises Vue 3 with:
 *   - **Pinia** — state management (canvas objects, UI preferences)
 *   - **Vue I18n** — English and Arabic localisation
 *
 * The `<html>` `dir` and `lang` attributes are set by `App.vue` based on
 * the active locale (see `applyDirection`).
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from '@/lib/i18n'
import App from './App.vue'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)

app.mount('#app')
