import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env"))
  throw new Error(".env already exists; refusing to overwrite secrets.");
let config = readFileSync(".env.example", "utf8");
for (const name of [
  "AUTH_SECRET",
  "TRACKING_ENCRYPTION_KEY",
  "TRACKING_HMAC_KEY",
])
  config = config.replace(
    new RegExp(`^${name}=.*$`, "m"),
    `${name}=${randomBytes(32).toString("hex")}`,
  );
config = config.replace(
  /^SEED_PASSWORD=.*$/m,
  `SEED_PASSWORD=${randomBytes(24).toString("base64url")}`,
);
writeFileSync(".env", config, { mode: 0o600 });
console.info(
  "Created local .env with random server secrets. Review database and storage settings.",
);
