import "dotenv/config";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
const base = "http://127.0.0.1:3107";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3107",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, APP_BASE_URL: base, LOCAL_PRODUCTION_TEST: "true" },
  },
);
let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk;
});
server.stderr.on("data", (chunk) => {
  output += chunk;
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  assert(ready, `Startup timed out: ${output}`);
  for (const [route, text] of [
    ["/", "Track your parcel"],
    ["/track", "Track your parcel"],
    ["/login", "Staff sign in"],
  ]) {
    const r = await fetch(base + route);
    assert.equal(r.status, 200);
    assert((await r.text()).includes(text));
    console.info("PASS", route);
  }
  for (const route of [
    "/admin/riders",
    "/admin/parcels",
    "/admin/assignments",
    "/rider/assignments",
    "/rider/notifications",
  ]) {
    const r = await fetch(base + route, { redirect: "manual" });
    assert.equal(r.status, 307);
    assert.equal(r.headers.get("location"), "/login");
    console.info("PASS protected redirect", route);
  }
  assert.equal((await fetch(base + "/api/v1/admin/parcels")).status, 401);
  const health = await fetch(base + "/api/health");
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal((await health.json()).check, "liveness");
  assert.equal((await fetch(base + "/api/ready")).status, 200);
  console.info("PASS production liveness, readiness and API denial");
} finally {
  server.kill("SIGTERM");
}
