import './assets/main.css'
import 'primevue/resources/themes/aura-light-green/theme.css'
import 'primeflex/primeflex.css'

import { createApp } from 'vue'
import App from './App.vue'
import PrimeVue from 'primevue/config';

const app = createApp(App)
app.use(PrimeVue);
// Vue.use(VueWindowSize);
app.mount('#app')
