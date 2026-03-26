# EziLearning — Vue log viewer

Vue 3 + Vite + TypeScript UI served at `/vuelogs`. The static `/logs` page remains in `public/`.

## Develop

```bash
cd vue-ui
npm install
npm run dev
```

Dev server proxies `/api` to `http://localhost:3010` (start the proxy separately).

## Build

```bash
npm run build
```

Output goes to `../public/vue/` for the Express app.
