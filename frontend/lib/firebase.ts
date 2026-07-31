import { getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let auth: Auth | null = null;

function getFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(
      `Firebase is not configured. Missing ${missingKeys.join(", ")}.`
    );
  }

  return config as {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  };
}

export function getFirebaseAuth(): Auth {
  if (auth) {
    return auth;
  }

  const app = getApps()[0] || initializeApp(getFirebaseConfig());
  auth = getAuth(app);

  return auth;
}
