import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

type DocData = Record<string, unknown>;
type Where = { field: string; op: string; value: unknown };
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

function matchWhere(data: DocData, w: Where): boolean {
  const raw = data[w.field];
  const val = raw instanceof Date ? raw.getTime() : raw;
  const target = w.value instanceof Date ? w.value.getTime() : w.value;
  switch (w.op) {
    case "==":
      return val === target;
    case ">=":
      return typeof val === "number" && typeof target === "number" && val >= target;
    case "in":
      return Array.isArray(w.value) && w.value.includes(raw);
    default:
      return true;
  }
}

function collectionRef(path: string) {
  function query(state: { wheres?: Where[]; orderField?: string; dir?: "asc" | "desc"; lim?: number }) {
    return {
      where: (field: string, op: string, value: unknown) => query({ ...state, wheres: [...(state.wheres ?? []), { field, op, value }] }),
      orderBy: (field: string, dir: "asc" | "desc" = "asc") => query({ ...state, orderField: field, dir }),
      limit: (n: number) => query({ ...state, lim: n }),
      get: async () => {
        let entries = directChildren(path);
        for (const w of state.wheres ?? []) {
          entries = entries.filter(([, data]) => matchWhere(data, w));
        }
        if (state.orderField) {
          const field = state.orderField;
          entries = entries.sort((a, b) => {
            const av = a[1][field] instanceof Date ? (a[1][field] as Date).getTime() : (a[1][field] as number) ?? 0;
            const bv = b[1][field] instanceof Date ? (b[1][field] as Date).getTime() : (b[1][field] as number) ?? 0;
            return state.dir === "desc" ? bv - av : av - bv;
          });
        }
        if (state.lim) entries = entries.slice(0, state.lim);
        return { docs: entries.map(([key, data]) => ({ id: key.split("/").pop()!, data: () => data })) };
      }
    };
  }

  return {
    doc: (id?: string) => docRef(`${path}/${id ?? `auto-${++autoCounter}`}`),
    add: async (value: DocData) => {
      const ref = docRef(`${path}/auto-${++autoCounter}`);
      await ref.set(value);
      return ref;
    },
    ...query({})
  };
}

function makeBatch() {
  type Op = { type: "set" | "delete"; path: string; value?: DocData };
  const ops: Op[] = [];
  const batch = {
    set: (ref: { __path: string }, value: DocData) => {
      ops.push({ type: "set", path: ref.__path, value });
      return batch;
    },
    delete: (ref: { __path: string }) => {
      ops.push({ type: "delete", path: ref.__path });
      return batch;
    },
    commit: async () => {
      for (const op of ops) {
        if (op.type === "set") store.set(op.path, op.value!);
        else store.delete(op.path);
      }
    }
  };
  return batch;
}

const db = {
  collection: (name: string) => collectionRef(name),
  batch: () => makeBatch(),
  runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
      set: (ref: { __path: string }, v: DocData) => store.set(ref.__path, v),
      update: (ref: { __path: string }, patch: DocData) => {
        const existing = store.get(ref.__path) ?? {};
        store.set(ref.__path, { ...existing, ...patch });
      },
      delete: (ref: { __path: string }) => store.delete(ref.__path)
    };
    return fn(tx);
  }
};

let currentUid = "host-1";
vi.mock("../src/lib/firebaseAdmin.js", () => ({
  auth: { verifyIdToken: vi.fn(async () => ({ uid: currentUid })) },
  db,
  isFirebaseConfigured: () => true
}));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.clear();
  autoCounter = 0;
  currentUid = "host-1";
  store.set("movies/movie-1", { title: "Dune: Part Two", poster: "/dune.jpg" });
});

function authed(app: ReturnType<typeof createApp>, method: "put" | "delete" | "get" | "post", path: string) {
  return request(app)[method](path).set("Authorization", "Bearer good");
}

const validBody = {
  movieId: "movie-1",
  datetime: "2099-01-01T20:00:00.000Z",
  mode: "online",
  visibility: "public",
  participantLimit: 5,
  requiresApproval: false
};

describe("POST /events", () => {
  it("401s without a token", async () => {
    const app = createApp();
    const res = await request(app).post("/events").send(validBody);
    expect(res.status).toBe(401);
  });

  it("400s on a malformed body", async () => {
    const app = createApp();
    const res = await authed(app, "post", "/events").send({ ...validBody, mode: "carrier-pigeon" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_EVENT");
  });

  it("404s when the movie doesn't exist", async () => {
    const app = createApp();
    const res = await authed(app, "post", "/events").send({ ...validBody, movieId: "no-such-movie" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MOVIE_NOT_FOUND");
  });

  it("creates the event, auto-joins the host, and assigns a roomId", async () => {
    const app = createApp();
    const res = await authed(app, "post", "/events").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.hostId).toBe("host-1");
    expect(res.body.participantCount).toBe(1);
    const eventId = res.body.eventId;
    expect(store.has(`events/${eventId}/participants/host-1`)).toBe(true);
    const stored = store.get(`events/${eventId}`) as { roomId: string };
    expect(store.has(`rooms/${stored.roomId}`)).toBe(true);
  });

  it("generates a joinCode only for private events, and returns it in the create response", async () => {
    const app = createApp();
    const publicRes = await authed(app, "post", "/events").send(validBody);
    expect(publicRes.body.joinCode).toBeNull();
    const stored = store.get(`events/${publicRes.body.eventId}`) as { joinCode: string | null };
    expect(stored.joinCode).toBeNull();

    const privateRes = await authed(app, "post", "/events").send({ ...validBody, visibility: "private" });
    expect(typeof privateRes.body.joinCode).toBe("string");
    expect(privateRes.body.joinCode.length).toBeGreaterThan(0);
    const privateStored = store.get(`events/${privateRes.body.eventId}`) as { joinCode: string | null };
    expect(privateStored.joinCode).toBe(privateRes.body.joinCode);
  });
});

describe("GET /events/upcoming", () => {
  it("returns only public, future events, sorted by datetime ascending, joined with movie info", async () => {
    store.set("events/past", { hostId: "host-1", movieId: "movie-1", visibility: "public", datetime: new Date("2020-01-01"), participantCount: 1, participantLimit: 5, requiresApproval: false });
    store.set("events/private", { hostId: "host-1", movieId: "movie-1", visibility: "private", datetime: new Date("2099-01-01"), participantCount: 1, participantLimit: 5, requiresApproval: false });
    store.set("events/soon", { hostId: "host-1", movieId: "movie-1", visibility: "public", datetime: new Date("2099-06-01"), participantCount: 1, participantLimit: 5, requiresApproval: false });
    store.set("events/later", { hostId: "host-1", movieId: "movie-1", visibility: "public", datetime: new Date("2099-12-01"), participantCount: 1, participantLimit: 5, requiresApproval: false });

    const app = createApp();
    const res = await authed(app, "get", "/events/upcoming");
    expect(res.status).toBe(200);
    expect(res.body.items.map((e: { eventId: string }) => e.eventId)).toEqual(["soon", "later"]);
    expect(res.body.items[0].movieTitle).toBe("Dune: Part Two");
  });
});

describe("PUT /events/:eventId/join", () => {
  it("404s for a nonexistent event", async () => {
    const app = createApp();
    const res = await authed(app, "put", "/events/no-such-event/join");
    expect(res.status).toBe(404);
  });

  it("joins instantly when the event doesn't require approval", async () => {
    store.set("events/evt-1", { hostId: "host-1", movieId: "movie-1", requiresApproval: false, participantCount: 1, participantLimit: 5 });
    currentUid = "guest-1";
    const app = createApp();
    const res = await authed(app, "put", "/events/evt-1/join");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "joined" });
    expect(store.has("events/evt-1/participants/guest-1")).toBe(true);
    expect((store.get("events/evt-1") as { participantCount: number }).participantCount).toBe(2);
  });

  it("409s when the event is full", async () => {
    store.set("events/evt-1", { hostId: "host-1", movieId: "movie-1", requiresApproval: false, participantCount: 1, participantLimit: 1 });
    currentUid = "guest-1";
    const app = createApp();
    const res = await authed(app, "put", "/events/evt-1/join");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EVENT_FULL");
  });

  it("creates a pending join request when approval is required", async () => {
    store.set("events/evt-1", { hostId: "host-1", movieId: "movie-1", requiresApproval: true, participantCount: 1, participantLimit: 5 });
    currentUid = "guest-1";
    const app = createApp();
    const res = await authed(app, "put", "/events/evt-1/join");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "pending" });
    expect(store.has("events/evt-1/joinRequests/guest-1")).toBe(true);
  });

  it("is idempotent — already-joined returns joined without double counting", async () => {
    store.set("events/evt-1", { hostId: "host-1", movieId: "movie-1", requiresApproval: false, participantCount: 2, participantLimit: 5 });
    store.set("events/evt-1/participants/guest-1", { joinedAt: new Date() });
    currentUid = "guest-1";
    const app = createApp();
    const res = await authed(app, "put", "/events/evt-1/join");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "joined" });
    expect((store.get("events/evt-1") as { participantCount: number }).participantCount).toBe(2);
  });
});

describe("DELETE /events/:eventId/join", () => {
  it("removes the participant and decrements participantCount", async () => {
    store.set("events/evt-1", { hostId: "host-1", movieId: "movie-1", participantCount: 2, participantLimit: 5 });
    store.set("events/evt-1/participants/guest-1", { joinedAt: new Date() });
    currentUid = "guest-1";
    const app = createApp();
    const res = await authed(app, "delete", "/events/evt-1/join");
    expect(res.status).toBe(204);
    expect(store.has("events/evt-1/participants/guest-1")).toBe(false);
    expect((store.get("events/evt-1") as { participantCount: number }).participantCount).toBe(1);
  });
});

describe("join request approval", () => {
  it("GET joinRequests 403s for a non-host", async () => {
    store.set("events/evt-1", { hostId: "host-1", movieId: "movie-1" });
    currentUid = "guest-1";
    const app = createApp();
    const res = await authed(app, "get", "/events/evt-1/joinRequests");
    expect(res.status).toBe(403);
  });

  it("approve moves the pending request into participants and increments the count", async () => {
    store.set("events/evt-1", { hostId: "host-1", movieId: "movie-1", participantCount: 1, participantLimit: 5 });
    store.set("events/evt-1/joinRequests/guest-1", { createdAt: new Date() });
    const app = createApp(); // currentUid stays "host-1"
    const res = await authed(app, "post", "/events/evt-1/joinRequests/guest-1/approve");
    expect(res.status).toBe(204);
    expect(store.has("events/evt-1/participants/guest-1")).toBe(true);
    expect(store.has("events/evt-1/joinRequests/guest-1")).toBe(false);
    expect((store.get("events/evt-1") as { participantCount: number }).participantCount).toBe(2);
  });

  it("approve 409s when the event filled up while the request was pending", async () => {
    store.set("events/evt-1", { hostId: "host-1", movieId: "movie-1", participantCount: 5, participantLimit: 5 });
    store.set("events/evt-1/joinRequests/guest-1", { createdAt: new Date() });
    const app = createApp();
    const res = await authed(app, "post", "/events/evt-1/joinRequests/guest-1/approve");
    expect(res.status).toBe(409);
    expect(store.has("events/evt-1/joinRequests/guest-1")).toBe(true); // left pending, not silently dropped
  });

  it("deny just clears the request", async () => {
    store.set("events/evt-1", { hostId: "host-1", movieId: "movie-1" });
    store.set("events/evt-1/joinRequests/guest-1", { createdAt: new Date() });
    const app = createApp();
    const res = await authed(app, "post", "/events/evt-1/joinRequests/guest-1/deny");
    expect(res.status).toBe(204);
    expect(store.has("events/evt-1/joinRequests/guest-1")).toBe(false);
    expect(store.has("events/evt-1/participants/guest-1")).toBe(false);
  });
});
