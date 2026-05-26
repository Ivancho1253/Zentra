import admin from "firebase-admin";
import fs from "node:fs";

const getServiceAccount = () => {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    return JSON.parse(inline);
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  }

  return null;
};

export const getFirebaseAdmin = () => {
  if (admin.apps.length > 0) {
    return admin;
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
};
