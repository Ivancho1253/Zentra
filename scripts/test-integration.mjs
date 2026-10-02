import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const base = 'http://127.0.0.1:3002';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Integration tests require both local Firebase emulators.');
const env = {
  ...process.env,
  PORT: '3002',
  HMR_PORT: '24679',
  DISABLE_HMR: 'false',
  NODE_ENV: 'development',
  DEMO_MODE: 'true',
  VITE_FIREBASE_EMULATORS: 'true',
  FIREBASE_DATABASE_ID: '(default)',
  FIREBASE_SERVICE_ACCOUNT_JSON: '',
  GOOGLE_APPLICATION_CREDENTIALS: '',
  REDIS_URL: '',
  GEMINI_API_KEY: '',
  X_BEARER_TOKEN: '',
  E2E_BASE_URL: base,
  E2E_FIREBASE_EMULATORS: 'true',
};
const server = spawn(
  process.execPath,
  [resolve('node_modules/tsx/dist/cli.mjs'), 'server/dev.ts'],
  { env, windowsHide: true, stdio: 'ignore' },
);
const cleanup = () => {
  server.kill();
};
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Integration server did not start');
  const test = spawn(
    process.execPath,
    [resolve('node_modules/vitest/vitest.mjs'), 'run', 'server/mobileSmoke.test.ts'],
    { env, windowsHide: true, stdio: 'inherit' },
  );
  const code = await new Promise((resolve) => test.on('exit', resolve));
  process.exitCode = code || 0;
} finally {
  cleanup();
}
