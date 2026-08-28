import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { hashCode } from "../src/lib/otp.js";

const store = new Map<string, Record<string, unknown>>();
const sendOtpEmail = vi.fn(async (_to: string, _code: string) => {});
const getUserByEmail = vi.fn();
const createUser = vi.fn();
const createCustomToken = vi.fn(async (uid: string) => `custom-token-for-${uid}`);

function makeDocRef(path: string) {
  return {
    get: vi.fn(async () => ({
      exists: store.has(path),
      data: () => store.get(path)
    })),
    set: vi.fn(async (value: Record<string, unknown>) => {
      store.set(path, value);
    }),
    update: vi.fn(async (patch: Record<string, unknown>) => {
      const existing = store.get(path) ?? {};
      store.set(path, { ...existing, ...patch });
    }),
    delete: vi.fn(async () => {
      store.delete(path);
    })
  };
}

vi.mock("../src/lib/firebaseAdmin.js", () => ({
  auth: { verifyIdToken: vi.fn(), getUserByEmail, createUser, createCustomToken },
  db: {
    collection: (name: string) => ({
      doc: (id: string) => makeDocRef(`${name}/${id}`)
    })
  },
  isFirebaseConfigured: () => true
}));

vi.mock("../src/lib/mailer.js", () => ({
  sendOtpEmail,
  isMailerConfigured: () => true
}));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.clear();
  sendOtpEmail.mockClear();
  getUserByEmail.mockReset();
  createUser.mockReset();
  createCustomToken.mockClear();
});

describe("POST /auth/email/start", () => {
  it("400s on an invalid email", async () => {
    const app = createApp();
    const res = await request(app).post("/auth/email/start").send({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_EMAIL");
  });

  it("stores a hashed code (never the raw code) and emails it", async () => {
    const app = createApp();
    const res = await request(app).post("/auth/email/start").send({ email: "a@example.com" });

    expect(res.status).toBe(204);
    expect(sendOtpEmail).toHaveBeenCalledTimes(1);
    const [to, rawCode] = sendOtpEmail.mock.calls[0];
    expect(to).toBe("a@example.com");
    expect(rawCode).toMatch(/^\d{6}$/);

    const stored = store.get("authCodes/a@example.com") as { codeHash: string; attempts: number };
    expect(stored.codeHash).toBe(hashCode(rawCode));
    expect(stored.attempts).toBe(0);
  });

  it("lowercases the email before storing/sending", async () => {
    const app = createApp();
    await request(app).post("/auth/email/start").send({ email: "MixedCase@Example.com" });

    expect(store.has("authCodes/mixedcase@example.com")).toBe(true);
    expect(sendOtpEmail).toHaveBeenCalledWith("mixedcase@example.com", expect.any(String));
  });
});

describe("POST /auth/email/verify", () => {
  it("400s when no code was requested for that email", async () => {
    const app = createApp();
    const res = await request(app).post("/auth/email/verify").send({ email: "a@example.com", code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CODE_NOT_FOUND");
  });

  it("400s and increments attempts on a wrong code", async () => {
    store.set("authCodes/a@example.com", {
      codeHash: hashCode("111111"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0
    });
    const app = createApp();
    const res = await request(app).post("/auth/email/verify").send({ email: "a@example.com", code: "000000" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_CODE");
    expect((store.get("authCodes/a@example.com") as { attempts: number }).attempts).toBe(1);
  });

  it("400s on an expired code and cleans it up", async () => {
    store.set("authCodes/a@example.com", {
      codeHash: hashCode("111111"),
      expiresAt: new Date(Date.now() - 1_000),
      attempts: 0
    });
    const app = createApp();
    const res = await request(app).post("/auth/email/verify").send({ email: "a@example.com", code: "111111" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CODE_EXPIRED");
    expect(store.has("authCodes/a@example.com")).toBe(false);
  });

  it("429s once attempts are exhausted", async () => {
    store.set("authCodes/a@example.com", {
      codeHash: hashCode("111111"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 5
    });
    const app = createApp();
    const res = await request(app).post("/auth/email/verify").send({ email: "a@example.com", code: "111111" });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("mints a custom token and reuses an existing Firebase Auth user for the email", async () => {
    store.set("authCodes/existing@example.com", {
      codeHash: hashCode("222222"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0
    });
    getUserByEmail.mockResolvedValueOnce({ uid: "existing-uid" });

    const app = createApp();
    const res = await request(app)
      .post("/auth/email/verify")
      .send({ email: "existing@example.com", code: "222222" });

    expect(res.status).toBe(200);
    expect(res.body.customToken).toBe("custom-token-for-existing-uid");
    expect(createUser).not.toHaveBeenCalled();
    expect(createCustomToken).toHaveBeenCalledWith("existing-uid");
    expect(store.has("authCodes/existing@example.com")).toBe(false);
  });

  it("creates a new Firebase Auth user when none exists for the email", async () => {
    store.set("authCodes/new@example.com", {
      codeHash: hashCode("333333"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0
    });
    getUserByEmail.mockRejectedValueOnce({ code: "auth/user-not-found" });
    createUser.mockResolvedValueOnce({ uid: "new-uid" });

    const app = createApp();
    const res = await request(app).post("/auth/email/verify").send({ email: "new@example.com", code: "333333" });

    expect(res.status).toBe(200);
    expect(res.body.customToken).toBe("custom-token-for-new-uid");
    expect(createUser).toHaveBeenCalledWith({ email: "new@example.com" });
  });
});
