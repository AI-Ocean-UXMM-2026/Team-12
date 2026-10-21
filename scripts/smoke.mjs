import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
const port = 3107;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
try {
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 75; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try { const r = await fetch(`${base}/api/health`); if (r.ok) { ready = true; break; } } catch { /* Startup can take a moment. */ }
    await delay(200);
  }
  assert(ready, `Server startup timed out: ${output}`);
  for (const [route, text] of [['/', 'A foundation for every delivery'], ['/admin/riders', 'Rider management'], ['/admin/parcels', 'Parcel management'], ['/admin/assignments', 'Delivery assignments'], ['/rider/assignments', 'My daily deliveries'], ['/rider/notifications', 'Notifications'], ['/track', 'Track your parcel'], ['/login', 'Authentication setup pending']]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert((await response.text()).includes(text), route);
    console.log('PASS', route);
  }
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).check, 'liveness');
  console.log('PASS liveness/no-store');
} finally {
  server.kill('SIGTERM');
}
