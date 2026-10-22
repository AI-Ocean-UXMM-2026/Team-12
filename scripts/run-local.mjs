import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const task = process.argv[2] ?? "dev";
const runtime = path.resolve(".local/runtime/node_modules/node/bin/node.exe");
const npm = path.join(
  path.dirname(process.execPath),
  "node_modules/npm/bin/npm-cli.js",
);
if (process.platform !== "win32" || !existsSync(runtime) || !existsSync(npm))
  throw new Error(
    "This helper is for the project-local Windows runtime. Otherwise activate Node 24 and use npm run directly.",
  );
const result = spawnSync(
  runtime,
  [npm, "run", task, ...process.argv.slice(3)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: path.dirname(runtime) + path.delimiter + process.env.PATH,
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
