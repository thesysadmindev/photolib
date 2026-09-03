import crypto from "node:crypto";

// Must match services/watermark-svc/wm/constants.py (TOKEN_LENGTH_CHARS / TOKEN_ALPHABET)
// exactly - this length/alphabet was determined empirically as the largest payload
// TrustMark can reliably round-trip through real-world recompression/resizing.
const TOKEN_LENGTH = 8;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateWatermarkToken(): string {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return token;
}
