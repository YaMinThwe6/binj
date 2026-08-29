import { requireDb, requireFirebaseAuth } from "../lib/firebaseAdmin.js";
import { sendOtpEmail, isMailerConfigured } from "../lib/mailer.js";
import { generateCode, hashCode, OTP_TTL_MS, MAX_ATTEMPTS } from "../lib/otp.js";
import { AppError } from "../utils/AppError.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

// POST /auth/email/start — unauthenticated, api-contracts.md §11 / hld.md §13's Email+OTP branch.
export async function startEmailAuth(rawEmail: unknown): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_RE.test(email)) {
    throw new AppError("INVALID_EMAIL", "A valid email is required", 400);
  }
  if (!isMailerConfigured()) {
    throw new AppError("MAILER_NOT_CONFIGURED", "Email sending is not configured on this server", 503);
  }
  const db = requireDb();

  try {
    const code = generateCode();
    await db.collection("authCodes").doc(email).set({
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      createdAt: new Date()
    });

    await sendOtpEmail(email, code);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("OTP_SEND_FAILED", "Failed to send verification code", 502);
  }
}

// POST /auth/email/verify — unauthenticated, api-contracts.md §11.
export async function verifyEmailAuth(rawEmail: unknown, rawCode: unknown): Promise<{ customToken: string }> {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode ?? "").trim();
  if (!EMAIL_RE.test(email) || !code) {
    throw new AppError("INVALID_REQUEST", "email and code are required", 400);
  }
  const db = requireDb();
  const authAdmin = requireFirebaseAuth();

  const ref = db.collection("authCodes").doc(email);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      throw new AppError("CODE_NOT_FOUND", "No verification code was requested for this email", 400);
    }

    const data = snap.data() as { codeHash: string; expiresAt: FirebaseFirestore.Timestamp | Date; attempts: number };
    const expiresAtMs = data.expiresAt instanceof Date ? data.expiresAt.getTime() : data.expiresAt.toMillis();

    if (Date.now() > expiresAtMs) {
      await ref.delete();
      throw new AppError("CODE_EXPIRED", "This code has expired, request a new one", 400);
    }
    if (data.attempts >= MAX_ATTEMPTS) {
      await ref.delete();
      throw new AppError("TOO_MANY_ATTEMPTS", "Too many attempts, request a new code", 429);
    }
    if (hashCode(code) !== data.codeHash) {
      await ref.update({ attempts: data.attempts + 1 });
      throw new AppError("INVALID_CODE", "Incorrect code", 400);
    }

    await ref.delete();

    const userRecord = await authAdmin.getUserByEmail(email).catch(async (err) => {
      if ((err as { code?: string })?.code === "auth/user-not-found") {
        return authAdmin.createUser({ email });
      }
      throw err;
    });

    const customToken = await authAdmin.createCustomToken(userRecord.uid);
    return { customToken };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("VERIFY_FAILED", "Failed to verify code", 502);
  }
}
