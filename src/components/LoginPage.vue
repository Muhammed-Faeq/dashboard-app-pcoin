<template>
    <div class="login-container">
      <div class="login-card">
        <h1 class="text-center text-2xl font-bold mb-6">PCoin Admin Panel</h1>
        
        <div v-if="errorMessage" class="error-message mb-4 p-2 bg-red-100 text-red-700 rounded">
          {{ errorMessage }}
        </div>
        
        <form @submit.prevent="login">
          <div class="mb-4">
            <label for="email" class="block text-sm font-medium mb-1">Email</label>
            <input 
              type="email" 
              id="email" 
              v-model="email" 
              class="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div class="mb-6">
            <label for="password" class="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              id="password" 
              v-model="password" 
              class="w-full p-2 border rounded"
              required
            />
          </div>
          
          <button 
            type="submit" 
            class="w-full p-2 bg-blue-600 text-white rounded"
            :disabled="loading"
          >
            {{ loading ? 'Logging in...' : 'Login' }}
          </button>
        </form>
      </div>
    </div>
  </template>
  
  <script>
  import { ref } from 'vue';
  import { auth } from '../firebase/firebase';
  import { signInWithEmailAndPassword } from 'firebase/auth';
  import { useRouter } from 'vue-router';
  
  export default {
    name: 'LoginPage',
    setup() {
      const router = useRouter();
      const email = ref('');
      const password = ref('');
      const errorMessage = ref('');
      const loading = ref(false);
  
      const login = async () => {
        try {
          loading.value = true;
          errorMessage.value = '';
          
          await signInWithEmailAndPassword(auth, email.value, password.value);
          router.push('/dashboard');
        } catch (error) {
          console.error('Login error:', error);
          
          switch (error.code) {
            case 'auth/user-not-found':
              errorMessage.value = 'No user found with this email address.';
              break;
            case 'auth/wrong-password':
              errorMessage.value = 'Incorrect password.';
              break;
            case 'auth/invalid-email':
              errorMessage.value = 'Invalid email format.';
              break;
            case 'auth/too-many-requests':
              errorMessage.value = 'Too many failed login attempts. Please try again later.';
              break;
            default:
              errorMessage.value = 'Failed to login. Please try again.';
          }
        } finally {
          loading.value = false;
        }
      };
  
      return {
        email,
        password,
        errorMessage,
        loading,
        login
      };
    }
  };
  </script>
  
  <style scoped>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #f3f4f6;
  }
  
  .login-card {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
    background-color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
  }
  </style>