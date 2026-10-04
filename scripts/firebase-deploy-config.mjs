import 'dotenv/config';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const publicConfig = JSON.parse(await readFile('firebase-applet-config.json', 'utf8'));
const database =
  process.env.FIREBASE_DATABASE_ID || publicConfig.firestoreDatabaseId || '(default)';
const edition = (process.env.FIREBASE_DATABASE_EDITION || 'STANDARD').toUpperCase();
if (!['STANDARD', 'ENTERPRISE'].includes(edition))
  throw new Error('FIREBASE_DATABASE_EDITION must be STANDARD or ENTERPRISE.');
if ((process.env.FIREBASE_PROJECT_ID || publicConfig.projectId) !== publicConfig.projectId)
  throw new Error('Server and client project IDs differ. Align them before deployment.');
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
        {
          database,
          rules: resolve('firestore.rules'),
          indexes: resolve(
            edition === 'ENTERPRISE'
              ? 'firestore.enterprise.indexes.json'
              : 'firestore.indexes.json',
          ),
        },
      ],
    },
    null,
    2,
  ),
);
console.log(
  `Prepared rules/index configuration for ${edition} database ${database}. No deployment performed.`,
);
