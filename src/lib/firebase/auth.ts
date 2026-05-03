import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  type User,
} from "firebase/auth";
import type { FirebaseUserView } from "@/lib/messages";
import { firebaseAuth, firebaseAuthReady } from "./app";

export function userView(user: User | null): FirebaseUserView | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth(), cb);
}

export async function currentUserReady(): Promise<User | null> {
  await firebaseAuthReady();
  const auth = firebaseAuth();
  if (auth.currentUser) return auth.currentUser;
  return new Promise<User | null>((resolve) => {
    const off = onAuthStateChanged(auth, (u) => {
      off();
      resolve(u);
    });
  });
}

type AuthTokenResult = string | { token?: string };

function getChromeAuthToken(interactive: boolean): Promise<string | null> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (raw) => {
      const err = chrome.runtime.lastError;
      if (err) {
        if (!interactive) {
          resolve(null);
          return;
        }
        reject(
          Object.assign(new Error(err.message ?? "auth token failed"), {
            code: "chrome-identity-error",
          }),
        );
        return;
      }
      const r = raw as AuthTokenResult | undefined;
      const token = typeof r === "string" ? r : r?.token ?? null;
      resolve(token ?? null);
    });
  });
}

function removeChromeAuthToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

export async function signInGoogle(): Promise<FirebaseUserView | null> {
  await firebaseAuthReady();
  const token = await getChromeAuthToken(true);
  if (!token) {
    throw Object.assign(new Error("no token returned"), {
      code: "no-token",
    });
  }
  try {
    const credential = GoogleAuthProvider.credential(null, token);
    const result = await signInWithCredential(firebaseAuth(), credential);
    return userView(result.user);
  } catch (e) {
    await removeChromeAuthToken(token).catch(() => undefined);
    throw e;
  }
}

export async function signOutCurrent(): Promise<void> {
  await firebaseAuthReady();
  const token = await getChromeAuthToken(false).catch(() => null);
  if (token) await removeChromeAuthToken(token).catch(() => undefined);
  await signOut(firebaseAuth());
}
