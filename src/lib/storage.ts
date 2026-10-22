import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile, unlink, access } from "node:fs/promises";
import path from "node:path";
let client: S3Client | undefined;
export function getStorageClient() {
  if (client) return client;
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } =
    process.env;
  if (!S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY)
    throw new Error("Private S3 storage configuration is incomplete.");
  client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
  return client;
}
export interface PrivateObjectStore {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
  ready(): Promise<void>;
}
function localPath(key: string) {
  if (!/^proof\/[a-f0-9-]{36}\.jpg$/.test(key))
    throw new Error("Invalid object key.");
  // This is runtime data, deliberately excluded from the deployment bundle.
  const root = path.resolve(/*turbopackIgnore: true*/
    process.env.PRIVATE_STORAGE_PATH ?? ".local/private-objects",
  );
  // Local storage must never be placed below a publicly served application directory.
  const normalize=(value:string)=>process.platform==="win32"?value.toLowerCase():value;
  const publicRoot = normalize(path.resolve("public"));
  if (normalize(root) === publicRoot || normalize(root).startsWith(publicRoot + path.sep))
    throw new Error("Private storage cannot be inside public.");
  const result = path.resolve(root, key);
  if (!result.startsWith(root + path.sep))
    throw new Error("Invalid storage path.");
  return result;
}
export function getPrivateStore(): PrivateObjectStore {
  if (process.env.STORAGE_ADAPTER === "filesystem") {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.LOCAL_PRODUCTION_TEST !== "true"
    )
      throw new Error("Filesystem proof storage is development-only.");
    return {
      async put(key, bytes) {
        const file = localPath(key);
        await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
      },
      async get(key) {
        return readFile(/*turbopackIgnore: true*/ localPath(key));
      },
      async remove(key) {
        await unlink(localPath(key)).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      },
      async ready() {
        const probe = localPath(
          "proof/00000000-0000-4000-8000-000000000000.jpg",
        );
        await mkdir(path.dirname(probe), { recursive: true, mode: 0o700 });
        await access(path.dirname(probe));
      },
    };
  }
  if (process.env.STORAGE_ADAPTER && process.env.STORAGE_ADAPTER !== "s3")
    throw new Error("Unknown private storage adapter.");
  const client = getStorageClient(),
    Bucket = process.env.S3_BUCKET;
  if (!Bucket) throw new Error("S3_BUCKET is required.");
  return {
    async put(Key, Body) {
      await client.send(
        new PutObjectCommand({ Bucket, Key, Body, ContentType: "image/jpeg" }),
      );
    },
    async get(Key) {
      const object = await client.send(new GetObjectCommand({ Bucket, Key }));
      if (!object.Body) throw new Error("Object unavailable.");
      return object.Body.transformToByteArray();
    },
    async remove(Key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
    },
    async ready() {
      await client.send(new HeadBucketCommand({ Bucket }));
    },
  };
}
