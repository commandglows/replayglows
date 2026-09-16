import { createApp } from 'vue'
import { router } from './router'
import { initializeI18n } from '@/i18n'
import { initialiseAuth } from './convex/auth'
import App from './App.vue'
import '../styles/styles.css'

initializeI18n().then(async () => {
  await initialiseAuth()
  createApp(App).use(router).mount('#app')
})
