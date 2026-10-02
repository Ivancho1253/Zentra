import 'dotenv/config';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const publicConfig = JSON.parse(await readFile('firebase-applet-config.json', 'utf8'));
const database =
  process.env.FIREBASE_DATABASE_ID || publicConfig.firestoreDatabaseId || '(default)';
if (database !== publicConfig.firestoreDatabaseId)
  throw new Error(
    'Server and client database IDs differ. Align the public config before preparing deployment.',
  );
await mkdir('.codex-runtime', { recursive: true });
await writeFile(
  '.codex-runtime/firebase.deploy.json',
  JSON.stringify(
    {
      firestore: [
        { database, rules: resolve('firestore.rules'), indexes: resolve('firestore.indexes.json') },
      ],
    },
    null,
    2,
  ),
);
console.log(
  `Prepared rules/index configuration for database ${database}. No deployment performed.`,
);
