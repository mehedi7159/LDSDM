import fs from 'fs';
import path from 'path';

const PRIMARY_OWNER_EMAIL = 'mehedihasansagor26@gmail.com';
let adminAppInstance = null;

async function getAdminApp(explicitJson) {
  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    
    let credential = null;
    if (explicitJson && typeof explicitJson === 'string') {
      try {
        const parsed = JSON.parse(explicitJson.trim());
        if (parsed.client_email && parsed.private_key) {
          credential = cert(parsed);
        }
      } catch (err) {
        console.warn('Invalid explicit service account JSON:', err);
      }
    }

    if (!credential) {
      const candidates = ['serviceAccountKey.json', 'firebase-service-account.json', 'admin-key.json'];
      for (const file of candidates) {
        const p = path.resolve(file);
        if (fs.existsSync(p)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (parsed.client_email && parsed.private_key) {
              credential = cert(parsed);
              break;
            }
          } catch (err) {
            console.warn(`Error reading ${file}:`, err);
          }
        }
      }
    }

    if (!credential) {
      const envCred = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (envCred) {
        try {
          if (envCred.trim().startsWith('{')) {
            credential = cert(JSON.parse(envCred));
          } else if (fs.existsSync(envCred)) {
            credential = cert(JSON.parse(fs.readFileSync(envCred, 'utf8')));
          }
        } catch (e) {
          console.warn('Error reading FIREBASE_SERVICE_ACCOUNT env:', e);
        }
      }
    }

    if (!credential) {
      return null;
    }

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
  } catch (err) {
    console.error('Error initializing firebase-admin:', err);
    return null;
  }
}

export async function handleAdminBootstrapApi(req, res) {
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
      const { idToken, serviceAccountJson } = data;

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

      const adminApp = await getAdminApp(serviceAccountJson);
      if (!adminApp) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          code: 'SERVICE_ACCOUNT_REQUIRED',
          message: 'Firebase Service Account Private Key is required for first-time owner setup.'
        }));
        return;
      }

      const { getAuth } = await import('firebase-admin/auth');
      const adminAuth = getAuth(adminApp);
      const decoded = await adminAuth.verifyIdToken(idToken, true);
      const userEmail = decoded.email;

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

      await adminAuth.setCustomUserClaims(decoded.uid, {
        role: 'admin',
        isSuperAdmin: true
      });

      console.log(`[Admin API] Granted admin claims to ${userEmail}`);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        uid: decoded.uid,
        email: userEmail,
        role: 'admin',
        isSuperAdmin: true,
        message: `Custom claim assigned to ${userEmail}.`
      }));
    } catch (err) {
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
