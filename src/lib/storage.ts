import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
let client: S3Client | undefined;
export function getStorageClient() {
  if (client) return client;
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new Error("Private S3 storage configuration is incomplete.");
  client = new S3Client({ endpoint: S3_ENDPOINT, region: S3_REGION, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true", credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY } });
  return client;
}
// Upload/authorization/signed URL workflows intentionally remain unimplemented.
