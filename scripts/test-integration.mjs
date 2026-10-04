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
const server = spawn(process.execPath, ['--import', 'tsx', 'server/dev.ts'], {
  env,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let startupLog = '';
for (const stream of [server.stdout, server.stderr])
  stream.on('data', (chunk) => {
    startupLog = (startupLog + chunk.toString()).slice(-8000);
  });
let startupError;
server.on('error', (error) => {
  startupError = error;
});
const cleanup = () => {
  server.kill();
};
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
try {
  let ready = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (startupError || server.exitCode !== null)
      throw new Error(
        `Integration server exited: ${startupError || server.exitCode}\n${startupLog}`,
      );
    try {
      if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Integration server did not start\n${startupLog}`);
  const test = spawn(
    process.execPath,
    [
      resolve('node_modules/vitest/vitest.mjs'),
      'run',
      ...(process.env.E2E_FEATURE_ONLY === 'true'
        ? ['server/featureFlows.test.ts']
        : ['server/mobileSmoke.test.ts', 'server/featureFlows.test.ts']),
    ],
    { env, windowsHide: true, stdio: 'inherit' },
  );
  const code = await new Promise((resolve) => test.on('exit', resolve));
  process.exitCode = code || 0;
} finally {
  cleanup();
}
