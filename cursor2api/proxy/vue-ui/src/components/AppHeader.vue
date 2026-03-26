<template>
  <header class="app-header">
    <div class="header-left">
      <h1><span class="ic">⚡</span> Request logs</h1>
    </div>
    <div class="header-center">
      <div class="stats-pills">
        <div class="sc"><b>{{ stats.totalRequests }}</b> req</div>
        <div class="sc sc-ok">✓<b>{{ stats.successCount }}</b></div>
        <div class="sc sc-err">✗<b>{{ stats.errorCount }}</b></div>
        <div class="sc" v-if="stats.avgResponseTime"><b>{{ fmtMs(stats.avgResponseTime) }}</b> avg</div>
        <div class="sc" v-if="stats.avgTTFT">⚡<b>{{ fmtMs(stats.avgTTFT) }}</b> TTFT</div>
      </div>
    </div>
    <div class="header-right">
      <button class="hdr-btn clear-btn" @click="onClear">🗑 Clear</button>
      <button class="hdr-btn theme-btn" @click="toggleTheme">{{ isDark ? '☀️' : '🌙' }}</button>
      <button v-if="loggedIn && authStore.token" class="hdr-btn logout-btn" @click="onLogout">Log out</button>
      <div class="conn" :class="connected ? 'on' : 'off'">
        <div class="d" />
        <span>{{ connected ? 'Connected' : 'Reconnecting…' }}</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStatsStore } from '../stores/stats';
import { useLogsStore } from '../stores/logs';
import { useAuthStore } from '../stores/auth';
import { storeToRefs } from 'pinia';
import { getStoredTheme, setStoredTheme } from '../storageKeys';

defineProps<{ connected: boolean }>();

const statsStore = useStatsStore();
const logsStore = useLogsStore();
const authStore = useAuthStore();
const { stats } = storeToRefs(statsStore);
const { loggedIn } = storeToRefs(authStore);

function fmtMs(ms: number): string {
  return ms >= 1000 ? (ms / 1000).toFixed(2).replace(/\.?0+$/, '') + 's' : ms + 'ms';
}

function onLogout() {
  authStore.logout();
}

const isDark = ref(false);

onMounted(() => {
  isDark.value = getStoredTheme() === 'dark';
  applyTheme();
});

function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
}

function toggleTheme() {
  isDark.value = !isDark.value;
  setStoredTheme(isDark.value ? 'dark' : 'light');
  applyTheme();
}

async function onClear() {
  if (!confirm('Clear all logs? This cannot be undone.')) return;
  await logsStore.clear();
  await statsStore.load();
}
</script>

<style scoped>
.app-header {
  display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 8px 18px;
  background: rgba(26,29,39,0.92);
  backdrop-filter: blur(16px) saturate(160%);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0; z-index: 10; position: relative;
}
[data-theme="light"] .app-header {
  background: rgba(255,255,255,.88);
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
.header-left { display: flex; align-items: center; gap: 14px; }
.header-center { display: flex; justify-content: center; align-items: center; }
h1 {
  font-size: 15px; font-weight: 700;
  background: linear-gradient(135deg, #6366f1, #3b82f6, #0891b2);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  display: flex; align-items: center; gap: 5px;
}
h1 .ic { -webkit-text-fill-color: initial; font-size: 16px; }
.stats-pills { display: flex; gap: 6px; align-items: center; }
.sc {
  display: flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 500;
  padding: 3px 9px; border-radius: 12px;
  background: var(--pill-bg); color: var(--text-muted);
  border: 1px solid var(--border);
}
.sc b { font-weight: 700; color: var(--text); margin: 0 1px; }
.sc-ok { color: var(--green); }
.sc-ok b { color: var(--green); }
.sc-err { color: var(--red); }
.sc-err b { color: var(--red); }
.header-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
.hdr-btn {
  padding: 4px 11px; font-size: 11px; font-weight: 500;
  background: var(--bg1); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: all .15s;
}
.hdr-btn:hover { border-color: var(--text-muted); color: var(--text); }
.clear-btn:hover { border-color: var(--red); color: var(--red); }
.theme-btn:hover { border-color: var(--accent); color: var(--accent); }
.logout-btn:hover { border-color: var(--orange); color: var(--orange); }
.conn {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 500;
  padding: 4px 10px; border-radius: 20px;
  border: 1px solid var(--border); background: var(--bg1);
}
.conn.on { color: var(--green); border-color: #bbf7d0; }
.conn.off { color: var(--red); border-color: #fecaca; }
.conn .d { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.conn.on .d { background: var(--green); animation: pulse 2s infinite; }
.conn.off .d { background: var(--red); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
</style>
