import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// --- minimal in-memory Firestore fake: supports nested subcollections, ---
// --- orderBy/limit/startAfter queries, and transactions.                ---
type DocData = Record<string, unknown>;
const store = new Map<string, DocData>();

function makeDocRef(path: string): FirebaseFirestore.DocumentReference {
  const ref = {
    id: path.split("/").pop()!,
    get: vi.fn(async () => ({
      exists: store.has(path),
      id: ref.id,
      data: () => store.get(path)
    })),
    set: vi.fn(async (value: DocData) => {
      store.set(path, value);
    }),
    update: vi.fn(async (patch: DocData) => {
      const existing = store.get(path) ?? {};
      store.set(path, { ...existing, ...patch });
    }),
    delete: vi.fn(async () => {
      store.delete(path);
    }),
    collection: (sub: string) => makeCollectionRef(`${path}/${sub}`)
  } as unknown as FirebaseFirestore.DocumentReference;
  return ref;
}

function makeCollectionRef(path: string): FirebaseFirestore.CollectionReference {
  const directChildren = () =>
    [...store.entries()].filter(([key]) => {
      if (!key.startsWith(`${path}/`)) return false;
      return key.slice(path.length + 1).split("/").length === 1;
    });

  function makeQuery(state: { orderField?: string; dir?: "asc" | "desc"; lim?: number; after?: DocData }) {
    return {
      orderBy: (field: string, dir: "asc" | "desc" = "asc") => makeQuery({ ...state, orderField: field, dir }),
      limit: (n: number) => makeQuery({ ...state, lim: n }),
      startAfter: (snap: { data: () => DocData }) => makeQuery({ ...state, after: snap.data() }),
      get: async () => {
        let entries = directChildren();
        if (state.orderField) {
          const field = state.orderField;
          entries = entries.sort((a, b) => {
            const av = a[1][field] as Date;
            const bv = b[1][field] as Date;
            const cmp = av.getTime() - bv.getTime();
            return state.dir === "desc" ? -cmp : cmp;
          });
          if (state.after) {
            const afterVal = (state.after[field] as Date).getTime();
            entries = entries.filter(([, data]) => {
              const v = (data[field] as Date).getTime();
              return state.dir === "desc" ? v < afterVal : v > afterVal;
            });
          }
        }
        if (state.lim) entries = entries.slice(0, state.lim);
        return {
          docs: entries.map(([key, data]) => ({
            id: key.split("/").pop()!,
            data: () => data
          }))
        };
      }
    };
  }

  let autoId = 0;

  return {
    doc: (id: string) => makeDocRef(`${path}/${id}`),
    add: async (value: DocData) => {
      const ref = makeDocRef(`${path}/auto-${++autoId}`);
      await ref.set(value);
      return ref;
    },
    ...makeQuery({})
  } as unknown as FirebaseFirestore.CollectionReference;
}

const db = {
  collection: (name: string) => makeCollectionRef(name),
  runTransaction: async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
      set: (ref: { set: (v: DocData) => void }, v: DocData) => ref.set(v),
      update: (ref: { update: (v: DocData) => void }, v: DocData) => ref.update(v),
      delete: (ref: { delete: () => void }) => ref.delete()
    };
    await fn(tx);
  }
};

vi.mock("../src/lib/firebaseAdmin.js", () => ({
  auth: { verifyIdToken: vi.fn(async () => ({ uid: "uid-1" })) },
  db,
  isFirebaseConfigured: () => true
}));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.clear();
  store.set("movies/movie-1", { title: "Dune: Part Two", genres: ["Sci-Fi"], likeCount: 0 });
});

function authed(app: ReturnType<typeof createApp>, method: "put" | "delete" | "get" | "patch", path: string) {
  return request(app)[method](path).set("Authorization", "Bearer good");
}

function activityEntries() {
  return [...store.entries()].filter(([key]) => key.startsWith("activity/")).map(([, data]) => data);
}

describe("Watchlist", () => {
  it("PUT 404s when the movie doesn't exist in Firestore", async () => {
    const app = createApp();
    const res = await authed(app, "put", "/users/me/watchlist/no-such-movie");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MOVIE_NOT_FOUND");
  });

  it("PUT adds a real movie to the watchlist", async () => {
    const app = createApp();
    const res = await authed(app, "put", "/users/me/watchlist/movie-1");
    expect(res.status).toBe(204);
    expect(store.has("users/uid-1/watchlist/movie-1")).toBe(true);
  });

  it("PUT writes a watchlist_added activity entry (feeds Home's 'friends are watching')", async () => {
    const app = createApp();
    await authed(app, "put", "/users/me/watchlist/movie-1");
    expect(activityEntries()).toEqual([{ uid: "uid-1", type: "watchlist_added", movieId: "movie-1", createdAt: expect.any(Date) }]);
  });

  it("DELETE removes it", async () => {
    store.set("users/uid-1/watchlist/movie-1", { addedAt: new Date() });
    const app = createApp();
    const res = await authed(app, "delete", "/users/me/watchlist/movie-1");
    expect(res.status).toBe(204);
    expect(store.has("users/uid-1/watchlist/movie-1")).toBe(false);
  });

  it("GET returns items newest-first with a nextCursor when the page is full", async () => {
    store.set("users/uid-1/watchlist/movie-1", { addedAt: new Date("2026-01-01") });
    store.set("users/uid-1/watchlist/movie-2", { addedAt: new Date("2026-01-02") });
    const app = createApp();
    const res = await authed(app, "get", "/users/me/watchlist?limit=1");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ movieId: "movie-2", addedAt: "2026-01-02T00:00:00.000Z" }]);
    expect(res.body.nextCursor).toBe("movie-2");
  });
});

describe("Watched", () => {
  it("PUT defaults visibility to public and watchedAt to now", async () => {
    const app = createApp();
    const res = await authed(app, "put", "/users/me/watched/movie-1");
    expect(res.status).toBe(204);
    const stored = store.get("users/uid-1/watched/movie-1") as { visibility: string; watchedAt: Date };
    expect(stored.visibility).toBe("public");
    expect(stored.watchedAt).toBeInstanceOf(Date);
  });

  it("PUT writes a watched activity entry when public, none when private", async () => {
    const app = createApp();
    await authed(app, "put", "/users/me/watched/movie-1"); // defaults to public
    expect(activityEntries()).toEqual([{ uid: "uid-1", type: "watched", movieId: "movie-1", createdAt: expect.any(Date) }]);

    store.clear();
    store.set("movies/movie-2", { title: "Private Watch", genres: [], likeCount: 0 });
    await request(app)
      .put("/users/me/watched/movie-2")
      .set("Authorization", "Bearer good")
      .send({ visibility: "private" });
    expect(activityEntries()).toEqual([]);
  });

  it("PATCH updates visibility only", async () => {
    store.set("users/uid-1/watched/movie-1", { watchedAt: new Date(), visibility: "public" });
    const app = createApp();
    const res = await request(app)
      .patch("/users/me/watched/movie-1")
      .set("Authorization", "Bearer good")
      .send({ visibility: "private" });
    expect(res.status).toBe(204);
    expect((store.get("users/uid-1/watched/movie-1") as { visibility: string }).visibility).toBe("private");
  });

  it("PATCH 404s when the movie isn't in the watched list", async () => {
    const app = createApp();
    const res = await request(app)
      .patch("/users/me/watched/movie-1")
      .set("Authorization", "Bearer good")
      .send({ visibility: "private" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_WATCHED");
  });

  it("PATCH 400s on an invalid visibility value", async () => {
    const app = createApp();
    const res = await request(app)
      .patch("/users/me/watched/movie-1")
      .set("Authorization", "Bearer good")
      .send({ visibility: "sorta" });
    expect(res.status).toBe(400);
  });
});

describe("Likes", () => {
  it("PUT likes a movie and increments movies.likeCount", async () => {
    const app = createApp();
    const res = await authed(app, "put", "/users/me/likes/movie-1");
    expect(res.status).toBe(204);
    expect(store.has("users/uid-1/likes/movie-1")).toBe(true);
    expect((store.get("movies/movie-1") as { likeCount: number }).likeCount).toBe(1);
  });

  it("PUT is idempotent — liking twice only increments once", async () => {
    const app = createApp();
    await authed(app, "put", "/users/me/likes/movie-1");
    const res = await authed(app, "put", "/users/me/likes/movie-1");
    expect(res.status).toBe(204);
    expect((store.get("movies/movie-1") as { likeCount: number }).likeCount).toBe(1);
  });

  it("PUT 404s for a nonexistent movie", async () => {
    const app = createApp();
    const res = await authed(app, "put", "/users/me/likes/no-such-movie");
    expect(res.status).toBe(404);
  });

  it("DELETE unlikes and decrements likeCount, never below 0", async () => {
    store.set("users/uid-1/likes/movie-1", { createdAt: new Date() });
    store.set("movies/movie-1", { title: "Dune: Part Two", genres: ["Sci-Fi"], likeCount: 1 });
    const app = createApp();
    const res = await authed(app, "delete", "/users/me/likes/movie-1");
    expect(res.status).toBe(204);
    expect(store.has("users/uid-1/likes/movie-1")).toBe(false);
    expect((store.get("movies/movie-1") as { likeCount: number }).likeCount).toBe(0);
  });

  it("DELETE is idempotent — unliking when not liked is a no-op", async () => {
    const app = createApp();
    const res = await authed(app, "delete", "/users/me/likes/movie-1");
    expect(res.status).toBe(204);
    expect((store.get("movies/movie-1") as { likeCount: number }).likeCount).toBe(0);
  });
});

describe("auth", () => {
  it("401s without a token on a write endpoint", async () => {
    const app = createApp();
    const res = await request(app).put("/users/me/watchlist/movie-1");
    expect(res.status).toBe(401);
  });
});
