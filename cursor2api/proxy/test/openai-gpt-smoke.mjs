/**
 * Smoke test: OpenAI-compatible POST /v1/chat/completions with gpt-4o-mini.
 * From proxy/: npm run dev (cursor2api), then: node test/openai-gpt-smoke.mjs
 */
const BASE = `http://127.0.0.1:${process.env.PORT || 3010}`;
const MODEL = process.env.SMOKE_MODEL || "gpt-4o-mini";

const body = {
  model: MODEL,
  messages: [{ role: "user", content: "Reply with exactly: smoke-ok" }],
  max_tokens: 64,
  temperature: 0,
};

const res = await fetch(`${BASE}/v1/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log("HTTP", res.status);
if (!res.ok) {
  console.error(text);
  process.exit(1);
}
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error("Not JSON:", text.slice(0, 500));
  process.exit(1);
}
const content = data.choices?.[0]?.message?.content ?? "";
console.log("Assistant:", JSON.stringify(content));
if (/smoke-ok/i.test(content)) {
  console.log("OK: response mentions smoke-ok");
  process.exit(0);
}
console.log("WARN: unexpected content (upstream may still be healthy)");
process.exit(0);
