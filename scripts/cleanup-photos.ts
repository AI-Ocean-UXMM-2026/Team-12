import "dotenv/config";
import { cleanupPhotos } from "../src/server/services/photos";
import { getDb } from "../src/lib/db";
try {
  console.info(
    `Removed ${await cleanupPhotos()} unattached staged photos older than 24 hours.`,
  );
} finally {
  await getDb().$disconnect();
}
