<template>
  <div class="timeline" v-if="summary?.phaseTimings?.length && totalDuration > 0">
    <div class="pbar">
      <div
        v-for="pt in summary.phaseTimings"
        :key="pt.phase + pt.startTime"
        class="pseg"
        :style="{ width: Math.max(1, barWidth(pt)) + '%', background: phaseColor(pt.phase) }"
        :title="pt.label + ': ' + fmtMs(getDur(pt))"
      >
        <span class="tip">{{ pt.label }} {{ fmtMs(getDur(pt)) }}</span>
        <span v-if="barWidth(pt) > 10" class="phase-label">{{ pt.phase }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RequestSummary, PhaseTiming, LogPhase } from '../types';

const props = defineProps<{ summary?: RequestSummary }>();

const totalDuration = computed(() => {
  const s = props.summary;
  if (!s) return 0;
  return (s.endTime ?? Date.now()) - s.startTime;
});

const PC: Record<string, string> = {
  receive: '#4a90d9', convert: '#26c6da', send: '#ab47bc',
  response: '#ab47bc', thinking: '#a855f7', refusal: '#ffa726',
  retry: '#ffa726', truncation: '#ffa726', continuation: '#ffa726',
  toolparse: '#ff7043', sanitize: '#ff7043', stream: '#66bb6a',
  complete: '#66bb6a', error: '#ef5350', intercept: '#ec407a', auth: '#78909c',
};

function phaseColor(phase: LogPhase): string {
  return PC[phase] ?? '#78909c';
}

function getDur(pt: PhaseTiming): number {
  return pt.duration ?? ((pt.endTime ?? Date.now()) - pt.startTime);
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? (ms / 1000).toFixed(2).replace(/\.?0+$/, '') + 's' : ms + 'ms';
}

function barWidth(pt: PhaseTiming): number {
  const dur = getDur(pt);
  const total = totalDuration.value;
  if (total <= 0) return 0;
  return (dur / total) * 100;
}
</script>

<style scoped>
.timeline { padding: 8px 14px; flex-shrink: 0; }
.pbar {
  display: flex; height: 18px; border-radius: 4px; overflow: visible;
  gap: 1px;
}
.pseg {
  position: relative; height: 100%;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; border-radius: 3px;
  cursor: default; min-width: 2px;
}
.pseg:hover .tip { display: block; }
.tip {
  display: none;
  position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%);
  background: #111; color: #fff; font-size: 11px; padding: 3px 8px;
  border-radius: 4px; white-space: nowrap; z-index: 10;
  pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,.3);
}
.phase-label { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.9); }
</style>
