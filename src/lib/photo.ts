import sharp from "sharp";
import { createHash } from "node:crypto";
import { invariant } from "@/server/errors";
export async function sanitizePhoto(bytes: Buffer) {
  invariant(
    bytes.length > 0 && bytes.length <= 10485760,
    413,
    "Photo must be at most 10 MiB.",
  );
  let image: Buffer;
  try {
    const metadata = await sharp(bytes, {
      limitInputPixels: 40000000,
      failOn: "warning",
    }).metadata();
    invariant(
      metadata.format === "jpeg" || metadata.format === "png",
      422,
      "Choose a valid JPEG or PNG image.",
    );
    invariant(
      !metadata.pages || metadata.pages === 1,
      422,
      "Animated images are not supported.",
    );
    image = await sharp(bytes, {
      limitInputPixels: 40000000,
      failOn: "warning",
    })
      .rotate()
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    invariant(false, 422, "Photo is corrupt or exceeds the pixel limit.");
  }
  invariant(image.length <= 10485760, 413, "Processed photo exceeds 10 MiB.");
  return {
    bytes: image,
    checksum: createHash("sha256").update(image).digest("hex"),
  };
}
