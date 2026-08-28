import { Router } from "express";
import { auth, db } from "../lib/firebaseAdmin.js";
import { sendOtpEmail, isMailerConfigured } from "../lib/mailer.js";
import { generateCode, hashCode, OTP_TTL_MS, MAX_ATTEMPTS } from "../lib/otp.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /auth/email/start — unauthenticated, api-contracts.md §11 / hld.md §13's Email+OTP branch.
authRouter.post("/auth/email/start", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: { code: "INVALID_EMAIL", message: "A valid email is required" } });
  }
  if (!db) {
    return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured on this server" } });
  }
  if (!isMailerConfigured()) {
    return res.status(503).json({ error: { code: "MAILER_NOT_CONFIGURED", message: "Email sending is not configured on this server" } });
  }

  try {
    const code = generateCode();
    await db.collection("authCodes").doc(email).set({
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      createdAt: new Date()
    });

    await sendOtpEmail(email, code);
    return res.status(204).send();
  } catch (err) {
    console.error(`[POST /auth/email/start] email=${email}`, err);
    return res.status(502).json({ error: { code: "OTP_SEND_FAILED", message: "Failed to send verification code" } });
  }
});

// POST /auth/email/verify — unauthenticated, api-contracts.md §11.
authRouter.post("/auth/email/verify", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();

  if (!EMAIL_RE.test(email) || !code) {
    return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "email and code are required" } });
  }
  if (!db || !auth) {
    return res.status(503).json({ error: { code: "FIREBASE_NOT_CONFIGURED", message: "Firebase is not configured on this server" } });
  }

  try {
    const ref = db.collection("authCodes").doc(email);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(400).json({ error: { code: "CODE_NOT_FOUND", message: "No verification code was requested for this email" } });
    }

    const data = snap.data() as { codeHash: string; expiresAt: FirebaseFirestore.Timestamp | Date; attempts: number };
    const expiresAtMs = data.expiresAt instanceof Date ? data.expiresAt.getTime() : data.expiresAt.toMillis();

    if (Date.now() > expiresAtMs) {
      await ref.delete();
      return res.status(400).json({ error: { code: "CODE_EXPIRED", message: "This code has expired, request a new one" } });
    }
    if (data.attempts >= MAX_ATTEMPTS) {
      await ref.delete();
      return res.status(429).json({ error: { code: "TOO_MANY_ATTEMPTS", message: "Too many attempts, request a new code" } });
    }
    if (hashCode(code) !== data.codeHash) {
      await ref.update({ attempts: data.attempts + 1 });
      return res.status(400).json({ error: { code: "INVALID_CODE", message: "Incorrect code" } });
    }

    await ref.delete();

    const userRecord = await auth.getUserByEmail(email).catch(async (err) => {
      if (err?.code === "auth/user-not-found") {
        return auth!.createUser({ email });
      }
      throw err;
    });

    const customToken = await auth.createCustomToken(userRecord.uid);
    return res.status(200).json({ customToken });
  } catch (err) {
    console.error(`[POST /auth/email/verify] email=${email}`, err);
    return res.status(502).json({ error: { code: "VERIFY_FAILED", message: "Failed to verify code" } });
  }
});
