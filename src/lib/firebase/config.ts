import type { FirebaseOptions } from "firebase/app";

function readEnv(key: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[key];
  if (!v) {
    throw new Error(
      `[spotify-ext] Missing env var ${key}. Copy .env.example to .env ` +
        `and fill it in.`,
    );
  }
  return v;
}

export const firebaseConfig: FirebaseOptions = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID"),
};
