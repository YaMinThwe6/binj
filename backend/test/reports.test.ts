import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

type DocData = Record<string, unknown>;
const store = new Map<string, DocData>();
let autoCounter = 0;

function directChildren(path: string) {
  return [...store.entries()].filter(([key]) => {
    if (!key.startsWith(`${path}/`)) return false;
    return key.slice(path.length + 1).split("/").length === 1;
  });
}

function docRef(path: string) {
  return {
    id: path.split("/").pop()!,
    __path: path,
    get: async () => ({ exists: store.has(path), id: path.split("/").pop()!, data: () => store.get(path) }),
    set: async (v: DocData) => {
      store.set(path, v);
    },
    update: async (patch: DocData) => {
      const existing = store.get(path) ?? {};
      store.set(path, { ...existing, ...patch });
    },
    delete: async () => {
      store.delete(path);
    },
    collection: (sub: string) => collectionRef(`${path}/${sub}`)
  };
}

function collectionRef(path: string) {
  return {
    doc: (id?: string) => docRef(`${path}/${id ?? `auto-${++autoCounter}`}`),
    add: async (value: DocData) => {
      const ref = docRef(`${path}/auto-${++autoCounter}`);
      await ref.set(value);
      return ref;
    },
    get: async () => ({ docs: directChildren(path).map(([key, data]) => ({ id: key.split("/").pop()!, data: () => data })) })
  };
}

const db = { collection: (name: string) => collectionRef(name) };

let currentUid = "reporter-1";
vi.mock("../src/lib/firebaseAdmin.js", () => ({
  auth: { verifyIdToken: vi.fn(async () => ({ uid: currentUid })) },
  db,
  requireDb: () => db,
  isFirebaseConfigured: () => true
}));

const geminiState = { configured: true };
const moderateContent = vi.fn();
vi.mock("../src/lib/gemini.js", () => ({
  get geminiConfigured() {
    return geminiState.configured;
  },
  moderateContent
}));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.clear();
  autoCounter = 0;
  currentUid = "reporter-1";
  geminiState.configured = true;
  moderateContent.mockReset();
});

function authed(app: ReturnType<typeof createApp>, body: Record<string, unknown>) {
  return request(app).post("/reports").set("Authorization", "Bearer good").send(body);
}

const dismissDecision = {
  violates: false,
  category: "legitimate-discussion",
  contentAction: "none",
  accountAction: "none",
  suspensionDays: null,
  confidence: 0.95,
  rationale: "This is ordinary discussion of the movie's plot, not a real violation."
};

describe("POST /reports", () => {
  it("401s without a token", async () => {
    const app = createApp();
    const res = await request(app).post("/reports").send({ targetType: "user", targetId: "uid-2", reason: "spam" });
    expect(res.status).toBe(401);
  });

  it("400s on an invalid targetType", async () => {
    const app = createApp();
    const res = await authed(app, { targetType: "forum-post", targetId: "x", reason: "spam" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_REPORT");
  });

  it("400s when reason is missing or blank", async () => {
    store.set("users/uid-2", { displayName: "Someone" });
    const app = createApp();
    const res = await authed(app, { targetType: "user", targetId: "uid-2", reason: "   " });
    expect(res.status).toBe(400);
  });

  it("400s when reporting a message without roomId", async () => {
    const app = createApp();
    const res = await authed(app, { targetType: "message", targetId: "msg-1", reason: "spam" });
    expect(res.status).toBe(400);
  });

  it("400s when reporting a review without movieId", async () => {
    const app = createApp();
    const res = await authed(app, { targetType: "review", targetId: "uid-2", reason: "spam" });
    expect(res.status).toBe(400);
  });

  it("404s when the reported message doesn't exist", async () => {
    const app = createApp();
    const res = await authed(app, { targetType: "message", targetId: "no-such", roomId: "room-1", reason: "spam" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("TARGET_NOT_FOUND");
  });

  it("404s when the reported user doesn't exist", async () => {
    const app = createApp();
    const res = await authed(app, { targetType: "user", targetId: "no-such", reason: "spam" });
    expect(res.status).toBe(404);
  });

  describe("when Gemini isn't configured", () => {
    it("creates the report but leaves it pending, with no side effects", async () => {
      geminiState.configured = false;
      store.set("users/uid-2", { displayName: "Someone", status: "active" });

      const app = createApp();
      const res = await authed(app, { targetType: "user", targetId: "uid-2", reason: "harassing me" });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.decision).toBeNull();
      expect(moderateContent).not.toHaveBeenCalled();
      expect((store.get("users/uid-2") as { status: string }).status).toBe("active"); // untouched
    });
  });

  describe("when Gemini decides there's no violation", () => {
    it("dismisses the report and leaves everything untouched", async () => {
      moderateContent.mockResolvedValue(dismissDecision);
      store.set("rooms/room-1/messages/msg-1", { authorId: "uid-2", text: "the assault scene in this film is brutal", deleted: false });

      const app = createApp();
      const res = await authed(app, { targetType: "message", targetId: "msg-1", roomId: "room-1", reason: "seems inappropriate" });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("dismissed");
      expect(res.body.data.decision.violates).toBe(false);
      expect((store.get("rooms/room-1/messages/msg-1") as { deleted: boolean }).deleted).toBe(false);
    });
  });

  describe("when Gemini finds a violation", () => {
    it("soft-deletes a reported message when contentAction is remove", async () => {
      moderateContent.mockResolvedValue({
        violates: true,
        category: "harassment",
        contentAction: "remove",
        accountAction: "none",
        suspensionDays: null,
        confidence: 0.9,
        rationale: "Direct harassment of another user."
      });
      store.set("rooms/room-1/messages/msg-1", { authorId: "uid-2", text: "get lost, no one wants you here", deleted: false });

      const app = createApp();
      const res = await authed(app, { targetType: "message", targetId: "msg-1", roomId: "room-1", reason: "harassing me" });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("actioned");
      expect((store.get("rooms/room-1/messages/msg-1") as { deleted: boolean }).deleted).toBe(true);
      expect(store.has("users/uid-2/notifications/auto-1")).toBe(false); // no account action -> no notification
    });

    it("soft-deletes a reported review the same way", async () => {
      moderateContent.mockResolvedValue({
        violates: true,
        category: "spam-or-scam",
        contentAction: "remove",
        accountAction: "none",
        suspensionDays: null,
        confidence: 0.85,
        rationale: "This is a scam link, not a review."
      });
      store.set("movies/movie-1/reviews/uid-2", { rating: 5, reviewText: "check out my crypto giveaway at scam.example", deleted: false });

      const app = createApp();
      const res = await authed(app, { targetType: "review", targetId: "uid-2", movieId: "movie-1", reason: "this is spam" });

      expect(res.status).toBe(201);
      expect((store.get("movies/movie-1/reviews/uid-2") as { deleted: boolean }).deleted).toBe(true);
    });

    it("warns the author and notifies them, without touching their account status", async () => {
      moderateContent.mockResolvedValue({
        violates: true,
        category: "harassment",
        contentAction: "none",
        accountAction: "warn",
        suspensionDays: null,
        confidence: 0.6,
        rationale: "Borderline but worth a warning."
      });
      store.set("users/uid-2", { displayName: "Someone", status: "active" });

      const app = createApp();
      const res = await authed(app, { targetType: "user", targetId: "uid-2", reason: "rude comments" });

      expect(res.status).toBe(201);
      expect((store.get("users/uid-2") as { status: string }).status).toBe("active");
      const notifications = [...store.entries()].filter(([k]) => k.startsWith("users/uid-2/notifications/"));
      expect(notifications).toHaveLength(1);
      expect((notifications[0][1] as { type: string }).type).toBe("moderationWarning");
    });

    it("restricts the account with a time-boxed expiry", async () => {
      moderateContent.mockResolvedValue({
        violates: true,
        category: "harassment",
        contentAction: "remove",
        accountAction: "restrict",
        suspensionDays: 5,
        confidence: 0.8,
        rationale: "Repeated harassment."
      });
      store.set("rooms/room-1/messages/msg-1", { authorId: "uid-2", text: "bad message", deleted: false });
      const before = Date.now();

      const app = createApp();
      const res = await authed(app, { targetType: "message", targetId: "msg-1", roomId: "room-1", reason: "harassment" });

      expect(res.status).toBe(201);
      const user = store.get("users/uid-2") as { status: string; statusExpiresAt: Date };
      expect(user.status).toBe("restricted");
      expect(user.statusExpiresAt.getTime()).toBeGreaterThan(before + 4 * 24 * 60 * 60 * 1000);
      expect(user.statusExpiresAt.getTime()).toBeLessThan(before + 6 * 24 * 60 * 60 * 1000);
    });

    it("suspends permanently with no expiry for severe violations", async () => {
      moderateContent.mockResolvedValue({
        violates: true,
        category: "grooming",
        contentAction: "remove",
        accountAction: "suspend_permanent",
        suspensionDays: null,
        confidence: 0.97,
        rationale: "Severe policy violation."
      });
      store.set("users/uid-2", { displayName: "Someone", status: "active" });

      const app = createApp();
      const res = await authed(app, { targetType: "user", targetId: "uid-2", reason: "extremely inappropriate behavior" });

      expect(res.status).toBe(201);
      const user = store.get("users/uid-2") as { status: string; statusExpiresAt: Date | null };
      expect(user.status).toBe("suspended");
      expect(user.statusExpiresAt).toBeNull();
    });

    it("acts on the host, not the eventId, when reporting an event", async () => {
      moderateContent.mockResolvedValue({
        violates: true,
        category: "spam-or-scam",
        contentAction: "none",
        accountAction: "warn",
        suspensionDays: null,
        confidence: 0.7,
        rationale: "Event looks like a scam listing."
      });
      store.set("events/evt-1", { hostId: "host-uid", title: "Free crypto watch party!!" });

      const app = createApp();
      const res = await authed(app, { targetType: "event", targetId: "evt-1", reason: "scam" });

      expect(res.status).toBe(201);
      const notifications = [...store.entries()].filter(([k]) => k.startsWith("users/host-uid/notifications/"));
      expect(notifications).toHaveLength(1);
    });

    it("returns status \"error\" and doesn't crash when Gemini itself fails", async () => {
      moderateContent.mockRejectedValue(new Error("upstream timeout"));
      store.set("users/uid-2", { displayName: "Someone", status: "active" });

      const app = createApp();
      const res = await authed(app, { targetType: "user", targetId: "uid-2", reason: "spam" });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("error");
      expect((store.get("users/uid-2") as { status: string }).status).toBe("active");
    });
  });

  describe("low-confidence decisions", () => {
    it("caps a low-confidence suspension down to a warning instead of applying it", async () => {
      moderateContent.mockResolvedValue({
        violates: true,
        category: "harassment",
        contentAction: "remove",
        accountAction: "suspend_permanent",
        suspensionDays: null,
        confidence: 0.4,
        rationale: "Possibly harassment, but the wording is ambiguous."
      });
      store.set("rooms/room-1/messages/msg-1", { authorId: "uid-2", text: "ambiguous message", deleted: false });
      store.set("users/uid-2", { displayName: "Someone", status: "active" });

      const app = createApp();
      const res = await authed(app, { targetType: "message", targetId: "msg-1", roomId: "room-1", reason: "seems harassing" });

      expect(res.status).toBe(201);
      expect(res.body.data.decision.accountAction).toBe("warn"); // capped, not the suggested suspend_permanent
      expect(res.body.data.decision.flaggedForReview).toBe(true);

      const user = store.get("users/uid-2") as { status: string };
      expect(user.status).toBe("active"); // never suspended/restricted
      const notifications = [...store.entries()].filter(([k]) => k.startsWith("users/uid-2/notifications/"));
      expect(notifications).toHaveLength(1); // still warned

      // content removal is untouched by the cap — still soft/reversible, lower stakes
      expect((store.get("rooms/room-1/messages/msg-1") as { deleted: boolean }).deleted).toBe(true);
    });

    it("does not cap a high-confidence suspension", async () => {
      moderateContent.mockResolvedValue({
        violates: true,
        category: "grooming",
        contentAction: "remove",
        accountAction: "suspend_permanent",
        suspensionDays: null,
        confidence: 0.95,
        rationale: "Clear, severe violation."
      });
      store.set("users/uid-2", { displayName: "Someone", status: "active" });

      const app = createApp();
      const res = await authed(app, { targetType: "user", targetId: "uid-2", reason: "grooming behavior" });

      expect(res.status).toBe(201);
      expect(res.body.data.decision.accountAction).toBe("suspend_permanent");
      expect(res.body.data.decision.flaggedForReview).toBe(false);
      expect((store.get("users/uid-2") as { status: string }).status).toBe("suspended");
    });

    it("flags a low-confidence decision even when accountAction didn't need capping", async () => {
      moderateContent.mockResolvedValue({
        violates: false,
        category: "legitimate-discussion",
        contentAction: "none",
        accountAction: "none",
        suspensionDays: null,
        confidence: 0.3,
        rationale: "Unclear whether this is a violation."
      });
      store.set("users/uid-2", { displayName: "Someone", status: "active" });

      const app = createApp();
      const res = await authed(app, { targetType: "user", targetId: "uid-2", reason: "not sure, flagging just in case" });

      expect(res.status).toBe(201);
      expect(res.body.data.decision.flaggedForReview).toBe(true);
      expect(res.body.data.decision.accountAction).toBe("none"); // nothing to cap, already the lightest option
    });

    it("stores the raw Gemini decision, the applied action, and the flag on the report doc for audit", async () => {
      moderateContent.mockResolvedValue({
        violates: true,
        category: "harassment",
        contentAction: "none",
        accountAction: "restrict",
        suspensionDays: 10,
        confidence: 0.5,
        rationale: "Uncertain call."
      });
      store.set("users/uid-2", { displayName: "Someone", status: "active" });

      const app = createApp();
      const res = await authed(app, { targetType: "user", targetId: "uid-2", reason: "rudeness" });

      const reportId = res.body.data.reportId;
      const stored = store.get(`reports/${reportId}`) as {
        decision: { accountAction: string; confidence: number };
        appliedAccountAction: string;
        flaggedForReview: boolean;
      };
      expect(stored.decision.accountAction).toBe("restrict"); // raw Gemini suggestion, preserved
      expect(stored.appliedAccountAction).toBe("warn"); // what actually happened
      expect(stored.flaggedForReview).toBe(true);
    });
  });
});
