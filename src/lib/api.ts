import { auth } from './firebase';

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(60_000)])
      : AbortSignal.timeout(60_000),
    headers,
  });
}
