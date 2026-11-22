import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  getFirestore, 
  doc, 
  getDoc,
  setLogLevel,
  Firestore 
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Set Firestore log level to 'silent' to suppress transient background connection retry notices
setLogLevel('silent');

// Initialize Firestore with custom databaseId if present & resilient connection settings
const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, databaseId);
} catch {
  dbInstance = getFirestore(app, databaseId);
}

export const db = dbInstance;

// Initialize Firebase Auth
export const auth = getAuth(app);
// Login uses a scope-free provider: Google sign-in must NOT ask for
// Drive permission (#20). Drive scopes live only on
// driveGoogleProvider, used by the Drive backup flow.
export const googleProvider = new GoogleAuthProvider();
export const driveGoogleProvider = new GoogleAuthProvider();
// Request Google Drive Workspace scopes (backup only)
driveGoogleProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveGoogleProvider.addScope('https://www.googleapis.com/auth/drive.appdata');

// In-Memory Access Token cache (Never stored in localStorage per security guidelines)
let cachedGoogleAccessToken: string | null = null;
// Whether the cached token was granted with Drive scopes. A token
// from the scope-free login can NOT call the Drive API, so the
// backup flow must not reuse it blindly.
let cachedGoogleAccessTokenHasDrive = false;

export const setCachedGoogleAccessToken = (token: string | null, drive = false) => {
  cachedGoogleAccessToken = token;
  cachedGoogleAccessTokenHasDrive = token !== null && drive;
};

export const getCachedGoogleAccessToken = (): string | null => {
  return cachedGoogleAccessToken;
};

export const isCachedGoogleAccessTokenDrive = (): boolean => {
  return cachedGoogleAccessToken !== null && cachedGoogleAccessTokenHasDrive;
};

export const clearCachedGoogleAccessToken = () => {
  cachedGoogleAccessToken = null;
  cachedGoogleAccessTokenHasDrive = false;
};

export async function testConnection() {
  try {
    if (auth.currentUser) {
      await getDoc(doc(db, 'institution', 'main_store'));
    }
  } catch (error) {
    console.warn('Firebase client operating offline or connecting in background:', error);
  }
}

export { app, firebaseConfig };

