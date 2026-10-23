export function validateConfig(
  env: Record<string, string | undefined> = process.env,
) {
  for (const key of [
    "DATABASE_URL",
    "APP_BASE_URL",
    "AUTH_SECRET",
    "TRACKING_ENCRYPTION_KEY",
    "TRACKING_HMAC_KEY",
  ])
    if (!env[key]) throw new Error(`${key} is required. See .env.example.`);
  if (
    env.AUTH_SECRET!.length < 32 ||
    env.TRACKING_HMAC_KEY!.length < 32 ||
    !/^[a-f0-9]{64}$/i.test(env.TRACKING_ENCRYPTION_KEY!)
  )
    throw new Error(
      "Server secrets are invalid. Generate them with npm run env:local.",
    );
  if (env.MONEY_DECIMAL_PLACES && env.MONEY_DECIMAL_PLACES !== "2")
    throw new Error(
      "This schema supports two decimal places. A different scale requires an explicit migration.",
    );
  const url = new URL(env.APP_BASE_URL!);
  const local =
    env.LOCAL_PRODUCTION_TEST === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (env.LOCAL_PRODUCTION_TEST === "true" && !local)
    throw new Error(
      "Local production testing is restricted to loopback origins.",
    );
  if (env.NODE_ENV === "production" && !local) {
    if (url.protocol !== "https:")
      throw new Error("Production requires an HTTPS app origin.");
    if (
      env.STORAGE_ADAPTER === "filesystem" ||
      env.SEED_PASSWORD ||
      env.DATABASE_URL!.includes("parcel_dev") ||
      env.S3_ACCESS_KEY_ID === "parcel_local"
    )
      throw new Error(
        "Development credentials, seed settings and local storage are forbidden in production.",
      );
    if (env.SMS_ENABLED === "true")
      throw new Error(
        "No real SMS provider is approved or implemented. Disable SMS before production.",
      );
  }
  if (env.STORAGE_ADAPTER === "vercel-blob") {
    if (!env.BLOB_READ_WRITE_TOKEN)
      throw new Error("BLOB_READ_WRITE_TOKEN is required for private Vercel Blob storage.");
  } else if (env.STORAGE_ADAPTER !== "filesystem")
    for (const key of [
      "S3_BUCKET",
      "S3_REGION",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ])
      if (!env[key]) throw new Error(`${key} is required for S3 storage.`);
}
