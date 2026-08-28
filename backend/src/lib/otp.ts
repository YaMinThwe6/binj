import { createHash, randomInt } from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes, schema.md authCodes.expiresAt
export const MAX_ATTEMPTS = 5; // blunts brute-forcing the 6-digit space

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
