import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { digest, seal, unseal, token } from "@/lib/crypto";
import { sanitizePhoto } from "@/lib/photo";
import { parcelSchema, assignmentSchema } from "@/lib/validation/workflows";
import { validateConfig } from "@/lib/config";
beforeEach(() => {
  vi.stubEnv("TRACKING_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("TRACKING_HMAC_KEY", "b".repeat(64));
});
afterEach(() => vi.unstubAllEnvs());
describe("tracking capability protection", () => {
  it("uses independent random tokens and authenticated encryption", () => {
    const a = token(),
      b = token();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(32);
    const encrypted = seal(a);
    expect(unseal(encrypted)).toBe(a);
    expect(encrypted.trackingCodeCiphertext).not.toContain(a);
    expect(digest(a)).not.toBe(digest(b));
  });
  it("rejects modified ciphertext and wrong keys", () => {
    const encrypted = seal(token());
    const bytes = Buffer.from(encrypted.trackingCodeCiphertext, "base64");
    bytes[0] ^= 1;
    expect(() =>
      unseal({
        ...encrypted,
        trackingCodeCiphertext: bytes.toString("base64"),
      }),
    ).toThrow();
    vi.stubEnv("TRACKING_ENCRYPTION_KEY", "c".repeat(64));
    expect(() => unseal(encrypted)).toThrow();
  });
});
describe("safe image decoding", () => {
  it.each(["png", "jpeg"] as const)(
    "decodes %s and strips metadata",
    async (format) => {
      const original = await sharp({
        create: { width: 32, height: 32, channels: 3, background: "red" },
      })
        .withMetadata()
        .toFormat(format)
        .toBuffer();
      const result = await sanitizePhoto(original);
      const decoded = await sharp(result.bytes).metadata();
      expect(decoded.format).toBe("jpeg");
      expect(decoded.exif).toBeUndefined();
      expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    },
  );
  it("rejects corrupt, empty and oversized images", async () => {
    await expect(sanitizePhoto(Buffer.from("not a PNG"))).rejects.toMatchObject(
      { status: 422 },
    );
    await expect(sanitizePhoto(Buffer.alloc(0))).rejects.toMatchObject({
      status: 413,
    });
    await expect(sanitizePhoto(Buffer.alloc(10485761))).rejects.toMatchObject({
      status: 413,
    });
  });
  it("rejects other decodable formats", async () => {
    const webp = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .webp()
      .toBuffer();
    await expect(sanitizePhoto(webp)).rejects.toMatchObject({ status: 422 });
  });
});
describe("operational validation", () => {
  const parcel = {
    senderName: "Sender",
    receivedDate: "2026-10-22",
    receivedPerson: "Operator",
    customerName: "Recipient",
    customerContactNumber: "0991234567",
    township: "Township",
    address: "Address",
    paymentType: "COD",
    orderAmount: "1.00",
    deliveryFee: "0.00",
  };
  it.each(["0", "-1", "1e3", "NaN", "1.001"])(
    "rejects invalid COD amount %s",
    (orderAmount) =>
      expect(parcelSchema.safeParse({ ...parcel, orderAmount }).success).toBe(
        false,
      ),
  );
  it("keeps decimals as strings and permits optional prepaid amount", () => {
    expect(parcelSchema.parse(parcel).orderAmount).toBe("1.00");
    expect(
      parcelSchema.safeParse({
        ...parcel,
        paymentType: "PREPAID",
        orderAmount: null,
      }).success,
    ).toBe(true);
  });
  it("rejects timestamps, extra fields and backwards schedules", () => {
    expect(
      parcelSchema.safeParse({
        ...parcel,
        receivedDate: "2026-10-22T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      parcelSchema.safeParse({ ...parcel, createdByAdminId: "forged" }).success,
    ).toBe(false);
    expect(
      assignmentSchema.safeParse({
        parcelId: crypto.randomUUID(),
        riderId: crypto.randomUUID(),
        assignDate: "2026-10-22",
        deliveryDate: "2026-10-21",
        version: 0,
        mode: "assign",
      }).success,
    ).toBe(false);
  });
  it("refuses local production adapters without a loopback test opt-in", () => {
    const env = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://unit.invalid/db",
      APP_BASE_URL: "https://example.test",
      AUTH_SECRET: "a".repeat(64),
      TRACKING_ENCRYPTION_KEY: "b".repeat(64),
      TRACKING_HMAC_KEY: "c".repeat(64),
      STORAGE_ADAPTER: "filesystem",
    };
    expect(() => validateConfig(env)).toThrow();
    expect(() =>
      validateConfig({ ...env, LOCAL_PRODUCTION_TEST: "true" }),
    ).toThrow();
    expect(() =>
      validateConfig({
        ...env,
        APP_BASE_URL: "http://localhost:3000",
        LOCAL_PRODUCTION_TEST: "true",
      }),
    ).not.toThrow();
  });
});
