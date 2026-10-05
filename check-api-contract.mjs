import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const appPath = path.join(root, 'frontend', 'src', 'App.jsx');
const serverPath = path.join(root, 'backend', 'server.js');

const app = fs.readFileSync(appPath, 'utf8');
const server = fs.readFileSync(serverPath, 'utf8');

const calls = new Set();
for (const m of app.matchAll(/api\(\s*['"]([^'"]+)['"]/g)) calls.add(m[1]);
for (const m of app.matchAll(/api\(\s*`([^`]+)`/g)) calls.add(m[1]);

// CEOControlCenter keeps its GET endpoints in a paths object and calls api(paths[t]).
// Extract those values explicitly so the contract test cannot silently miss them.
const pathsObject = app.match(/const\s+paths\s*=\s*\{([\s\S]*?)\}\s*;?\s*const\s+r\s*=\s*await\s+api\(paths\[t\]\)/);
if (pathsObject) {
  for (const m of pathsObject[1].matchAll(/:\s*['"]([^'"]+)['"]/g)) calls.add(m[1]);
}

// Also capture API-like route strings used by dynamic calls, while ignoring normal React routes.
for (const m of app.matchAll(/['"](\/(?:ceo|payments|referrals\/me|student|partner|admin|instructor)(?:\/[^'"]*)?)['"]/g)) {
  if (m[1] !== '/ceo') calls.add(m[1]);
}

const routes = new Set();
const routeMethods = new Map();
for (const m of server.matchAll(/app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
  const method = m[1].toUpperCase();
  const route = m[2];
  routes.add(route);
  if (!routeMethods.has(route)) routeMethods.set(route, new Set());
  routeMethods.get(route).add(method);
}

const normalize = p => p.replace(/\$\{[^}]+\}/g, ':id');
const routeMatches = (call, route) => {
  const a = ('/api' + normalize(call)).split('/').filter(Boolean);
  const b = route.split('/').filter(Boolean);
  return a.length === b.length && a.every((part, i) => b[i].startsWith(':') || b[i] === part);
};

const missing = [...calls].filter(p => ![...routes].some(r => routeMatches(p, r)));
const notImplemented = server.split('\n').filter(x => /501\s+Not Implemented|status\(501\)/i.test(x));
const duplicateRoutes = [];
const duplicateMethodRoutes = [...routes].filter(route => { const methods = [...routeMethods.get(route)]; return methods.some((method, i) => methods.indexOf(method) !== i); });
const exposedSecret = app.split('\n').filter(x => /(SUPABASE_SERVICE_ROLE_KEY|RAZORPAY_KEY_SECRET|JWT_SECRET|DATABASE_URL)\s*[:=]/i.test(x));

console.log(`Frontend API call patterns: ${calls.size}`);
console.log(`Backend routes: ${routes.size}`);

if (missing.length) {
  console.error('MISSING API ROUTES:', missing);
  process.exit(1);
}
if (notImplemented.length) {
  console.error('501 ROUTES REMAIN:', notImplemented);
  process.exit(1);
}
if (duplicateMethodRoutes.length) {
  console.error('DUPLICATE ROUTE + METHOD DEFINITIONS:', duplicateMethodRoutes);
  process.exit(1);
}
if (exposedSecret.length) {
  console.error('POSSIBLE FRONTEND SECRET EXPOSURE:', exposedSecret);
  process.exit(1);
}

console.log('API contract check: PASS');
