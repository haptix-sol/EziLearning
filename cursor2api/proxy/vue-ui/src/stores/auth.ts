import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getStoredToken, setStoredToken, clearStoredToken } from '../storageKeys';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getStoredToken());
  const loggedIn = ref(!!token.value);

  function setToken(t: string) {
    token.value = t;
    setStoredToken(t);
    loggedIn.value = true;
  }

  function clearToken() {
    token.value = null;
    clearStoredToken();
  }

  function logout() {
    clearToken();
    loggedIn.value = false;
  }

  const isLoggedIn = () => !!token.value;

  return { token, loggedIn, setToken, clearToken, logout, isLoggedIn };
});
