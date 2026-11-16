import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  idToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function formatAuthError(err: unknown): Error {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return new Error(
        'Email/Password sign-in is not yet enabled in your Firebase Console (Authentication → Sign-in method). You can enable it there or use Continue with Google.'
      );
    case 'auth/popup-closed-by-user':
      return new Error('Sign-in popup was closed before completing.');
    case 'auth/popup-blocked':
      return new Error('Browser blocked the sign-in popup. Please allow popups for this site.');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('Incorrect email or password. Please check and try again.');
    case 'auth/email-already-in-use':
      return new Error('An account with this email already exists. Please sign in instead.');
    case 'auth/weak-password':
      return new Error('Password should be at least 6 characters.');
    case 'auth/invalid-email':
      return new Error('Please enter a valid email address.');
    case 'auth/too-many-requests':
      return new Error('Too many attempts. Please wait a minute and try again.');
    default:
      return err instanceof Error ? err : new Error('Authentication failed. Please try again.');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
        } catch {
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setIdToken(token);
    } catch (err) {
      throw formatAuthError(err);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await cred.user.getIdToken();
      setIdToken(token);
    } catch (err) {
      throw formatAuthError(err);
    }
  }, []);

  const signUpWithEmail = useCallback(async (name: string, email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const trimmedName = name.trim();
      if (trimmedName) {
        await updateProfile(cred.user, { displayName: trimmedName });
      }
      await sendEmailVerification(cred.user);
      const token = await cred.user.getIdToken(true);
      setIdToken(token);
      setUser({ ...cred.user });
    } catch (err) {
      throw formatAuthError(err);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      throw formatAuthError(err);
    }
  }, []);

  const refreshAuthUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const token = await auth.currentUser.getIdToken(true);
    setIdToken(token);
    setUser(auth.currentUser ? ({ ...auth.currentUser } as User) : null);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setIdToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        idToken,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resendVerificationEmail,
        refreshAuthUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
