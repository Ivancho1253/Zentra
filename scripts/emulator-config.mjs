import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
await mkdir('.codex-runtime', { recursive: true });
await writeFile(
  '.codex-runtime/firebase.emulator.json',
  JSON.stringify(
    {
      firestore: { rules: resolve('firestore.rules'), indexes: resolve('firestore.indexes.json') },
      emulators: {
        auth: { host: '127.0.0.1', port: 9199 },
        firestore: { host: '127.0.0.1', port: 8180 },
        hub: { port: 4410 },
        logging: { port: 4510 },
        ui: { enabled: false },
        singleProjectMode: false,
      },
    },
    null,
    2,
  ),
);
