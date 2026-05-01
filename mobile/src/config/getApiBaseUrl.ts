import { Platform } from 'react-native';

/**
 * Base URL for the EziLearnings FastAPI backend (same service as `frontend` VITE_API_URL).
 *
 * - **Android emulator**: `10.0.2.2` maps to the host machine’s loopback.
 * - **iOS simulator**: `localhost` reaches the host.
 * - **Physical device**: set `EXPO_PUBLIC_API_URL` to your machine’s LAN IP, e.g. `http://192.168.1.42:8000`.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}
