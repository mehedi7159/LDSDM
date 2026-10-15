/**
 * Firebase Admin SDK - Authoritative Custom Claims Assignment Tool
 * 
 * Usage:
 * node scripts/set-admin-claim.mjs <target-user-email-or-uid> [path-to-service-account.json]
 * 
 * Examples:
 * node scripts/set-admin-claim.mjs mehedihasansagor26@gmail.com
 * node scripts/set-admin-claim.mjs 4cK...someUid... ./serviceAccountKey.json
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// Resolve project ID from firebase-applet-config.json
let projectId = 'gen-lang-client-0692995380';
try {
  const configPath = path.resolve('firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.projectId) projectId = config.projectId;
  }
} catch {
  // Use fallback
}

// Check for Service Account Key in order of precedence:
// 1. Argument #3
// 2. FIREBASE_SERVICE_ACCOUNT (JSON string or file path)
// 3. GOOGLE_APPLICATION_CREDENTIALS (file path)
// 4. Local serviceAccountKey.json / firebase-adminsdk.json in workspace
let credential = null;
const cliKeyPath = process.argv[3];
const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
const envGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (cliKeyPath && fs.existsSync(cliKeyPath)) {
  console.log(`Using service account key from CLI argument: ${cliKeyPath}`);
  credential = cert(JSON.parse(fs.readFileSync(cliKeyPath, 'utf8')));
} else if (envServiceAccount) {
  try {
    if (envServiceAccount.trim().startsWith('{')) {
      console.log(`Using service account key from FIREBASE_SERVICE_ACCOUNT (inline JSON)`);
      credential = cert(JSON.parse(envServiceAccount));
    } else if (fs.existsSync(envServiceAccount)) {
      console.log(`Using service account key from FIREBASE_SERVICE_ACCOUNT file: ${envServiceAccount}`);
      credential = cert(JSON.parse(fs.readFileSync(envServiceAccount, 'utf8')));
    }
  } catch (e) {
    console.warn(`Could not parse FIREBASE_SERVICE_ACCOUNT:`, e.message);
  }
} else if (envGoogleCreds && fs.existsSync(envGoogleCreds)) {
  console.log(`Using credentials from GOOGLE_APPLICATION_CREDENTIALS: ${envGoogleCreds}`);
  credential = cert(JSON.parse(fs.readFileSync(envGoogleCreds, 'utf8')));
} else {
  const localCandidates = [
    'serviceAccountKey.json',
    'firebase-service-account.json',
    'admin-key.json'
  ];
  for (const candidate of localCandidates) {
    const fullPath = path.resolve(candidate);
    if (fs.existsSync(fullPath)) {
      console.log(`Found local service account key: ${candidate}`);
      credential = cert(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
      break;
    }
  }
}

// Initialize Firebase Admin SDK app
const appConfig = credential ? { credential, projectId } : { projectId };
const app = getApps().length === 0 ? initializeApp(appConfig) : getApps()[0];
const auth = getAuth(app);

const targetIdentifier = process.argv[2] || 'mehedihasansagor26@gmail.com';

async function grantAdminRole(identifier) {
  console.log(`\n======================================================`);
  console.log(`Firebase Admin Role Assignment for: ${identifier}`);
  console.log(`Project: ${projectId}`);
  console.log(`======================================================\n`);

  try {
    let user;
    if (identifier.includes('@')) {
      user = await auth.getUserByEmail(identifier);
    } else {
      user = await auth.getUser(identifier);
    }

    console.log(`✓ User Identified:`);
    console.log(`  - UID: ${user.uid}`);
    console.log(`  - Email: ${user.email || 'N/A'}`);
    console.log(`  - Display Name: ${user.displayName || 'N/A'}`);

    // Set authoritative Custom Claim { role: 'admin' }
    await auth.setCustomUserClaims(user.uid, {
      role: 'admin'
    });

    console.log(`\n✓ SUCCESS: Custom claim { role: 'admin' } assigned to UID: ${user.uid}`);
    console.log(`\nNEXT STEPS:`);
    console.log(`1. In the browser app, open "Admin Authentication" or "Cloud Sync".`);
    console.log(`2. Click "Refresh Claims" (ক্লেইমস রিফ্রেশ).`);
    console.log(`3. The account will immediately become verified admin with full Firestore write access.\n`);
  } catch (err) {
    console.error(`\n✖ ERROR assigning admin claim:`, err?.message || err);
    console.log(`\nTroubleshooting:`);
    console.log(`- Download your Service Account Key from Firebase Console -> Project Settings -> Service Accounts -> "Generate new private key".`);
    console.log(`- Place it as 'serviceAccountKey.json' in this folder and re-run:`);
    console.log(`  node scripts/set-admin-claim.mjs ${identifier} ./serviceAccountKey.json\n`);
    process.exit(1);
  }
}

grantAdminRole(targetIdentifier);
