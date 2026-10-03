import type express from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getFirebaseAdmin } from './firebaseAdmin';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0508893636';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const firebaseJwks = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        authTime?: number;
      };
    }
  }
}

export function firebaseIdToken(req: express.Request): string {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export const requireFirebaseAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const token = firebaseIdToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const admin = getFirebaseAdmin();
    if (admin) {
      const user = await admin.auth().verifyIdToken(token, true);
      req.user = { uid: user.uid, email: user.email, authTime: user.auth_time };
      return next();
    }
    const { payload } = await jwtVerify(token, firebaseJwks, {
      issuer: FIREBASE_ISSUER,
      audience: FIREBASE_PROJECT_ID,
      requiredClaims: ['sub', 'iat', 'exp', 'auth_time'],
    });

    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    if (!uid) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.user = {
      uid,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      authTime: typeof payload.auth_time === 'number' ? payload.auth_time : undefined,
    };
    return next();
  } catch (error) {
    // Authentication failure details may contain tokens. Return a generic error.
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
};
