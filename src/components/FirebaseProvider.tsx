import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, OAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { Species, DEFAULT_SPECIES } from './species';
import { FOUNDING_PERIOD_OPEN } from './limits';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  socialHandle?: string;
  catName?: string;
  catBreed?: string;
  catAge?: string;
  battleCry?: string;
  catName2?: string;
  battleCry2?: string;
  catThumbnailUrl?: string;
  catThumbnailUrl2?: string;
  role?: string;
  allowRepost?: boolean;
  banned?: boolean;
  badges?: string[];
  blockedUserIds?: string[];
  /** Catnip Club subscriber. Drives every premium gate in the app. */
  isPremium?: boolean;
  /** Joined during launch — keeps unlimited uploads for life. */
  isFoundingMember?: boolean;
  /** Which arena this account plays in. V1 is always 'cat'. */
  species?: Species;
}

// Owner account that is always treated as an admin (matches firestore.rules)
const OWNER_EMAIL = 'bjornpfrengle@gmail.com';

interface FirebaseContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  /** Catnip Club member. Read this rather than userProfile.isPremium directly. */
  isPremium: boolean;
  /** Exempt from the monthly upload cap (members + founding members + admins). */
  hasUnlimitedUploads: boolean;
  signIn: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  logOut: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | null>(null);

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

/**
 * Apple sign-in callbacks, registered once for the lifetime of the page.
 *
 * The native side fires the result with:
 *
 *     window.__onAppleSignIn && window.__onAppleSignIn(token, nonce, name);
 *
 * That `&&` is the trap. These handlers used to be created inside the
 * signInWithApple promise, so they only existed while a sign-in was in flight.
 * If anything cleared them between tapping the button and Apple returning —
 * a re-render, a reload, the webview being reclaimed behind the full-screen
 * Apple sheet — the guard evaluated to nothing and the result was dropped in
 * total silence. Face ID goes green, the sheet dismisses, and the app just sits
 * there, which is exactly what testers reported.
 *
 * Registering them at module scope means the entry point always exists. A
 * result that arrives with no sign-in waiting is now recorded rather than lost.
 */
type ApplePending = {
  onToken: (idToken: string, rawNonce: string) => void;
  onError: (msg: string) => void;
};
let applePending: ApplePending | null = null;

if (typeof window !== 'undefined') {
  (window as any).__onAppleSignIn = (idToken: string, rawNonce: string) => {
    if (!applePending) {
      console.error('Apple sign-in returned but nothing was waiting for it.');
      return;
    }
    const p = applePending;
    applePending = null;
    p.onToken(idToken, rawNonce);
  };
  (window as any).__onAppleSignInError = (msg: string) => {
    if (!applePending) {
      console.error('Apple sign-in error with nothing waiting for it:', msg);
      return;
    }
    const p = applePending;
    applePending = null;
    p.onError(msg);
  };
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Ensure user document exists
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Anonymous Cat',
            photoURL: currentUser.photoURL || '',
            role: 'user',
            isPremium: false,
            isFoundingMember: FOUNDING_PERIOD_OPEN,
            species: DEFAULT_SPECIES,
            createdAt: serverTimestamp()
          });
        }

        // Listen to profile changes
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          }
        });
      } else {
        setUserProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
      }
      
      setIsAuthReady(true);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User cancelled the sign-in flow, ignore the error
        return;
      }
      console.error('Error signing in:', error);
    }
  };

  // Sign in with Apple. Inside the iOS app we use the NATIVE Apple sheet via a
  // bridge (no scary popup); in a plain browser we fall back to the web popup.
  const signInWithApple = async () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    const bridge = (window as any).webkit?.messageHandlers?.appleSignIn;

    if (bridge) {
      // Native path: ask the wrapper to present Apple's sheet, then sign in
      // to Firebase with the returned identity token + nonce.
      //
      // Every failure here used to end in resolve() or an unhandled rejection,
      // so a failed Apple sign-in looked identical to nothing happening: tap
      // the button, no sheet, no error, no account. Two testers hit this and
      // both assumed the button was broken and used Google instead. Errors now
      // carry a real message so the UI can show it and we can see the actual
      // Firebase code rather than guessing.
      await new Promise<void>((resolve, reject) => {
        // If Apple never calls back at all, don't leave the user staring at a
        // dead button forever — fail with something they can report.
        const timeout = setTimeout(() => {
          if (applePending) {
            applePending = null;
            reject(new Error('Apple sign-in timed out. Please try again, or use Google.'));
          }
        }, 90_000);

        applePending = {
          onToken: async (idToken: string, rawNonce: string) => {
            clearTimeout(timeout);
            try {
              const cred = provider.credential({ idToken, rawNonce });
              await signInWithCredential(auth, cred);
              resolve();
            } catch (e: any) {
              console.error('Apple credential sign-in failed:', e?.code, e?.message, e);
              reject(new Error(e?.code ? `${e.code}: ${e.message}` : (e?.message || 'Apple sign-in failed.')));
            }
          },
          onError: (msg: string) => {
            clearTimeout(timeout);
            // A user-cancelled sheet is normal and stays quiet. Anything else
            // is a genuine failure and must surface.
            const cancelled = /cancel|1001/i.test(msg || '');
            if (cancelled) {
              resolve();
            } else {
              console.error('Apple sign-in failed natively:', msg);
              reject(new Error(msg || 'Apple sign-in failed.'));
            }
          },
        };

        try { bridge.postMessage({}); } catch (e: any) {
          clearTimeout(timeout);
          applePending = null;
          reject(new Error('Could not open Apple sign-in: ' + (e?.message || 'bridge unavailable')));
        }
      });
      return;
    }

    // Browser fallback (e.g. testing on the web)
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') return;
      console.error('Error signing in with Apple:', error?.code, error?.message, error);
      throw new Error(error?.code ? `${error.code}: ${error.message}` : 'Apple sign-in failed.');
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isAdmin = userProfile?.role === 'admin' || user?.email === OWNER_EMAIL;
  // Admins always get the premium experience so you can test gated features
  // without flipping your own flag.
  const isPremium = userProfile?.isPremium === true || isAdmin;
  // Founding members keep unlimited uploads even without a subscription.
  const hasUnlimitedUploads = isPremium || userProfile?.isFoundingMember === true;

  return (
    <FirebaseContext.Provider value={{ user, userProfile, isAuthReady, isAdmin, isPremium, hasUnlimitedUploads, signIn, signInWithApple, logOut }}>
      {children}
    </FirebaseContext.Provider>
  );
}
