/**
 * /api/admin 500 — self-check (12 Nov 2026, base commit fba1bb8).
 *
 * Bug: GET /api/admin/bootstrap-owner and /api/admin/sync-staff-password
 * return 500 FUNCTION_INVOCATION_FAILED live. A GET 500 means the function
 * fails at load time, so POST fails too. Root cause, read from the code at
 * fba1bb8 (not assumed): the handler import chain reaches
 * services/appConfig.ts, which evaluates `import.meta.env` at module load,
 * and Vercel compiles these functions to CommonJS, where `import.meta`
 * is a SyntaxError at load. The chain also uses `.ts` extension imports,
 * which a CommonJS require cannot resolve.
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-api-admin-500.ts
 * (or npm run test:api-admin-500).
 *
 * Covers:
 *  - Static: walking the import graph from both api/admin handlers, no
 *    file in the graph contains `import.meta` (code, not comments), no
 *    import in the graph uses a `.ts` extension, every relative import
 *    in the graph uses an explicit `.js` extension (the ESM-safe
 *    invariant — see the follow-up note below), and the graph never
 *    reaches services/appConfig.ts (the import.meta source).
 *  - Server config: server/serverConfig.ts exports SUPER_ADMIN_EMAIL
 *    from process.env only (no import.meta), with the same historical
 *    fallback address, and both handlers' modules import it from there.
 *  - Behaviour preserved (source): 405 on wrong method, 400 without
 *    idToken / service account, 403 without permission — unchanged.
 *  - Runtime: the whole chain compiles to CommonJS with tsc and loads
 *    under plain node, and both handlers answer a GET with 405 and a
 *    POST with no idToken with 400 (no network, no Firebase needed).
 *  - Runtime (ESM): the same chain compiles to ESM with tsc and loads
 *    under plain node as ESM, answering 405/400 the same way.
 *
 * FOLLOW-UP (13 Nov 2026): Fix #1 removed import.meta from the chain,
 * but live still returned 500 FUNCTION_INVOCATION_FAILED on every
 * method, including GET. Reproduced locally: compiling the chain to
 * ESM with tsc (the shape Vercel produces for a "type": "module"
 * package) and loading it under plain node fails with
 * ERR_MODULE_NOT_FOUND — Node's ESM loader cannot resolve extensionless
 * relative imports ('./serverConfig', '../../server/adminApi'). The
 * CommonJS test passed because require() resolves extensionless
 * imports, so it could not see this. The fix is explicit `.js`
 * extensions on every relative import in the chain (the standard
 * ESM-compatible convention; TypeScript, esbuild and tsc --module
 * commonjs all resolve './x.js' to x.ts / the compiled x.js).
 *
 * Live 500 cannot be verified locally — that needs a Vercel deploy plus
 * Function Logs after push.
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

const ENTRIES = ['api/admin/bootstrap-owner.ts', 'api/admin/sync-staff-password.ts'];

/** Strip line + block comments so doc mentions of import.meta don't count. */
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
  // ESM-style '.js' specifier refers to the .ts source (tsc/esbuild resolve it).
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

const graph = walkImportGraph(ENTRIES);

console.log('--- Import graph reachable from the two handlers ---');
console.log(`  ${graph.files.join('\n  ')}`);

check('both api/admin handlers are the graph entries', () => {
  assert.ok(graph.files.includes('api/admin/bootstrap-owner.ts'));
  assert.ok(graph.files.includes('api/admin/sync-staff-password.ts'));
});

check('no import.meta anywhere in the reachable chain (code, not comments)', () => {
  const bad = graph.files.filter((f) => stripComments(readSource(f)).includes('import.meta'));
  assert.deepStrictEqual(bad, [], `files using import.meta: ${bad.join(', ')}`);
});

check('no .ts extension imports anywhere in the reachable chain', () => {
  const bad = graph.imports.filter((i) => i.spec.endsWith('.ts'));
  assert.deepStrictEqual(
    bad,
    [],
    bad.map((i) => `${i.file} -> ${i.spec}`).join(', ')
  );
});

check('every relative import in the reachable chain uses an explicit .js extension (ESM-safe)', () => {
  const bad = graph.imports.filter((i) => i.spec.startsWith('.') && !i.spec.endsWith('.js'));
  assert.deepStrictEqual(
    bad,
    [],
    bad.map((i) => `${i.file} -> ${i.spec}`).join(', ')
  );
});

check('chain never reaches services/appConfig.ts (the import.meta source)', () => {
  assert.ok(!graph.files.includes('services/appConfig.ts'), 'services/appConfig.ts must not be reachable from the handlers');
});

console.log('--- Server-only config ---');

check('server/serverConfig.ts exports SUPER_ADMIN_EMAIL from process.env, no import.meta', () => {
  const src = readSource('server/serverConfig.ts');
  assert.ok(src.includes('SUPER_ADMIN_EMAIL'), 'must export SUPER_ADMIN_EMAIL');
  assert.ok(src.includes('process.env'), 'must read process.env (server runtime env, not Vite build-time env)');
  assert.ok(!stripComments(src).includes('import.meta'), 'must not use import.meta');
  assert.ok(src.includes('mehedihasansagor26@gmail.com'), 'must keep the historical fallback address');
});

check('both handler modules import the owner email from ./serverConfig.js', () => {
  for (const f of ['server/adminApi.ts', 'server/staffPasswordApi.ts']) {
    const src = readSource(f);
    assert.ok(
      src.includes("from './serverConfig.js'"),
      `${f} must import SUPER_ADMIN_EMAIL from ./serverConfig.js`
    );
    assert.ok(!src.includes('services/appConfig'), `${f} must not import services/appConfig`);
  }
});

console.log('--- Handler behaviour preserved (source) ---');

check('bootstrap-owner still returns 405 / 400 / 403 as before', () => {
  const src = readSource('server/adminApi.ts');
  assert.ok(src.includes("req.method !== 'POST'"), 'method guard must stay');
  assert.ok(src.includes('405'), '405 must stay');
  assert.ok(src.includes('ID_TOKEN_REQUIRED'), '400 without idToken must stay');
  assert.ok(src.includes('SERVICE_ACCOUNT_REQUIRED'), '400 without service account must stay');
  assert.ok(src.includes('UNAUTHORIZED_EMAIL'), '403 without permission must stay');
});

check('sync-staff-password still returns 405 / 400 / 403 as before', () => {
  const src = readSource('server/staffPasswordApi.ts');
  assert.ok(src.includes("req.method !== 'POST'"), 'method guard must stay');
  assert.ok(src.includes('405'), '405 must stay');
  assert.ok(src.includes('ID_TOKEN_REQUIRED'), '400 without idToken must stay');
  assert.ok(src.includes('SERVICE_ACCOUNT_REQUIRED'), '400 without service account must stay');
  assert.ok(src.includes('UNAUTHORIZED_CALLER'), '403 without permission must stay');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:api-admin-500'], 'tsx scripts/verify-api-admin-500.ts', 'npm run test:api-admin-500 must run this script');
});

// Runtime stage runs only when the static chain is clean: before the fix
// it would fail at the same root cause (tsc rejects import.meta / .ts
// imports under CommonJS), so there is nothing extra to learn from it.
if (failed === 0) {
  console.log('--- Runtime: chain compiles to CommonJS and loads under plain node ---');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ldsdm-verify-api-admin-500-'));
  try {
    check('tsc compiles the reachable chain to CommonJS', () => {
      execFileSync(
        'npx',
        ['tsc', ...graph.files, '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck', '--outDir', tmp],
        { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' }
      );
    });
    if (failed === 0) {
      check('both compiled handlers load under plain node and answer GET with 405, POST without idToken with 400', () => {
        const runner = path.join(tmp, 'runner.cjs');
        fs.writeFileSync(
          runner,
          `const assert = require('node:assert');
const { EventEmitter } = require('node:events');
function mockRes() {
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (b) => { res.body = b || ''; };
  return res;
}
async function call(handler, method, emitEnd) {
  const req = new EventEmitter();
  req.method = method;
  const res = mockRes();
  const done = new Promise((resolve) => { const origEnd = res.end; res.end = (b) => { origEnd(b); resolve(); }; });
  await handler(req, res);
  if (emitEnd) req.emit('end');
  await done;
  return res;
}
(async () => {
  for (const rel of ['api/admin/bootstrap-owner.js', 'api/admin/sync-staff-password.js']) {
    const handler = require('./' + rel).default;
    assert.strictEqual(typeof handler, 'function', rel + ' must default-export a handler');
    const get = await call(handler, 'GET', false);
    assert.strictEqual(get.statusCode, 405, rel + ' GET must be 405, got ' + get.statusCode);
    const post = await call(handler, 'POST', true);
    assert.strictEqual(post.statusCode, 400, rel + ' POST without idToken must be 400, got ' + post.statusCode);
    assert.ok(JSON.parse(post.body).code === 'ID_TOKEN_REQUIRED', rel + ' POST body must be ID_TOKEN_REQUIRED');
  }
  console.log('both handlers loaded under CommonJS and answered 405/400 as specified');
})().catch((e) => { console.error(e); process.exit(1); });
`
        );
        execFileSync('node', [runner], { cwd: tmp, stdio: 'pipe', encoding: 'utf8' });
      });
    }
    // ESM stage: the follow-up bug. tsc --module commonjs hides it
    // (require() resolves extensionless imports), but a tsc --module
    // esnext build — the shape Vercel produces for a "type": "module"
    // package — fails at load with ERR_MODULE_NOT_FOUND on extensionless
    // relative imports. This stage must stay green alongside the CJS one.
    if (failed === 0) {
      console.log('--- Runtime (ESM): chain compiles to ESM and loads under plain node ---');
      const tmpEsm = fs.mkdtempSync(path.join(os.tmpdir(), 'ldsdm-verify-api-admin-500-esm-'));
      try {
        check('tsc compiles the reachable chain to ESM', () => {
          execFileSync(
            'npx',
            ['tsc', ...graph.files, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--esModuleInterop', '--skipLibCheck', '--outDir', tmpEsm],
            { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' }
          );
        });
        if (failed === 0) {
          check('both compiled handlers load as ESM under plain node and answer GET with 405, POST without idToken with 400', () => {
            const runner = path.join(tmpEsm, 'runner.mjs');
            fs.writeFileSync(
              runner,
              `import assert from 'node:assert';\nimport { EventEmitter } from 'node:events';\nfunction mockRes() {\n  const res = { statusCode: 0, headers: {}, body: '' };\n  res.setHeader = (k, v) => { res.headers[k] = v; };\n  res.end = (b) => { res.body = b || ''; };\n  return res;\n}\nasync function call(handler, method, emitEnd) {\n  const req = new EventEmitter();\n  req.method = method;\n  const res = mockRes();\n  const done = new Promise((resolve) => { const origEnd = res.end; res.end = (b) => { origEnd(b); resolve(); }; });\n  await handler(req, res);\n  if (emitEnd) req.emit('end');\n  await done;\n  return res;\n}\nfor (const rel of ['api/admin/bootstrap-owner.js', 'api/admin/sync-staff-password.js']) {\n  const handler = (await import('./' + rel)).default;\n  assert.strictEqual(typeof handler, 'function', rel + ' must default-export a handler');\n  const get = await call(handler, 'GET', false);\n  assert.strictEqual(get.statusCode, 405, rel + ' GET must be 405, got ' + get.statusCode);\n  const post = await call(handler, 'POST', true);\n  assert.strictEqual(post.statusCode, 400, rel + ' POST without idToken must be 400, got ' + post.statusCode);\n  assert.ok(JSON.parse(post.body).code === 'ID_TOKEN_REQUIRED', rel + ' POST body must be ID_TOKEN_REQUIRED');\n}\nconsole.log('both handlers loaded as ESM and answered 405/400 as specified');\n`
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
  console.error('FAIL: /api/admin 500 self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
