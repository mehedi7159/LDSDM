/**
 * Firebase Auth via Google REST APIs — no firebase-admin dependency.
 *
 * WHY THIS EXISTS (25 Oct 2026): Vercel compiles these server functions
 * to CommonJS, and importing firebase-admin/auth crashes there because
 * its dependency chain (jwks-rsa -> jose, ESM-only) cannot be required
 * from CommonJS ("require() of ES Module .../jose/dist/webapi/index.js
 * ... not supported"). firebase-admin/app loads, but the auth half does
 * not — so these endpoints must not import firebase-admin/auth at all.
 * Everything here uses only node:crypto + global fetch.
 *
 * What this module covers:
 *  - Service-account credential loading (same sources/order as the old
 *    getServiceAccountCredential: local key files first, then the
 *    FIREBASE_SERVICE_ACCOUNT env var as JSON or as a path).
 *  - OAuth2 access tokens for the service account (JWT bearer assertion,
 *    RS256, cached until near expiry).
 *  - Firebase ID-token verification (Google x509 certs + RS256 signature
 *    via node:crypto, aud/iss/exp/sub checks, optional revocation check
 *    via accounts:lookup validSince — the equivalent of Admin SDK
 *    verifyIdToken(idToken, true)).
 *  - Identity Toolkit Admin REST calls: accounts:lookup (by email or
 *    uid), accounts:update (email/password/customAttributes), and
 *    accounts:create (email+password).
 *
 * Passwords are NEVER logged (email/uid/action only).
 */

import fs from 'fs';
import path from 'path';
import { createSign, createVerify } from 'node:crypto';

export const DEFAULT_PROJECT_ID = 'gen-lang-client-0692995380';
const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const IDENTITYTOOLKIT_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';

export interface ServiceAccountCredential {
  client_email: string;
  private_key: string;
  project_id?: string;
}

/** Typed error for token verification failures (maps to a clean 4xx). */
export class TokenVerificationError extends Error {
  readonly code = 'INVALID_TOKEN';
  readonly statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'TokenVerificationError';
  }
}

/** Typed error for Identity Toolkit REST failures (carries the API code). */
export class IdentityToolkitError extends Error {
  readonly restCode: string;
  readonly httpStatus: number;
  constructor(restCode: string, httpStatus: number, message: string) {
    super(message);
    this.name = 'IdentityToolkitError';
    this.restCode = restCode;
    this.httpStatus = httpStatus;
  }
}

export interface DecodedIdToken {
  uid: string;
  email?: string;
  role?: unknown;
  isSuperAdmin?: unknown;
  auth_time?: number;
}

/* ------------------------------------------------------------------ */
/* Service-account credential loading (same sources as before)         */
/* ------------------------------------------------------------------ */

export function getServiceAccountCredential(): ServiceAccountCredential | null {
  // Check local server files first (same candidates as before).
  const candidates = ['serviceAccountKey.json', 'firebase-service-account.json', 'admin-key.json'];
  for (const file of candidates) {
    const p = path.resolve(file);
    if (fs.existsSync(p)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (parsed.client_email && parsed.private_key) {
          return {
            client_email: parsed.client_email,
            private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
            project_id: parsed.project_id,
          };
        }
      } catch (err) {
        console.warn(`Error reading ${file}:`, err);
      }
    }
  }

  // Then the server environment variable (JSON string, or a path to one).
  const envCred = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (envCred) {
    try {
      if (envCred.trim().startsWith('{')) {
        const parsed = JSON.parse(envCred);
        if (parsed.client_email && parsed.private_key) {
          return {
            client_email: parsed.client_email,
            private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
            project_id: parsed.project_id,
          };
        }
      } else if (fs.existsSync(envCred)) {
        const parsed = JSON.parse(fs.readFileSync(envCred, 'utf8'));
        if (parsed.client_email && parsed.private_key) {
          return {
            client_email: parsed.client_email,
            private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
            project_id: parsed.project_id,
          };
        }
      }
    } catch (e) {
      console.warn('Error reading FIREBASE_SERVICE_ACCOUNT env:', e);
    }
  }

  return null;
}

/**
 * Project id resolution, mirroring the old getAdminApp: an explicit
 * firebase-applet-config.json wins, then the service account's own
 * project, then the historical default.
 */
export function resolveProjectId(cred: ServiceAccountCredential | null): string {
  try {
    const configPath = path.resolve('firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsedConfig.projectId) return parsedConfig.projectId;
    }
  } catch {}
  if (cred?.project_id) return cred.project_id;
  return DEFAULT_PROJECT_ID;
}

/* ------------------------------------------------------------------ */
/* JWT helpers (base64url + RS256 via node:crypto)                     */
/* ------------------------------------------------------------------ */

function base64urlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function signRs256Jwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: string
): string {
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(privateKey, 'base64url');
  return `${signingInput}.${signature}`;
}

/* ------------------------------------------------------------------ */
/* Service-account OAuth2 access token (cached until near expiry)      */
/* ------------------------------------------------------------------ */

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

export async function getServiceAccountAccessToken(
  cred: ServiceAccountCredential
): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAtMs - 60_000) {
    return cachedAccessToken.token;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  const assertion = signRs256Jwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: cred.client_email,
      scope: IDENTITYTOOLKIT_SCOPE,
      aud: TOKEN_URL,
      exp: nowSeconds + 3600,
      iat: nowSeconds,
    },
    cred.private_key
  );
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` +
      `&assertion=${encodeURIComponent(assertion)}`,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to exchange service account token (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('Token endpoint returned no access_token');
  }
  cachedAccessToken = {
    token: data.access_token,
    expiresAtMs: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.token;
}

/* ------------------------------------------------------------------ */
/* Firebase ID-token verification (x509 certs + RS256)                 */
/* ------------------------------------------------------------------ */

let cachedCerts: { certs: Record<string, string>; fetchedAtMs: number } | null = null;
const CERTS_TTL_MS = 60 * 60 * 1000;

async function fetchCerts(bypassCache: boolean): Promise<Record<string, string>> {
  if (!bypassCache && cachedCerts && Date.now() - cachedCerts.fetchedAtMs < CERTS_TTL_MS) {
    return cachedCerts.certs;
  }
  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase certs (HTTP ${res.status})`);
  }
  const certs = (await res.json()) as Record<string, string>;
  cachedCerts = { certs, fetchedAtMs: Date.now() };
  return certs;
}

export interface VerifyOptions {
  /** For tests: kid -> PEM certificate/public-key, skips the Google fetch. */
  certs?: Record<string, string>;
  /**
   * When provided, the token's auth_time is compared against the user's
   * validSince (revocation check, like verifyIdToken(idToken, true)).
   * The function receives the token uid and returns validSince seconds
   * (string) or null when the user is not found.
   */
  lookupValidSince?: (uid: string) => Promise<string | null>;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
  options: VerifyOptions = {}
): Promise<DecodedIdToken> {
  const fail = (message: string): never => {
    throw new TokenVerificationError(message);
  };
  if (typeof idToken !== 'string' || !idToken) {
    fail('ID token is missing');
  }
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    fail('ID token is malformed');
  }
  let header: any;
  let payload: any;
  try {
    header = JSON.parse(base64urlDecode(parts[0]).toString('utf8'));
    payload = JSON.parse(base64urlDecode(parts[1]).toString('utf8'));
  } catch {
    fail('ID token is not valid JSON');
  }
  if (header.alg !== 'RS256') {
    fail('ID token algorithm is not RS256');
  }
  if (typeof header.kid !== 'string' || !header.kid) {
    fail('ID token has no kid');
  }
  let certs = options.certs;
  if (!certs) {
    try {
      certs = await fetchCerts(false);
    } catch (err: any) {
      throw new Error(`Failed to fetch Firebase certs: ${err?.message || err}`);
    }
  }
  let certPem = certs[header.kid];
  if (!certPem && !options.certs) {
    // Unknown kid: refresh once in case keys rotated.
    try {
      certs = await fetchCerts(true);
    } catch (err: any) {
      throw new Error(`Failed to refresh Firebase certs: ${err?.message || err}`);
    }
    certPem = certs[header.kid];
  }
  if (!certPem) {
    fail('ID token kid does not match any Firebase certificate');
  }
  let signatureValid = false;
  try {
    signatureValid = createVerify('RSA-SHA256')
      .update(`${parts[0]}.${parts[1]}`)
      .verify(certPem, base64urlDecode(parts[2]));
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    fail('ID token signature verification failed');
  }
  if (payload.aud !== projectId) {
    fail('ID token audience does not match this project');
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    fail('ID token issuer is not this project');
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    fail('ID token is expired');
  }
  if (typeof payload.sub !== 'string' || !payload.sub) {
    fail('ID token has no subject');
  }
  const decoded: DecodedIdToken = {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    role: payload.role,
    isSuperAdmin: payload.isSuperAdmin,
    auth_time: typeof payload.auth_time === 'number' ? payload.auth_time : undefined,
  };
  if (options.lookupValidSince && typeof decoded.auth_time === 'number') {
    const validSince = await options.lookupValidSince(decoded.uid);
    if (validSince === null) {
      fail('ID token user no longer exists');
    }
    const validSinceSeconds = parseInt(validSince, 10);
    if (!Number.isNaN(validSinceSeconds) && decoded.auth_time < validSinceSeconds) {
      fail('ID token has been revoked');
    }
  }
  return decoded;
}

/* ------------------------------------------------------------------ */
/* Identity Toolkit Admin REST client                                  */
/* ------------------------------------------------------------------ */

function identityToolkitBase(projectId: string): string {
  return `https://identitytoolkit.googleapis.com/v1/projects/${projectId}`;
}

export function extractRestCode(message: string): string {
  // Messages look like "WEAK_PASSWORD : Password should be at least 6
  // characters" or plain "USER_NOT_FOUND".
  return message.split(' : ')[0].trim();
}

async function restPost(
  url: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && data.error && typeof data.error.message === 'string' && data.error.message) ||
      `HTTP ${res.status}`;
    throw new IdentityToolkitError(extractRestCode(message), res.status, message);
  }
  return data;
}

export interface RestUser {
  localId: string;
  email?: string;
  validSince?: string;
}

/** Throws IdentityToolkitError USER_NOT_FOUND when no user matches. */
export async function lookupUserByEmail(
  accessToken: string,
  projectId: string,
  email: string
): Promise<RestUser> {
  const data = await restPost(`${identityToolkitBase(projectId)}/accounts:lookup`, accessToken, {
    email: [email],
  });
  const users = Array.isArray(data?.users) ? data.users : [];
  if (users.length === 0) {
    throw new IdentityToolkitError('USER_NOT_FOUND', 404, 'USER_NOT_FOUND');
  }
  return { localId: users[0].localId, email: users[0].email, validSince: users[0].validSince };
}

/** Returns null when the uid has no user (used for the revocation check). */
export async function lookupUserByUid(
  accessToken: string,
  projectId: string,
  uid: string
): Promise<RestUser | null> {
  try {
    const data = await restPost(`${identityToolkitBase(projectId)}/accounts:lookup`, accessToken, {
      localId: [uid],
    });
    const users = Array.isArray(data?.users) ? data.users : [];
    if (users.length === 0) return null;
    return { localId: users[0].localId, email: users[0].email, validSince: users[0].validSince };
  } catch (err: any) {
    if (err instanceof IdentityToolkitError && err.restCode === 'USER_NOT_FOUND') return null;
    throw err;
  }
}

export interface UserUpdates {
  email?: string;
  password?: string;
  /** JSON string of the custom claims object (accounts:update format). */
  customAttributes?: string;
}

export async function updateRestUser(
  accessToken: string,
  projectId: string,
  localId: string,
  updates: UserUpdates
): Promise<RestUser> {
  const data = await restPost(`${identityToolkitBase(projectId)}/accounts:update`, accessToken, {
    localId,
    ...updates,
  });
  return { localId: data.localId ?? localId, email: data.email };
}

export async function createRestUser(
  accessToken: string,
  projectId: string,
  email: string,
  password: string
): Promise<RestUser> {
  const data = await restPost(`${identityToolkitBase(projectId)}/accounts:create`, accessToken, {
    email,
    password,
  });
  return { localId: data.localId, email: data.email ?? email };
}

/** Maps Identity Toolkit password errors to the endpoint's INVALID_PASSWORD. */
export function isInvalidPasswordError(err: unknown): boolean {
  return (
    err instanceof IdentityToolkitError &&
    (err.restCode === 'WEAK_PASSWORD' || err.restCode === 'INVALID_PASSWORD')
  );
}
