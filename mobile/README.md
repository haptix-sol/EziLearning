# EziLearnings mobile (iOS & Android)

Single [Expo](https://expo.dev/) + React Native codebase that talks to the **same FastAPI backend** as `../frontend` (no duplicate server).

## Prerequisites

- Node.js 18+
- Backend running from `../backend` (default `http://localhost:8000`)
- **Android**: Android Studio / emulator, or a device with Expo Go
- **iOS**: macOS with Xcode for the simulator, or Expo Go on a device

## API base URL

| Environment | Default base URL |
|---------------|------------------|
| iOS Simulator | `http://localhost:8000` |
| Android Emulator | `http://10.0.2.2:8000` (host loopback) |
| Physical device | Set `EXPO_PUBLIC_API_URL` in `.env` to `http://<your-pc-lan-ip>:8000` |

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` when testing on a real phone.

## Run

```bash
cd mobile
npm install
npm run start
```

Then press `a` for Android or `i` for iOS in the Expo CLI, or scan the QR code with Expo Go.

Ensure the backend is up:

```bash
cd ../backend
# however you usually start uvicorn, e.g.:
# uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Using `--host 0.0.0.0` allows phones on the same Wi‑Fi to reach the API when using `EXPO_PUBLIC_API_URL`.

## Stack

- **React Native** (Expo SDK 54) — one project, two native targets
- **TanStack Query** — reactive caching/refetch for REST calls (`/health`, `/challenges`, …)

Extend by adding screens and calling the same routes the web app uses under `../backend/api/routers`.
