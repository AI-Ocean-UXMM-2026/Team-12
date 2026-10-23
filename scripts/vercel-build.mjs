import { spawnSync } from "node:child_process";
process.env.NODE_ENV = "production";

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(["node_modules/prisma/build/index.js", "generate"]);
run(["--import", "tsx", "--input-type=module", "-e",
  "const {validateConfig}=await import('./src/lib/config.ts'); validateConfig();"]);
// Preview builds must use their own database. No seed/reset runs at deployment.
run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
if (process.env.VERCEL_ENV === "production")
  run(["--import", "tsx", "scripts/ensure-production-admin.ts"]);
run(["node_modules/next/dist/bin/next", "build"]);
