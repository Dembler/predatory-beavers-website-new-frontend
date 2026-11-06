import { createApp } from 'vue'

import App from './App.vue'
import { router } from './router'
import './styles/fonts.css'
import './styles/theme.css'
import './styles/mobile.css'
import './styles/layout.css'

createApp(App).use(router).mount('#app')
