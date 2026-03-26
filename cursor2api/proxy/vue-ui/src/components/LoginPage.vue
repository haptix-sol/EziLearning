<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="logo">
        <h1>⚡ EziLearning</h1>
        <p>Sign in to view logs</p>
      </div>
      <form @submit.prevent="submit">
        <div class="field">
          <label>Auth Token</label>
          <input
            v-model="input"
            type="password"
            placeholder="sk-your-token..."
            autocomplete="current-password"
            autofocus
          />
        </div>
        <button type="submit" class="btn" :disabled="loading">
          {{ loading ? 'Checking…' : 'Sign in' }}
        </button>
      </form>
      <div v-if="error" class="err">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const emit = defineEmits<{ (e: 'loggedIn'): void }>();
const auth = useAuthStore();
const input = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  const t = input.value.trim();
  if (!t) { error.value = 'Token is required'; return; }
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/stats', { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) {
      auth.clearToken();
      error.value = 'Invalid token';
      return;
    }
    auth.setToken(t);
    emit('loggedIn');
  } catch {
    // 
    auth.setToken(t);
    emit('loggedIn');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-overlay {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #e0e7ff 0%, #f0f4f8 30%, #fdf2f8 70%, #f0f4f8 100%);
}
[data-theme="dark"] .login-overlay {
  background: linear-gradient(135deg, #0f1117 0%, #16181f 50%, #0f1117 100%);
}

.login-card {
  width: 400px; padding: 44px;
  background: rgba(255,255,255,.85);
  border: 1px solid rgba(226,232,240,.8);
  border-radius: 20px;
  backdrop-filter: blur(24px);
  box-shadow: 0 20px 40px rgba(0,0,0,.06), 0 8px 16px rgba(0,0,0,.04);
}
[data-theme="dark"] .login-card {
  background: rgba(30,33,48,.85);
  border-color: rgba(255,255,255,.08);
  box-shadow: 0 20px 40px rgba(0,0,0,.4);
}

.logo { text-align: center; margin-bottom: 32px; }
.logo h1 {
  font-size: 24px; font-weight: 700;
  background: linear-gradient(135deg, #6366f1, #3b82f6, #0891b2);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.logo p { font-size: 13px; color: var(--text-muted); margin-top: 8px; }

.field { margin-bottom: 22px; }
.field label {
  display: block; font-size: 11px; font-weight: 600;
  color: var(--text-muted); text-transform: uppercase;
  letter-spacing: .5px; margin-bottom: 8px;
}
.field input {
  width: 100%; padding: 11px 16px; font-size: 14px;
  background: var(--bg1); border: 1px solid var(--border);
  border-radius: 10px; color: var(--text);
  font-family: var(--mono); outline: none; transition: all .2s;
}
.field input:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(59,130,246,.12);
  background: var(--bg);
}
.field input::placeholder { color: var(--text-muted); }

.btn {
  width: 100%; padding: 11px; font-size: 14px; font-weight: 600;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  border: none; border-radius: 10px; color: #fff;
  cursor: pointer; transition: all .2s;
  box-shadow: 0 4px 12px rgba(59,130,246,.25);
}
.btn:hover:not(:disabled) { opacity: .92; box-shadow: 0 6px 16px rgba(59,130,246,.3); }
.btn:active:not(:disabled) { transform: scale(.98); }
.btn:disabled { opacity: .6; cursor: not-allowed; }

.err {
  margin-top: 14px; padding: 10px 14px;
  background: #fef2f2; border: 1px solid #fecaca;
  border-radius: 8px; font-size: 12px; color: #dc2626;
  text-align: center;
}
[data-theme="dark"] .err {
  background: #2a0a0a; border-color: #7f1d1d; color: #fca5a5;
}
</style>
