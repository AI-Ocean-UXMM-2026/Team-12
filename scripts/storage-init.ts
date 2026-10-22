import "dotenv/config";
import {
  CreateBucketCommand,
  DeleteBucketPolicyCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdir } from "node:fs/promises";
if (process.env.STORAGE_ADAPTER === "filesystem") {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Filesystem storage init is development-only.");
  await mkdir(process.env.PRIVATE_STORAGE_PATH ?? ".local/private-objects", {
    recursive: true,
    mode: 0o700,
  });
  console.info(
    "Local private filesystem object store initialized; this is not MinIO.",
  );
} else {
  const storage = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  const Bucket = process.env.S3_BUCKET;
  if (!Bucket) throw new Error("S3_BUCKET is required.");
  try {
    await storage.send(new HeadBucketCommand({ Bucket }));
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode !== 404
    )
      throw error;
    await storage.send(new CreateBucketCommand({ Bucket }));
  }
  await storage.send(new DeleteBucketPolicyCommand({ Bucket }));
  console.info(
    "Private bucket is available. Anonymous access has no bucket policy.",
  );
}
