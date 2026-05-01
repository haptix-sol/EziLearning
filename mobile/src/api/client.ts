import { getApiBaseUrl } from '../config/getApiBaseUrl';

export async function apiGet<T>(path: string): Promise<T> {
  const base = getApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${base}${normalized}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  return res.json() as Promise<T>;
}
