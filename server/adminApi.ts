import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PRIMARY_OWNER_EMAIL = 'mehedihasansagor26@gmail.com';
let adminAppInstance: App | null = null;

function getServiceAccountCredential() {
  // Check local server files
  const candidates = ['serviceAccountKey.json', 'firebase-service-account.json', 'admin-key.json'];
  for (const file of candidates) {
    const p = path.resolve(file);
    if (fs.existsSync(p)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (parsed.client_email && parsed.private_key) {
          return cert(parsed);
        }
      } catch (err) {
        console.warn(`Error reading ${file}:`, err);
      }
    }
  }

  // Check server environment variables
  const envCred = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (envCred) {
    try {
      if (envCred.trim().startsWith('{')) {
        return cert(JSON.parse(envCred));
      } else if (fs.existsSync(envCred)) {
        return cert(JSON.parse(fs.readFileSync(envCred, 'utf8')));
      }
    } catch (e) {
      console.warn('Error reading FIREBASE_SERVICE_ACCOUNT env:', e);
    }
  }

  return null;
}

function getAdminApp(): App | null {
  const credential = getServiceAccountCredential();
  if (!credential) {
    return null;
  }

  // If already initialized with valid credentials
  if (getApps().length > 0) {
    return getApps()[0];
  }

  let activeProjectId = 'gen-lang-client-0692995380';
  try {
    const configPath = path.resolve('firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsedConfig.projectId) activeProjectId = parsedConfig.projectId;
    }
  } catch {}

  adminAppInstance = initializeApp({
    credential,
    projectId: activeProjectId
  });
  return adminAppInstance;
}

export async function handleAdminBootstrapApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const data = body ? JSON.parse(body) : {};
      const { idToken } = data;

      if (!idToken) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          success: false, 
          code: 'ID_TOKEN_REQUIRED', 
          message: 'Firebase user ID token is required.' 
        }));
        return;
      }

      const adminApp = getAdminApp();
      if (!adminApp) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'SERVICE_ACCOUNT_REQUIRED',
          message: 'Firebase Service Account is not configured on the server environment.'
        }));
        return;
      }

      const adminAuth = getAuth(adminApp);
      
      // Verify caller's ID token using Firebase Admin SDK
      const decoded = await adminAuth.verifyIdToken(idToken, true);
      const userEmail = decoded.email;

      // Strict Security Check: Only the authorized owner email can be granted admin claims via this endpoint
      if (!userEmail || userEmail.toLowerCase() !== PRIMARY_OWNER_EMAIL.toLowerCase()) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'UNAUTHORIZED_EMAIL',
          message: `Only the designated owner email (${PRIMARY_OWNER_EMAIL}) is permitted for bootstrap.`
        }));
        return;
      }

      // Assign Custom Claim { role: 'admin', isSuperAdmin: true }
      await adminAuth.setCustomUserClaims(decoded.uid, {
        role: 'admin',
        isSuperAdmin: true
      });

      console.log(`[Admin API] Successfully granted role: 'admin' (isSuperAdmin: true) to ${userEmail} (UID: ${decoded.uid})`);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        uid: decoded.uid,
        email: userEmail,
        role: 'admin',
        isSuperAdmin: true,
        message: `Custom claim { role: 'admin', isSuperAdmin: true } has been assigned to ${userEmail}.`
      }));
    } catch (err: any) {
      console.error('[Admin API] Error in bootstrap handler:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        code: 'INTERNAL_ERROR',
        message: err?.message || 'Internal server error while setting admin claim.'
      }));
    }
  });
}
