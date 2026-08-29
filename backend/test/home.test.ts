import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

type DocData = Record<string, unknown>;
type Where = { field: string; op: string; value: unknown };
const store = new Map<string, DocData>();

function directChildren(path: string) {
  return [...store.entries()].filter(([key]) => {
    if (!key.startsWith(`${path}/`)) return false;
    return key.slice(path.length + 1).split("/").length === 1;
  });
}

function docRef(path: string) {
  return {
    id: path.split("/").pop()!,
    get: async () => ({ exists: store.has(path), id: path.split("/").pop()!, data: () => store.get(path) }),
    collection: (sub: string) => collectionRef(`${path}/${sub}`)
  };
}

function matchWhere(data: DocData, w: Where): boolean {
  if (w.op === "in") return Array.isArray(w.value) && w.value.includes(data[w.field]);
  return true;
}

function collectionRef(path: string) {
  function query(state: { wheres?: Where[]; orderField?: string; dir?: "asc" | "desc"; lim?: number }) {
    return {
      where: (field: string, op: string, value: unknown) => query({ ...state, wheres: [...(state.wheres ?? []), { field, op, value }] }),
      orderBy: (field: string, dir: "asc" | "desc" = "asc") => query({ ...state, orderField: field, dir }),
      limit: (n: number) => query({ ...state, lim: n }),
      get: async () => {
        let entries = directChildren(path);
        for (const w of state.wheres ?? []) entries = entries.filter(([, data]) => matchWhere(data, w));
        if (state.orderField) {
          const field = state.orderField;
          entries = entries.sort((a, b) => {
            const av = (a[1][field] as Date).getTime();
            const bv = (b[1][field] as Date).getTime();
            return state.dir === "desc" ? bv - av : av - bv;
          });
        }
        if (state.lim) entries = entries.slice(0, state.lim);
        return { docs: entries.map(([key, data]) => ({ id: key.split("/").pop()!, data: () => data })) };
      }
    };
  }
  return {
    doc: (id: string) => docRef(`${path}/${id}`),
    ...query({})
  };
}

const db = { collection: (name: string) => collectionRef(name) };

vi.mock("../src/lib/firebaseAdmin.js", () => ({
  auth: { verifyIdToken: vi.fn(async () => ({ uid: "uid-1" })) },
  db,
  requireDb: () => db,
  isFirebaseConfigured: () => true
}));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.clear();
});

function authed(app: ReturnType<typeof createApp>, path: string) {
  return request(app).get(path).set("Authorization", "Bearer good");
}

describe("GET /home/greeting", () => {
  it("401s without a token", async () => {
    const app = createApp();
    const res = await request(app).get("/home/greeting");
    expect(res.status).toBe(401);
  });

  it("prefers a quote from a movie the caller has actually watched", async () => {
    store.set("users/uid-1/watched/27205", { watchedAt: new Date(), visibility: "public" }); // Inception
    const app = createApp();
    const res = await authed(app, "/home/greeting");
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("watched");
    expect(res.body.data.attribution).toBe("Inception");
  });

  it("falls back to a random quote when nothing watched matches the curated set", async () => {
    store.set("users/uid-1/watched/some-unknown-movie", { watchedAt: new Date(), visibility: "public" });
    const app = createApp();
    const res = await authed(app, "/home/greeting");
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("random");
    expect(typeof res.body.data.quote).toBe("string");
    expect(typeof res.body.data.attribution).toBe("string");
  });
});

describe("GET /home/activity", () => {
  it("returns an empty list when the caller follows no one", async () => {
    const app = createApp();
    const res = await authed(app, "/home/activity");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("only surfaces activity from people the caller actually follows, newest first", async () => {
    store.set("users/uid-1/following/uid-2", { createdAt: new Date() });
    store.set("users/uid-2", { displayName: "Rohan" });
    store.set("users/uid-3", { displayName: "Stranger" });
    store.set("movies/movie-1", { title: "Dune: Part Two", poster: "/dune.jpg" });
    store.set("activity/a1", { uid: "uid-2", type: "watched", movieId: "movie-1", createdAt: new Date("2026-01-01") });
    store.set("activity/a2", { uid: "uid-2", type: "watchlist_added", movieId: "movie-1", createdAt: new Date("2026-01-02") });
    store.set("activity/a3", { uid: "uid-3", type: "watched", movieId: "movie-1", createdAt: new Date("2026-01-03") }); // not followed

    const app = createApp();
    const res = await authed(app, "/home/activity");
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((i: { activityId: string }) => i.activityId)).toEqual(["a2", "a1"]);
    expect(res.body.data.items[0]).toMatchObject({ displayName: "Rohan", type: "watchlist_added", movieTitle: "Dune: Part Two" });
  });
});
