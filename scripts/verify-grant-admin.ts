/**
 * Grant-admin endpoint + owner button — self-check (21 Nov 2026).
 *
 * Problem (verified in code + live screenshot 21 Nov 2026, 13:16): the
 * principal account ldsdm.2003@gmail.com is stuck in Viewer Mode (Custom
 * Claim Role: None, Firestore Write Access RESTRICTED). The existing
 * POST /api/admin/bootstrap-owner only grants the claim to the CALLER
 * and only the owner email may call it — and the in-app bootstrap is
 * unreachable for the owner (the AdminAuthModal opens only for
 * non-admins; its "অন্য অ্যাকাউন্ট" switch logs out and closes the
 * modal). So the owner needs a separate grant path for the principal.
 *
 * This script covers (test-first, RED→GREEN, like verify-api-admin-500):
 *  - Static: the import graph from api/admin/grant-admin.ts has no
 *    import.meta, no .ts imports, every relative import uses an
 *    explicit .js extension, never reaches services/appConfig.ts and
 *    never imports firebase-admin (it crashes on Vercel CJS).
 *  - Static: the handler's checks in order (405 / 400 ID_TOKEN_REQUIRED
 *    / 400 TARGET_EMAIL_REQUIRED / 400 TARGET_EMAIL_INVALID / 400
 *    SERVICE_ACCOUNT_REQUIRED / 403 UNAUTHORIZED_EMAIL / 404
 *    TARGET_NOT_FOUND / 403 TARGET_PROTECTED) and the claim it sets is
 *    exactly {"role":"admin"} — never isSuperAdmin (only the owner
 *    holds that); no token is ever logged.
 *  - Static: server.ts + vite.config.ts route /api/admin/grant-admin
 *    (dev, preview and standalone server), package.json exposes the
 *    npm script, and the Diagnostics card in CloudSyncWidget has the
 *    owner-only "প্রিন্সিপালকে এডমিন করুন" button for
 *    ldsdm.2003@gmail.com calling /api/admin/grant-admin.
 *  - Runtime (CommonJS, mocked fetch + locally signed RS256 tokens, no
 *    network, no live Firebase): 405, 400 no-token, 400 missing/bad
 *    targetEmail, 400 SERVICE_ACCOUNT_REQUIRED, 403 non-owner caller,
 *    404 unknown target, 403 protected owner target, and the 200
 *    success path — asserting the accounts:update body carries
 *    customAttributes '{"role":"admin"}' and nothing else.
 *  - Runtime (ESM): the chain compiles to ESM and loads under plain
 *    node, answering GET with 405 and POST without idToken with 400.
 *
 * Run: npx tsx scripts/verify-grant-admin.ts (or npm run test:grant-admin).
 */
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const readSource = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const fileExists = (rel: string) => fs.existsSync(path.join(repoRoot, rel));

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
  }
}

/** Strip line + block comments so doc mentions don't count. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Resolve a relative import specifier to a repo file, or null if unresolvable. */
function resolveRelative(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(path.join(repoRoot, fromFile)), spec);
  const cands = [base, `${base}.ts`, path.join(base, 'index.ts')];
  if (spec.endsWith('.js')) cands.push(base.replace(/\.js$/, '.ts'));
  for (const cand of cands) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return path.relative(repoRoot, cand);
  }
  return null;
}

/** Walk relative imports from the entries; returns every reachable repo file. */
function walkImportGraph(entries: string[]): { files: string[]; imports: { file: string; spec: string }[] } {
  const files: string[] = [];
  const imports: { file: string; spec: string }[] = [];
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    files.push(file);
    const src = stripComments(readSource(file));
    const re = /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const spec = m[1] ?? m[2];
      imports.push({ file, spec });
      const resolved = resolveRelative(file, spec);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return { files, imports };
}

const ENTRIES = ['api/admin/grant-admin.ts'];
const OWNER_EMAIL = 'mehedihasansagor26@gmail.com';
const PRINCIPAL_EMAIL = 'ldsdm.2003@gmail.com';

console.log('--- Files exist ---');
check('api/admin/grant-admin.ts exists', () => {
  assert.ok(fileExists('api/admin/grant-admin.ts'), 'missing api/admin/grant-admin.ts');
});
check('server/grantAdminApi.ts exists', () => {
  assert.ok(fileExists('server/grantAdminApi.ts'), 'missing server/grantAdminApi.ts');
});
check('scripts/verify-grant-admin.ts exists (this script)', () => {
  assert.ok(fileExists('scripts/verify-grant-admin.ts'));
});

let graph = { files: [] as string[], imports: [] as { file: string; spec: string }[] };
if (fileExists('api/admin/grant-admin.ts')) {
  graph = walkImportGraph(ENTRIES);
  console.log('--- Import graph reachable from the grant-admin handler ---');
  console.log(`  ${graph.files.join('\n  ')}`);
}

check('grant-admin handler is the graph entry', () => {
  assert.ok(graph.files.includes('api/admin/grant-admin.ts'));
});

check('no import.meta anywhere in the reachable chain (code, not comments)', () => {
  const bad = graph.files.filter((f) => stripComments(readSource(f)).includes('import.meta'));
  assert.deepStrictEqual(bad, [], `files using import.meta: ${bad.join(', ')}`);
});

check('no .ts extension imports anywhere in the reachable chain', () => {
  const bad = graph.imports.filter((i) => i.spec.endsWith('.ts'));
  assert.deepStrictEqual(bad, [], bad.map((i) => `${i.file} -> ${i.spec}`).join(', '));
});

check('every relative import in the reachable chain uses an explicit .js extension (ESM-safe)', () => {
  const bad = graph.imports.filter((i) => i.spec.startsWith('.') && !i.spec.endsWith('.js'));
  assert.deepStrictEqual(bad, [], bad.map((i) => `${i.file} -> ${i.spec}`).join(', '));
});

check('chain never reaches services/appConfig.ts (the import.meta source)', () => {
  assert.ok(!graph.files.includes('services/appConfig.ts'), 'services/appConfig.ts must not be reachable from the handler');
});

check('chain never imports firebase-admin (crashes on Vercel CJS)', () => {
  const bad = graph.files.filter((f) => stripComments(readSource(f)).includes('firebase-admin'));
  assert.deepStrictEqual(bad, [], `files importing firebase-admin: ${bad.join(', ')}`);
});

console.log('--- Handler behaviour (source) ---');
check('handler exports handleAdminGrantApi and guards the method with 405', () => {
  const src = readSource('server/grantAdminApi.ts');
  assert.ok(src.includes('export async function handleAdminGrantApi'), 'must export handleAdminGrantApi');
  assert.ok(src.includes("req.method !== 'POST'"), 'method guard must stay');
  assert.ok(src.includes('405'), '405 must stay');
});

check('handler checks the token, the target email and the service account, in order', () => {
  const src = stripComments(readSource('server/grantAdminApi.ts'));
  for (const code of ['ID_TOKEN_REQUIRED', 'TARGET_EMAIL_REQUIRED', 'TARGET_EMAIL_INVALID', 'SERVICE_ACCOUNT_REQUIRED', 'UNAUTHORIZED_EMAIL', 'TARGET_NOT_FOUND', 'TARGET_PROTECTED']) {
    assert.ok(src.includes(code), `must return ${code}`);
  }
  const order = ['ID_TOKEN_REQUIRED', 'TARGET_EMAIL_REQUIRED', 'SERVICE_ACCOUNT_REQUIRED', 'UNAUTHORIZED_EMAIL', 'TARGET_NOT_FOUND'];
  const idx = order.map((c) => src.indexOf(c));
  for (let i = 1; i < idx.length; i++) {
    assert.ok(idx[i] > idx[i - 1], `${order[i]} must come after ${order[i - 1]} in the handler`);
  }
});

check('handler looks the target up by email and sets exactly {"role":"admin"} — never isSuperAdmin', () => {
  const src = stripComments(readSource('server/grantAdminApi.ts'));
  assert.ok(src.includes('lookupUserByEmail'), 'must look the target up by email');
  assert.ok(src.includes("customAttributes: JSON.stringify({ role: 'admin' })"), 'must set customAttributes to exactly {"role":"admin"}');
  assert.ok(!src.includes('isSuperAdmin'), 'must never set isSuperAdmin on the granted claim');
  assert.ok(src.includes('TARGET_NOT_FOUND'), 'unknown target must be 404');
});

check('handler never logs a token', () => {
  const src = stripComments(readSource('server/grantAdminApi.ts'));
  const logged = src.match(/console\.(log|warn|error)\([^)]*idToken/g);
  assert.strictEqual(logged, null, 'tokens must never be logged');
});

check('handler only accepts the owner email as caller', () => {
  const src = stripComments(readSource('server/grantAdminApi.ts'));
  assert.ok(src.includes("from './serverConfig.js'"), 'must import SUPER_ADMIN_EMAIL from ./serverConfig.js');
  assert.ok(src.includes('OWNER_EMAIL'), 'must compare the caller against the owner email');
  const serverConfig = stripComments(readSource('server/serverConfig.ts'));
  assert.ok(serverConfig.includes(OWNER_EMAIL), 'serverConfig must keep the owner fallback address');
});

console.log('--- Wiring (server.ts + vite.config.ts + npm) ---');
check('server.ts routes /api/admin/grant-admin', () => {
  const src = readSource('server.ts');
  assert.ok(src.includes("urlPath.startsWith('/api/admin/grant-admin')"), 'server.ts must route grant-admin');
  assert.ok(src.includes('handleAdminGrantApi'), 'server.ts must import handleAdminGrantApi');
});
check('vite.config.ts routes /api/admin/grant-admin in dev and preview', () => {
  const src = readSource('vite.config.ts');
  const hits = src.split("server.middlewares.use('/api/admin/grant-admin'").length - 1;
  assert.ok(hits >= 2, `vite.config.ts must route grant-admin in dev + preview, found ${hits}`);
});
check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:grant-admin'], 'tsx scripts/verify-grant-admin.ts', 'npm run test:grant-admin must run this script');
});

console.log('--- Owner button (CloudSyncWidget) ---');
check('Diagnostics card has the owner-only grant button for the principal', () => {
  const src = readSource('components/CloudSyncWidget.tsx');
  assert.ok(src.includes('প্রিন্সিপালকে এডমিন করুন'), 'button label must be present');
  assert.ok(src.includes("'/api/admin/grant-admin'"), 'button must call /api/admin/grant-admin');
  assert.ok(src.includes(PRINCIPAL_EMAIL), 'button must target the principal email');
  assert.ok(src.includes('isOwnerAdmin'), 'button must be gated on isOwnerAdmin');
  assert.ok(src.includes('isOwnerAdmin &&'), 'grant block must render only for the owner');
  assert.ok(src.includes('getIdToken(true)'), 'button must use a fresh ID token like the bootstrap modal');
});

// Runtime stage runs only when the static chain is clean.
if (failed === 0) {
  console.log('--- Runtime (CommonJS): mocked fetch + locally signed RS256 tokens, no network ---');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ldsdm-verify-grant-admin-'));
  try {
    check('tsc compiles the reachable chain to CommonJS', () => {
      execFileSync(
        'npx',
        ['tsc', ...graph.files, '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck', '--outDir', tmp],
        { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' }
      );
    });
    if (failed === 0) {
      check('handler answers 405/400/403/404/200 exactly as specified (mocked Firebase)', () => {
        const runner = path.join(tmp, 'runner.cjs');
        fs.writeFileSync(
          runner,
          `const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { generateKeyPairSync, createSign } = require('node:crypto');
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const KID = 'test-kid';
const PROJECT = 'ldsdmms';
const OWNER = 'mehedihasansagor26@gmail.com';
const PRINCIPAL = 'ldsdm.2003@gmail.com';
function b64u(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
function signJwt(payload) {
  const h = b64u({ alg: 'RS256', typ: 'JWT', kid: KID });
  const p = b64u(payload);
  const sig = createSign('RSA-SHA256').update(h + '.' + p).sign(privateKey, 'base64url');
  return h + '.' + p + '.' + sig;
}
function tokenFor(email, uid) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({ aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, exp: now + 3600, iat: now, auth_time: now - 10, sub: uid, email: email });
}
let capturedUpdate = null;
global.fetch = async (url, opts) => {
  const u = String(url);
  const ok = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
  if (u.indexOf('oauth2.googleapis.com/token') !== -1) return ok({ access_token: 'mock-access', expires_in: 3600 });
  if (u.indexOf('securetoken@system.gserviceaccount.com') !== -1) { const m = {}; m[KID] = publicKey; return ok(m); }
  if (u.indexOf('accounts:lookup') !== -1) {
    const body = JSON.parse(opts.body);
    if (body.email) {
      if (body.email[0] === PRINCIPAL) return ok({ users: [{ localId: 'target-uid-123', email: PRINCIPAL, validSince: '0' }] });
      return ok({ users: [] });
    }
    if (body.localId) return ok({ users: [{ localId: body.localId[0], email: 'caller@example.com', validSince: '0' }] });
    return ok({ users: [] });
  }
  if (u.indexOf('accounts:update') !== -1) { capturedUpdate = JSON.parse(opts.body); return ok({ localId: capturedUpdate.localId, email: PRINCIPAL }); }
  throw new Error('unexpected fetch: ' + u);
};
function mockRes() {
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (b) => { res.body = b || ''; };
  return res;
}
async function call(handler, method, bodyObj) {
  const req = new EventEmitter();
  req.method = method;
  const res = mockRes();
  const done = new Promise((resolve) => { const origEnd = res.end; res.end = (b) => { origEnd(b); resolve(); }; });
  await handler(req, res);
  if (bodyObj !== undefined) req.emit('data', JSON.stringify(bodyObj));
  req.emit('end');
  await done;
  return res;
}
(async () => {
  const handler = require('./api/admin/grant-admin.js').default;
  assert.strictEqual(typeof handler, 'function', 'grant-admin must default-export a handler');
  let r = await call(handler, 'GET');
  assert.strictEqual(r.statusCode, 405, 'GET must be 405, got ' + r.statusCode);
  r = await call(handler, 'POST', {});
  assert.strictEqual(r.statusCode, 400, 'POST without token must be 400, got ' + r.statusCode);
  assert.strictEqual(JSON.parse(r.body).code, 'ID_TOKEN_REQUIRED', 'POST without token must be ID_TOKEN_REQUIRED');
  r = await call(handler, 'POST', { idToken: 'x' });
  assert.strictEqual(r.statusCode, 400, 'POST without targetEmail must be 400, got ' + r.statusCode);
  assert.strictEqual(JSON.parse(r.body).code, 'TARGET_EMAIL_REQUIRED', 'POST without targetEmail must be TARGET_EMAIL_REQUIRED');
  r = await call(handler, 'POST', { idToken: 'x', targetEmail: 'not-an-email' });
  assert.strictEqual(r.statusCode, 400, 'POST with bad targetEmail must be 400, got ' + r.statusCode);
  assert.strictEqual(JSON.parse(r.body).code, 'TARGET_EMAIL_INVALID', 'POST with bad targetEmail must be TARGET_EMAIL_INVALID');
  r = await call(handler, 'POST', { idToken: 'x', targetEmail: 'a@b.c' });
  assert.strictEqual(r.statusCode, 400, 'POST without service account must be 400, got ' + r.statusCode);
  assert.strictEqual(JSON.parse(r.body).code, 'SERVICE_ACCOUNT_REQUIRED', 'POST without service account must be SERVICE_ACCOUNT_REQUIRED');
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'test@ldsdmms.iam.gserviceaccount.com', private_key: privateKey, project_id: PROJECT });
  const ownerToken = tokenFor(OWNER, 'owner-uid-1');
  const otherToken = tokenFor('someone@example.com', 'caller-uid-1');
  r = await call(handler, 'POST', { idToken: otherToken, targetEmail: PRINCIPAL });
  assert.strictEqual(r.statusCode, 403, 'non-owner caller must be 403, got ' + r.statusCode);
  assert.strictEqual(JSON.parse(r.body).code, 'UNAUTHORIZED_EMAIL', 'non-owner caller must be UNAUTHORIZED_EMAIL');
  r = await call(handler, 'POST', { idToken: ownerToken, targetEmail: 'ghost@example.com' });
  assert.strictEqual(r.statusCode, 404, 'unknown target must be 404, got ' + r.statusCode);
  assert.strictEqual(JSON.parse(r.body).code, 'TARGET_NOT_FOUND', 'unknown target must be TARGET_NOT_FOUND');
  r = await call(handler, 'POST', { idToken: ownerToken, targetEmail: OWNER });
  assert.strictEqual(r.statusCode, 403, 'owner as target must be 403, got ' + r.statusCode);
  assert.strictEqual(JSON.parse(r.body).code, 'TARGET_PROTECTED', 'owner as target must be TARGET_PROTECTED');
  capturedUpdate = null;
  r = await call(handler, 'POST', { idToken: ownerToken, targetEmail: PRINCIPAL });
  assert.strictEqual(r.statusCode, 200, 'grant to the principal must be 200, got ' + r.statusCode + ' ' + r.body);
  const okBody = JSON.parse(r.body);
  assert.strictEqual(okBody.success, true, 'success body must have success true');
  assert.strictEqual(okBody.uid, 'target-uid-123', 'success body must carry the target uid');
  assert.strictEqual(okBody.email, PRINCIPAL, 'success body must carry the target email');
  assert.strictEqual(okBody.role, 'admin', 'success body must carry role admin');
  assert.ok(capturedUpdate, 'accounts:update must have been called');
  assert.strictEqual(capturedUpdate.localId, 'target-uid-123', 'update must target the principal uid');
  assert.strictEqual(capturedUpdate.customAttributes, '{"role":"admin"}', 'update must set exactly {"role":"admin"}');
  assert.ok(!JSON.parse(capturedUpdate.customAttributes).isSuperAdmin, 'update must never set isSuperAdmin');
  console.log('grant-admin handler answered 405/400/403/404/200 exactly as specified (mocked Firebase)');
})().catch((e) => { console.error(e); process.exit(1); });
`
        );
        execFileSync('node', [runner], { cwd: tmp, stdio: 'pipe', encoding: 'utf8' });
      });
    }
    // ESM stage: same chain must load as ESM (the shape Vercel produces
    // for a "type": "module" package) and answer 405/400 the same way.
    if (failed === 0) {
      console.log('--- Runtime (ESM): chain compiles to ESM and loads under plain node ---');
      const tmpEsm = fs.mkdtempSync(path.join(os.tmpdir(), 'ldsdm-verify-grant-admin-esm-'));
      try {
        check('tsc compiles the reachable chain to ESM', () => {
          execFileSync(
            'npx',
            ['tsc', ...graph.files, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--esModuleInterop', '--skipLibCheck', '--outDir', tmpEsm],
            { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' }
          );
        });
        if (failed === 0) {
          check('compiled handler loads as ESM and answers GET with 405, POST without idToken with 400', () => {
            const runner = path.join(tmpEsm, 'runner.mjs');
            fs.writeFileSync(
              runner,
              `import assert from 'node:assert';\nimport { EventEmitter } from 'node:events';\nfunction mockRes() {\n  const res = { statusCode: 0, headers: {}, body: '' };\n  res.setHeader = (k, v) => { res.headers[k] = v; };\n  res.end = (b) => { res.body = b || ''; };\n  return res;\n}\nasync function call(handler, method, emitEnd) {\n  const req = new EventEmitter();\n  req.method = method;\n  const res = mockRes();\n  const done = new Promise((resolve) => { const origEnd = res.end; res.end = (b) => { origEnd(b); resolve(); }; });\n  await handler(req, res);\n  if (emitEnd) req.emit('end');\n  await done;\n  return res;\n}\nconst handler = (await import('./api/admin/grant-admin.js')).default;\nassert.strictEqual(typeof handler, 'function', 'grant-admin must default-export a handler');\nconst get = await call(handler, 'GET', false);\nassert.strictEqual(get.statusCode, 405, 'GET must be 405, got ' + get.statusCode);\nconst post = await call(handler, 'POST', true);\nassert.strictEqual(post.statusCode, 400, 'POST without idToken must be 400, got ' + post.statusCode);\nassert.ok(JSON.parse(post.body).code === 'ID_TOKEN_REQUIRED', 'POST body must be ID_TOKEN_REQUIRED');\nconsole.log('grant-admin handler loaded as ESM and answered 405/400 as specified');\n`
            );
            execFileSync('node', [runner], { cwd: tmpEsm, stdio: 'pipe', encoding: 'utf8' });
          });
        }
      } finally {
        fs.rmSync(tmpEsm, { recursive: true, force: true });
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
} else {
  console.log('--- Runtime stage skipped: static chain is not clean ---');
}

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: grant-admin self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
