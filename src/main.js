import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { auth } from './firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Initialize app only after Firebase auth state is determined
let app;

onAuthStateChanged(auth, () => {
  if (!app) {
    app = createApp(App);
    app.use(router);
    app.mount('#app');
  }
});