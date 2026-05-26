import type express from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0508893636";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const firebaseJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

export const requireFirebaseAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { payload } = await jwtVerify(token, firebaseJwks, {
      issuer: FIREBASE_ISSUER,
      audience: FIREBASE_PROJECT_ID,
    });

    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!uid) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    req.user = {
      uid,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
    return next();
  } catch (error) {
    console.error("Firebase auth verification failed:", error);
    return res.status(401).json({ error: "Invalid authentication token" });
  }
};
