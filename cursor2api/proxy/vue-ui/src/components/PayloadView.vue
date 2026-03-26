<template>
  <div class="payload-view">
    <div v-if="!logsStore.payload" class="empty">
      <div class="ic">📭</div><p>No data</p>
    </div>

    <!--  tab -->
    <template v-else-if="mode === 'request'">
      <Section v-if="logsStore.payload.tools?.length" :title="`🔧 Tools`" :count="logsStore.payload.tools.length" count-unit="">
        <ToolItem v-for="t in logsStore.payload.tools" :key="t.name" :tool="t" />
      </Section>

      <Section v-if="logsStore.payload.cursorRequest" title="🔄 Cursor request (transformed)">
        <CodeBlock :content="fmt(logsStore.payload.cursorRequest)" />
      </Section>

      <Section v-if="logsStore.payload.cursorMessages?.length"
        :title="`📨 Cursor messages`" :count="logsStore.payload.cursorMessages.length" count-unit="">
        <template #extra>
          <button class="toggle-all-btn" @click="cursorAllOpen = cursorAllOpen === true ? false : true">
            {{ cursorAllOpen === true ? 'Collapse all' : 'Expand all' }}
          </button>
        </template>
        <MsgItem v-for="(m, i) in logsStore.payload.cursorMessages" :key="i" :msg="m" :mdPreview="mdPreview" :index="i"
          :defaultOpen="msgDefaultOpen(logsStore.payload.cursorMessages, i, cursorAllOpen)" />
      </Section>

      <div v-if="!hasRequest" class="empty"><div class="ic">📥</div><p>No request payload</p></div>
    </template>

    <!--  tab -->
    <template v-else-if="mode === 'prompts'">
      <!--  -->
      <Section v-if="convSummary" title="🔄 Transform summary">
        <div class="conv-grid">
          <div class="cg-item"><span class="cg-l">Orig tools</span><span class="cg-v">{{ convSummary.origToolCount }}</span></div>
          <div class="cg-item"><span class="cg-l">Cursor tools</span><span class="cg-v" style="color:var(--green)">0 <small>(inlined)</small></span></div>
          <div class="cg-item"><span class="cg-l">Tool text</span><span class="cg-v">{{ convSummary.toolInstrChars > 0 ? fmtN(convSummary.toolInstrChars) + ' chars' : convSummary.origToolCount > 0 ? 'in #1' : 'N/A' }}</span></div>
          <div class="cg-item"><span class="cg-l">Orig msgs</span><span class="cg-v">{{ convSummary.origMsgCount }}</span></div>
          <div class="cg-item"><span class="cg-l">Cursor msgs</span><span class="cg-v" style="color:var(--green)">{{ convSummary.cursorMsgCount }}</span></div>
          <div class="cg-item"><span class="cg-l">Context</span><span class="cg-v">{{ convSummary.totalChars ? fmtN(convSummary.totalChars) + ' chars' : '—' }}</span></div>
        </div>
        <div v-if="convSummary.origToolCount > 0" class="tool-warn">
          ⚠️ No native <code>tools</code> param. {{ convSummary.origToolCount }} tool(s) inlined in user #1{{ convSummary.toolInstrChars > 0 ? ' (~ ' + fmtN(convSummary.toolInstrChars) + ' chars)' : '' }}
        </div>
      </Section>

      <Section v-if="logsStore.payload.systemPrompt"
        :title="`🧠 System Prompt`" :count="logsStore.payload.systemPrompt.length" count-unit="chars">
        <CodeBlock :content="logsStore.payload.systemPrompt" :mdPreview="mdPreview" lang="markdown" />
      </Section>

      <Section v-if="logsStore.payload.messages?.length"
        :title="`💬 Messages (raw)`" :count="logsStore.payload.messages.length" count-unit="">
        <template #extra>
          <button class="toggle-all-btn" @click="origAllOpen = origAllOpen === true ? false : true">
            {{ origAllOpen === true ? 'Collapse all' : 'Expand all' }}
          </button>
        </template>
        <MsgItem v-for="(m, i) in logsStore.payload.messages" :key="i" :msg="m" :mdPreview="mdPreview" :index="i"
          :defaultOpen="msgDefaultOpen(logsStore.payload.messages, i, origAllOpen)" />
      </Section>

      <Section v-if="logsStore.payload.cursorMessages?.length"
        :title="`📨 Cursor messages`" :count="logsStore.payload.cursorMessages.length" count-unit="">
        <template #extra>
          <button class="toggle-all-btn" @click="cursorAllOpen = cursorAllOpen === true ? false : true">
            {{ cursorAllOpen === true ? 'Collapse all' : 'Expand all' }}
          </button>
        </template>
        <MsgItem v-for="(m, i) in logsStore.payload.cursorMessages" :key="i" :msg="m" :mdPreview="mdPreview" :index="i"
          :defaultOpen="msgDefaultOpen(logsStore.payload.cursorMessages, i, cursorAllOpen)" />
      </Section>

      <div v-if="!hasPrompts" class="empty"><div class="ic">💬</div><p>No prompt data</p></div>
    </template>

    <!--  tab -->
    <template v-else-if="mode === 'response'">
      <Section v-if="logsStore.payload.thinkingContent"
        :title="`🧠 Thinking`" :count="logsStore.payload.thinkingContent.length" count-unit="chars">
        <CodeBlock :content="logsStore.payload.thinkingContent" :mdPreview="mdPreview" />
      </Section>

      <Section v-if="logsStore.payload.finalResponse"
        :title="`✅ Final response`" :count="logsStore.payload.finalResponse.length" count-unit="chars">
        <CodeBlock :content="logsStore.payload.finalResponse" :mdPreview="mdPreview" lang="markdown" />
      </Section>

      <Section v-if="logsStore.payload.rawResponse && logsStore.payload.rawResponse !== logsStore.payload.finalResponse"
        :title="`📡 Raw stream`" :count="logsStore.payload.rawResponse.length" count-unit="chars">
        <CodeBlock :content="logsStore.payload.rawResponse" :mdPreview="mdPreview" />
      </Section>

      <Section v-if="logsStore.payload.toolCalls?.length"
        :title="`🔧 Tool calls`" :count="logsStore.payload.toolCalls.length" count-unit="">
        <CodeBlock :content="fmt(logsStore.payload.toolCalls)" />
      </Section>

      <Section v-if="logsStore.payload.retryResponses?.length"
        :title="`↺ Retries`" :count="logsStore.payload.retryResponses.length" count-unit="">
        <div v-for="r in logsStore.payload.retryResponses" :key="r.attempt" class="retry-item">
          <div class="retry-hdr">Retry {{ r.attempt }} — {{ r.reason }}</div>
          <CodeBlock :content="r.response.substring(0, 2000) + (r.response.length > 2000 ? '\n...' : '')" />
        </div>
      </Section>

      <Section v-if="logsStore.payload.continuationResponses?.length"
        :title="`📎 Continuations`" :count="logsStore.payload.continuationResponses.length" count-unit="">
        <div v-for="r in logsStore.payload.continuationResponses" :key="r.index" class="retry-item">
          <div class="retry-hdr">Part #{{ r.index }} (deduped {{ r.dedupedLength }} chars)</div>
          <CodeBlock :content="r.response.substring(0, 2000) + (r.response.length > 2000 ? '\n...' : '')" />
        </div>
      </Section>

      <div v-if="!hasResponse" class="empty"><div class="ic">📤</div><p>No response data</p></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, ref, h, watch } from 'vue';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
import { useLogsStore } from '../stores/logs';

//  marked  highlight.js 
marked.setOptions({
  async: false,
  gfm: true,
  breaks: true,
});
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const validLang = lang && hljs.getLanguage(lang) ? lang : null;
  const highlighted = validLang
    ? hljs.highlight(text, { language: validLang }).value
    : hljs.highlightAuto(text).value;
  return `<pre><code class="hljs${validLang ? ' language-' + validLang : ''}">${highlighted}</code></pre>`;
};
marked.use({ renderer });

const props = defineProps<{ mode: 'request' | 'prompts' | 'response'; mdPreview?: boolean }>();
const logsStore = useLogsStore();

function fmt(v: unknown): string {
  return JSON.stringify(v, null, 2);
}

function fmtN(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

const curReq = computed(() =>
  logsStore.reqs.find(r => r.requestId === logsStore.curRequestId)
);

// 
const convSummary = computed(() => {
  const p = logsStore.payload;
  const req = curReq.value;
  if (!p || !req) return null;
  const origMsgCount = p.messages?.length ?? 0;
  const cursorMsgCount = p.cursorMessages?.length ?? 0;
  const origToolCount = req.toolCount ?? 0;
  const firstCursor = p.cursorMessages?.[0];
  const firstUser = p.messages?.find(m => m.role === 'user');
  const toolInstrChars = firstCursor && firstUser
    ? Math.max(0, firstCursor.contentLength - (firstUser.contentLength ?? 0)) : 0;
  const totalChars = (p.cursorRequest as Record<string, unknown>)?.totalChars as number | undefined;
  return { origMsgCount, cursorMsgCount, origToolCount, toolInstrChars, totalChars };
});

// /（null = ，true/false = ）
const cursorAllOpen = ref<boolean | null>(null);
const origAllOpen = ref<boolean | null>(null);

function msgDefaultOpen(
  list: { contentLength: number }[],
  idx: number,
  allOpen: boolean | null
): boolean {
  if (allOpen !== null) return allOpen;
  // 
  return idx >= list.length - 2;
}

const hasRequest = computed(() =>
  !!(logsStore.payload?.tools?.length || logsStore.payload?.cursorRequest || logsStore.payload?.cursorMessages?.length)
);
const hasPrompts = computed(() =>
  !!(logsStore.payload?.systemPrompt || logsStore.payload?.messages?.length)
);
const hasResponse = computed(() =>
  !!(logsStore.payload?.finalResponse || logsStore.payload?.thinkingContent ||
     logsStore.payload?.toolCalls?.length || logsStore.payload?.retryResponses?.length ||
     logsStore.payload?.continuationResponses?.length)
);

// =====  =====

// Section: 
const Section = defineComponent({
  props: {
    title: String,
    count: Number,
    countUnit: { type: String, default: '' },
  },
  setup(p, { slots }) {
    const open = ref(true);
    return () => h('div', { class: 'cs' }, [
      h('div', {
        class: 'cs-hdr',
        onClick: () => { open.value = !open.value; },
      }, [
        h('span', { class: 'cs-arrow' }, open.value ? '▼' : '▶'),
        h('span', { class: 'cs-title' }, p.title),
        p.count != null ? h('span', { class: 'cs-cnt' }, (() => {
          const n = p.countUnit === 'chars'
            ? (p.count >= 1000 ? (p.count / 1000).toFixed(1) + 'k' : String(p.count))
            : String(p.count);
          return p.countUnit ? `${n} ${p.countUnit}` : n;
        })()) : null,
        slots.extra ? h('div', { class: 'cs-extra', onClick: (e: Event) => e.stopPropagation() }, slots.extra()) : null,
      ]),
      open.value ? h('div', { class: 'cs-body' }, slots.default?.()) : null,
    ]);
  },
});

// CodeBlock:  +  + MD
const CodeBlock = defineComponent({
  props: {
    content: String,
    mdPreview: Boolean,
    lang: { type: String, default: '' },
  },
  setup(p) {
    const copied = ref(false);
    async function copy() {
      try {
        await navigator.clipboard.writeText(p.content ?? '');
        copied.value = true;
        setTimeout(() => { copied.value = false; }, 1500);
      } catch { /* ignore */ }
    }
    return () => {
      const content = p.content ?? '';
      if (p.mdPreview && content) {
        return h('div', { class: 'md-wrap' }, [
          h('div', {
            class: 'md-preview',
            innerHTML: marked.parse(content) as string,
          }),
          h('button', { class: 'copy-btn', onClick: copy }, copied.value ? '✓ Copied' : 'Copy'),
        ]);
      }
      return h('div', { class: 'code-wrap' }, [
        h('pre', { class: 'code-block' }, content),
        h('button', { class: 'copy-btn', onClick: copy }, copied.value ? '✓ Copied' : 'Copy'),
      ]);
    };
  },
});

// ToolItem: （）
const ToolItem = defineComponent({
  props: {
    tool: Object as () => { name: string; description?: string },
  },
  setup(p) {
    const open = ref(false);
    return () => {
      const t = p.tool!;
      return h('div', { class: 'msg-item' }, [
        h('div', {
          class: 'msg-hdr',
          onClick: () => { open.value = !open.value; },
        }, [
          h('span', { class: 'msg-arrow' }, open.value ? '▼' : '▶'),
          h('span', { class: 'tool-name' }, t.name),
          !open.value && t.description
            ? h('span', { class: 'tool-hint' }, t.description.slice(0, 50) + (t.description.length > 50 ? '…' : ''))
            : null,
        ]),
        open.value && t.description
          ? h('div', { class: 'msg-body' }, h('pre', { class: 'code-block' }, t.description))
          : null,
      ]);
    };
  },
});

// MsgItem: （）
const MsgItem = defineComponent({
  props: {
    msg: Object as () => { role: string; contentPreview: string; contentLength: number; hasImages?: boolean },
    mdPreview: Boolean,
    defaultOpen: { type: Boolean, default: null },
    index: { type: Number, default: -1 },
  },
  setup(p) {
    const open = ref(p.defaultOpen !== null ? p.defaultOpen : (p.msg?.contentLength ?? 0) <= 2000);
    //  defaultOpen （/）
    watch(() => p.defaultOpen, (v) => { if (v !== null) open.value = v; });
    const copied = ref(false);
    async function copy() {
      try {
        await navigator.clipboard.writeText(p.msg?.contentPreview ?? '');
        copied.value = true;
        setTimeout(() => { copied.value = false; }, 1500);
      } catch { /* ignore */ }
    }
    return () => {
      const m = p.msg!;
      const roleColors: Record<string, string> = {
        user: '#3b82f6', assistant: '#059669', system: '#7c3aed', tool: '#ea580c',
      };
      const color = roleColors[m.role] ?? '#94a3b8';
      return h('div', { class: 'msg-item' }, [
        h('div', {
          class: 'msg-hdr',
          onClick: () => { open.value = !open.value; },
        }, [
          h('span', { class: 'msg-arrow' }, open.value ? '▼' : '▶'),
          p.index >= 0 ? h('span', { class: 'msg-seq' }, `#${p.index + 1}`) : null,
          h('span', { class: 'msg-role', style: { background: color + '22', color } }, m.role),
          h('span', { class: 'msg-len' }, `${m.contentLength >= 1000 ? (m.contentLength / 1000).toFixed(1) + 'k' : m.contentLength} chars`),
          m.hasImages ? h('span', { class: 'msg-img' }, '🖼️ Images') : null,
          h('button', { class: 'copy-btn-sm', onClick: (e: Event) => { e.stopPropagation(); copy(); } },
            copied.value ? '✓' : 'Copy'),
        ]),
        open.value ? h('div', { class: 'msg-body' }, [
          p.mdPreview
            ? h('div', { class: 'md-preview', innerHTML: marked.parse(m.contentPreview) as string })
            : h('pre', { class: 'code-block' }, m.contentPreview),
        ]) : null,
      ]);
    };
  },
});
</script>

<style>
.payload-view { flex: 1; overflow-y: auto; font-size: 12px; }
.empty { padding: 32px; text-align: center; color: var(--text-muted); }
.empty .ic { font-size: 28px; margin-bottom: 8px; }

/* Section */
.cs { border-bottom: 1px solid var(--border-faint); }
.cs-hdr {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; cursor: pointer; user-select: none;
  transition: background .1s;
  position: sticky; top: 0; z-index: 2;
  background: var(--bg1);
  border-bottom: 1px solid var(--border-faint);
}
.cs-hdr:hover { background: var(--hover-bg); }
[data-theme="light"] .cs-hdr { background: #fff; }
[data-theme="light"] .cs-hdr:hover { background: #f7f9fc; }
.cs-arrow { color: var(--text-muted); font-size: 10px; width: 10px; }
.cs-title { font-weight: 700; font-size: 11px; color: var(--blue); text-transform: uppercase; letter-spacing: .5px; }
.cs-cnt { font-size: 10px; color: var(--text-muted); background: var(--pill-bg); padding: 1px 6px; border-radius: 8px; }
.cs-body { padding: 8px 14px 12px; }

/* CodeBlock */
.code-wrap { position: relative; }
.code-block {
  margin: 0; padding: 10px 12px;
  background: var(--pill-bg); border-radius: 6px;
  font-family: var(--mono); font-size: 11px;
  white-space: pre-wrap; word-break: break-all;
  color: var(--text); max-height: 400px; overflow-y: auto;
  border: 1px solid var(--border-faint);
}
.copy-btn {
  position: absolute; top: 6px; right: 6px; font-size: 10px; padding: 2px 8px;
  background: var(--bg1); border: 1px solid var(--border);
  border-radius: 3px; cursor: pointer; color: var(--text-muted); z-index: 1;
  opacity: 0.45; transition: opacity .15s;
}
.code-wrap:hover .copy-btn { opacity: 1; }
.copy-btn:hover { color: var(--text); }

/* MD Preview */
.md-wrap { position: relative; }
.md-preview {
  padding: 10px 14px; line-height: 1.7; font-size: 13px;
  max-height: 500px; overflow-y: auto; overflow-x: hidden;
  border: 1px solid var(--border-faint); border-radius: 6px;
  background: var(--bg1); word-break: break-word;
}
/* msg-body  md-preview （ msg-body ） */
.msg-body .md-preview {
  border: none; border-radius: 0; padding: 0;
  max-height: 600px; background: transparent;
}
.md-preview :deep(h1),.md-preview :deep(h2),.md-preview :deep(h3) { margin: 12px 0 6px; font-weight: 600; }
.md-preview :deep(p) { margin: 6px 0; }
.md-preview :deep(code) {
  background: var(--pill-bg); padding: 1px 5px; border-radius: 3px;
  font-family: var(--mono); font-size: 11px;
}
.md-preview :deep(pre) {
  padding: 0; border-radius: 6px; overflow-x: auto; margin: 8px 0;
}
.md-preview :deep(pre code.hljs) {
  border-radius: 6px; padding: 12px 14px; font-size: 12px;
  font-family: var(--mono); display: block;
}
.md-preview :deep(pre code:not(.hljs)) { background: none; padding: 0; }
.md-preview :deep(ul),.md-preview :deep(ol) { padding-left: 20px; margin: 6px 0; }
.md-preview :deep(blockquote) {
  border-left: 3px solid var(--blue); padding-left: 10px;
  color: var(--text-muted); margin: 8px 0;
}
.md-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 8px 0; }
.md-preview :deep(th),.md-preview :deep(td) { border: 1px solid var(--border); padding: 4px 8px; }
.md-preview :deep(th) { background: var(--pill-bg); }
.md-preview :deep(a) { color: var(--blue); }

/* cs-extra slot (/) */
.cs-extra { margin-left: auto; }
.toggle-all-btn {
  font-size: 10px; padding: 1px 8px;
  border: 1px solid var(--border); border-radius: 4px;
  background: var(--bg); color: var(--text-muted);
  cursor: pointer; transition: all .15s;
}
.toggle-all-btn:hover { border-color: var(--blue); color: var(--blue); }

/* Tool item — MsgItem  */
.tool-item { margin-bottom: 4px; border: 1px solid var(--border-faint); border-radius: 6px; overflow: hidden; }
.tool-item:last-child { margin-bottom: 0; }
.tool-hdr {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; cursor: pointer; background: var(--pill-bg);
  transition: background .1s; user-select: none;
}
.tool-hdr:hover { background: var(--hover-bg); }
.tool-name { font-family: var(--mono); font-weight: 600; color: #a78bfa; font-size: 12px; flex-shrink: 0; }
.tool-hint { font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.tool-body { padding: 8px 10px; background: var(--bg); font-size: 11px; color: var(--text-muted); line-height: 1.6; white-space: pre-wrap; }

/* Msg item */
.msg-item { margin-bottom: 6px; border: 1px solid var(--border-faint); border-radius: 6px; overflow: hidden; }
.msg-hdr {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; cursor: pointer; background: var(--pill-bg);
  transition: background .1s; user-select: none;
}
.msg-hdr:hover { background: var(--hover-bg); }
.msg-arrow { color: var(--text-muted); font-size: 10px; }
.msg-role { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
.msg-seq { font-size: 10px; font-family: var(--mono); font-weight: 700; color: var(--blue); flex-shrink: 0; }
.msg-len { font-size: 10px; color: var(--text-muted); font-family: var(--mono); }
.msg-img { font-size: 10px; color: var(--text-muted); }
.copy-btn-sm {
  margin-left: auto; font-size: 10px; padding: 1px 6px;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 3px; cursor: pointer; color: var(--text-muted); flex-shrink: 0;
}
.copy-btn-sm:hover { color: var(--text); }
.msg-body { padding: 8px 10px; background: var(--bg); }

/* Retry */
.retry-item { margin-bottom: 10px; }
.retry-hdr { font-size: 11px; font-weight: 600; color: var(--yellow); margin-bottom: 4px; }

/*  */
.conv-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px;
}
.cg-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 6px 8px; border-radius: 6px;
  background: var(--pill-bg); border: 1px solid var(--border-faint);
}
.cg-l { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .3px; }
.cg-v { font-size: 12px; font-weight: 600; font-family: var(--mono); color: var(--text); }
.cg-v small { font-size: 9px; font-weight: 400; color: var(--text-muted); }
.tool-warn {
  padding: 7px 10px; border-radius: 6px; font-size: 11px;
  background: color-mix(in srgb, var(--yellow) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--yellow) 30%, transparent);
  color: var(--yellow);
}

/*  */
[data-theme="light"] .cs {
  background: #fff;
  border-bottom-color: #e2e8f0;
}
[data-theme="light"] .cs-hdr { border-bottom: 1px solid #f1f5f9; }
[data-theme="light"] .cs-hdr:hover { background: #f7f9fc; }
[data-theme="light"] .code-block {
  background: #f7f9fc; border-color: #e2e8f0;
  color: #1e293b;
}
[data-theme="light"] .msg-item { border-color: #cbd5e1; }
[data-theme="light"] .msg-hdr { background: #f0f4f8; }
[data-theme="light"] .msg-hdr:hover { background: #e2e8f0; }
[data-theme="light"] .msg-body { background: #fff; }
[data-theme="light"] .cg-item { background: #f7f9fc; border-color: #e2e8f0; }
[data-theme="light"] .cg-l { color: #64748b; }
[data-theme="light"] .cg-v { color: #1e293b; }
</style>
