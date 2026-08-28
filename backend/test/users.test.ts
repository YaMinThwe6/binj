import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const verifyIdToken = vi.fn();
const store = new Map<string, Record<string, unknown>>();

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

const db = {
  collection: (name: string) => ({
    doc: (id: string) => ({ ...makeDocRef(`${name}/${id}`), __path: `${name}/${id}` })
  }),
  runTransaction: async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
      set: (ref: { set: (v: Record<string, unknown>) => void }, v: Record<string, unknown>) => ref.set(v),
      update: (ref: { update: (v: Record<string, unknown>) => void }, v: Record<string, unknown>) => ref.update(v),
      delete: (ref: { delete: () => void }) => ref.delete()
    };
    await fn(tx);
  }
};

vi.mock("../src/lib/firebaseAdmin.js", () => ({
  auth: { verifyIdToken },
  db,
  isFirebaseConfigured: () => true
}));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.clear();
  verifyIdToken.mockReset();
});

describe("GET /users/me", () => {
  it("401s with no Authorization header", async () => {
    const app = createApp();
    const res = await request(app).get("/users/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("401s when the token fails verification", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("bad token"));
    const app = createApp();
    const res = await request(app).get("/users/me").set("Authorization", "Bearer nope");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates a new user doc on first authenticated request, with documented defaults", async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: "uid-1",
      email: "arjun@example.com",
      name: "Arjun Kumar",
      picture: "https://example.com/photo.jpg"
    });
    const app = createApp();
    const res = await request(app).get("/users/me").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uid: "uid-1",
      displayName: "Arjun Kumar",
      email: "arjun@example.com",
      photoURL: "https://example.com/photo.jpg",
      listVisible: true,
      followRequiresApproval: false,
      status: "active",
      favoriteGenres: null,
      preferredLanguages: null,
      username: null,
      onboardingComplete: false,
      notificationPrefs: { emailEnabled: true },
      themePreference: "dark",
      accentTheme: "emerald",
      isNewUser: true
    });
    expect(store.has("users/uid-1")).toBe(true);
  });

  it("returns the existing doc on a later request, without overwriting it", async () => {
    store.set("users/uid-2", {
      uid: "uid-2",
      displayName: "Custom Name",
      email: "x@example.com",
      photoURL: null,
      createdAt: new Date(),
      listVisible: false,
      followRequiresApproval: true,
      status: "active",
      statusExpiresAt: null,
      favoriteGenres: ["Sci-Fi"],
      notificationPrefs: { emailEnabled: false },
      themePreference: "light",
      accentTheme: "cyan"
    });
    verifyIdToken.mockResolvedValueOnce({ uid: "uid-2", email: "x@example.com", name: "ignored" });
    const app = createApp();
    const res = await request(app).get("/users/me").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Custom Name");
    expect(res.body.listVisible).toBe(false);
    expect(res.body.favoriteGenres).toEqual(["Sci-Fi"]);
    expect(res.body.isNewUser).toBe(false);
  });
});

describe("GET /users/username-available", () => {
  it("400s on an invalid username", async () => {
    const app = createApp();
    const res = await request(app).get("/users/username-available?username=a");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_USERNAME");
  });

  it("is unauthenticated — no token required", async () => {
    const app = createApp();
    const res = await request(app).get("/users/username-available?username=arjun.movies");
    expect(res.status).toBe(200);
  });

  it("reports available:true when unclaimed, false when claimed", async () => {
    store.set("usernames/taken", { uid: "someone-else" });
    const app = createApp();

    const freeRes = await request(app).get("/users/username-available?username=free");
    expect(freeRes.body).toEqual({ available: true });

    const takenRes = await request(app).get("/users/username-available?username=taken");
    expect(takenRes.body).toEqual({ available: false });
  });
});

describe("PATCH /users/me", () => {
  it("401s with no Authorization header", async () => {
    const app = createApp();
    const res = await request(app).patch("/users/me").send({ displayName: "New" });

    expect(res.status).toBe(401);
  });

  it("400s when the body has no recognized fields", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "uid-3", email: "x@example.com" });
    const app = createApp();
    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", "Bearer good")
      .send({ email: "should-be-ignored@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NO_UPDATABLE_FIELDS");
  });

  it("updates only the recognized, patchable fields", async () => {
    store.set("users/uid-4", {
      uid: "uid-4",
      displayName: "Old Name",
      accentTheme: "emerald",
      themePreference: "dark"
    });
    verifyIdToken.mockResolvedValueOnce({ uid: "uid-4", email: "x@example.com" });
    const app = createApp();
    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", "Bearer good")
      .send({ displayName: "New Name", accentTheme: "pink", uid: "someone-elses-uid" });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("New Name");
    expect(res.body.accentTheme).toBe("pink");
    expect(store.get("users/uid-4")?.uid).toBe("uid-4");
  });

  it("updates preferredLanguages", async () => {
    store.set("users/uid-5", { uid: "uid-5", preferredLanguages: null });
    verifyIdToken.mockResolvedValueOnce({ uid: "uid-5", email: "x@example.com" });
    const app = createApp();
    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", "Bearer good")
      .send({ preferredLanguages: ["en", "ta", "ko"] });

    expect(res.status).toBe(200);
    expect(res.body.preferredLanguages).toEqual(["en", "ta", "ko"]);
  });

  it("self-heals when the profile doc doesn't exist yet (PATCH before any GET)", async () => {
    // No store.set("users/uid-12", ...) — the doc genuinely doesn't exist.
    verifyIdToken.mockResolvedValueOnce({ uid: "uid-12", email: "late@example.com", name: "Late Bootstrap" });
    const app = createApp();
    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", "Bearer good")
      .send({ displayName: "Late Bootstrap" });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Late Bootstrap");
    expect(res.body.email).toBe("late@example.com");
    expect(res.body.status).toBe("active");
    expect(store.get("users/uid-12")).toMatchObject({ uid: "uid-12", displayName: "Late Bootstrap" });
  });

  it("sets onboardingComplete", async () => {
    store.set("users/uid-6", { uid: "uid-6", onboardingComplete: false });
    verifyIdToken.mockResolvedValueOnce({ uid: "uid-6", email: "x@example.com" });
    const app = createApp();
    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", "Bearer good")
      .send({ onboardingComplete: true });

    expect(res.status).toBe(200);
    expect(res.body.onboardingComplete).toBe(true);
  });

  describe("username", () => {
    it("400s on an invalid username", async () => {
      store.set("users/uid-7", { uid: "uid-7", username: null });
      verifyIdToken.mockResolvedValueOnce({ uid: "uid-7", email: "x@example.com" });
      const app = createApp();
      const res = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer good")
        .send({ username: "a" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_USERNAME");
    });

    it("claims a free username and creates the reservation doc", async () => {
      store.set("users/uid-8", { uid: "uid-8", username: null });
      verifyIdToken.mockResolvedValueOnce({ uid: "uid-8", email: "x@example.com" });
      const app = createApp();
      const res = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer good")
        .send({ username: "Arjun.Movies" });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe("arjun.movies");
      expect(store.get("usernames/arjun.movies")).toEqual({ uid: "uid-8" });
    });

    it("409s when the username is already claimed by someone else", async () => {
      store.set("usernames/taken", { uid: "uid-other" });
      store.set("users/uid-9", { uid: "uid-9", username: null });
      verifyIdToken.mockResolvedValueOnce({ uid: "uid-9", email: "x@example.com" });
      const app = createApp();
      const res = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer good")
        .send({ username: "taken" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("USERNAME_TAKEN");
      expect(store.get("users/uid-9")).toEqual({ uid: "uid-9", username: null });
    });

    it("re-claiming your own current username is a no-op success, not a conflict", async () => {
      store.set("usernames/mine", { uid: "uid-10" });
      store.set("users/uid-10", { uid: "uid-10", username: "mine" });
      verifyIdToken.mockResolvedValueOnce({ uid: "uid-10", email: "x@example.com" });
      const app = createApp();
      const res = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer good")
        .send({ username: "mine" });

      expect(res.status).toBe(200);
    });

    it("self-heals when claiming a username before any GET bootstrapped the doc", async () => {
      // No store.set("users/uid-13", ...) — the doc genuinely doesn't exist.
      verifyIdToken.mockResolvedValueOnce({ uid: "uid-13", email: "late2@example.com" });
      const app = createApp();
      const res = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer good")
        .send({ username: "late_bootstrap" });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe("late_bootstrap");
      expect(res.body.email).toBe("late2@example.com");
      expect(store.get("usernames/late_bootstrap")).toEqual({ uid: "uid-13" });
    });

    it("changing username releases the old reservation", async () => {
      store.set("usernames/old_name", { uid: "uid-11" });
      store.set("users/uid-11", { uid: "uid-11", username: "old_name" });
      verifyIdToken.mockResolvedValueOnce({ uid: "uid-11", email: "x@example.com" });
      const app = createApp();
      const res = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer good")
        .send({ username: "new_name" });

      expect(res.status).toBe(200);
      expect(store.has("usernames/old_name")).toBe(false);
      expect(store.get("usernames/new_name")).toEqual({ uid: "uid-11" });
    });
  });
});
