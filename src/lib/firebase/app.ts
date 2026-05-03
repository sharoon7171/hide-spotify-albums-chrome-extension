import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  indexedDBLocalPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig } from "./config";

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let authPersistencePromise: Promise<void> | null = null;

export function firebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

export function firestoreDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = initializeFirestore(firebaseApp(), {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  return cachedDb;
}

export function firebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(firebaseApp());
  if (!authPersistencePromise) {
    authPersistencePromise = setPersistence(
      cachedAuth,
      indexedDBLocalPersistence,
    ).catch(() => undefined);
  }
  return cachedAuth;
}

export function firebaseAuthReady(): Promise<void> {
  firebaseAuth();
  return authPersistencePromise ?? Promise.resolve();
}
