import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// App Check: blocks unauthorized callers from accessing Firebase services.
// Dev:  set FIREBASE_APPCHECK_DEBUG_TOKEN=true so the SDK auto-generates a debug token
//       (printed to console on first run → add it to Firebase Console → App Check → Debug tokens).
// Prod: register your site at https://console.firebase.google.com → App Check → Register app
//       then add VITE_RECAPTCHA_SITE_KEY to your .env file.
if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? ''),
  isTokenAutoRefreshEnabled: true,
});

// Using initializeFirestore with persistentLocalCache — replaces deprecated enableIndexedDbPersistence.
// persistentMultipleTabManager allows offline persistence across multiple browser tabs simultaneously.
export const db = initializeFirestore(
  app,
  { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);
