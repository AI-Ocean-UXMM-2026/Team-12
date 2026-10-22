import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
export function token() {
  return randomBytes(24).toString("base64url");
}
function key() {
  const value = process.env.TRACKING_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      "TRACKING_ENCRYPTION_KEY must contain 32 random bytes in hex.",
    );
  return Buffer.from(value, "hex");
}
export function digest(value: string) {
  const secret = process.env.TRACKING_HMAC_KEY;
  if (!secret || secret.length < 32)
    throw new Error("TRACKING_HMAC_KEY is required (at least 32 characters).");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function seal(value: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    trackingCodeCiphertext: ciphertext.toString("base64"),
    trackingCodeNonce: nonce.toString("base64"),
  };
}
export function unseal(value: {
  trackingCodeCiphertext: string;
  trackingCodeNonce: string;
}) {
  const bytes = Buffer.from(value.trackingCodeCiphertext, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(value.trackingCodeNonce, "base64"),
  );
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([
    decipher.update(bytes.subarray(0, -16)),
    decipher.final(),
  ]).toString("utf8");
}
