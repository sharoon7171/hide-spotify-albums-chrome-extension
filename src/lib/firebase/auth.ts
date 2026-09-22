import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
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

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<FirebaseUserView | null> {
  await firebaseAuthReady();
  const result = await signInWithEmailAndPassword(
    firebaseAuth(),
    email.trim(),
    password,
  );
  return userView(result.user);
}

export async function signOutCurrent(): Promise<void> {
  await firebaseAuthReady();
  await signOut(firebaseAuth());
}
