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
export const googleProvider = new GoogleAuthProvider();
// Request Google Drive Workspace scopes
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/drive.appdata');

// In-Memory Access Token cache (Never stored in localStorage per security guidelines)
let cachedGoogleAccessToken: string | null = null;

export const setCachedGoogleAccessToken = (token: string | null) => {
  cachedGoogleAccessToken = token;
};

export const getCachedGoogleAccessToken = (): string | null => {
  return cachedGoogleAccessToken;
};

export const clearCachedGoogleAccessToken = () => {
  cachedGoogleAccessToken = null;
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

