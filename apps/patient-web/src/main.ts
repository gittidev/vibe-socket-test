import { createApp } from 'vue';
import App from './App.vue';
import { installUi } from '@packages/ui';
import '@packages/ui/styles.css';

createApp(App).use(installUi).mount('#app');
