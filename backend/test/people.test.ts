import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

type DocData = Record<string, unknown>;
const store = new Map<string, DocData>();

function makeDocRef(path: string) {
  return {
    id: path.split("/").pop()!,
    get: vi.fn(async () => ({ exists: store.has(path), id: path.split("/").pop()!, data: () => store.get(path) })),
    set: vi.fn(async (value: DocData) => {
      store.set(path, value);
    }),
    delete: vi.fn(async () => {
      store.delete(path);
    }),
    collection: (sub: string) => makeCollectionRef(`${path}/${sub}`)
  };
}

function directChildren(path: string) {
  return [...store.entries()].filter(([key]) => {
    if (!key.startsWith(`${path}/`)) return false;
    return key.slice(path.length + 1).split("/").length === 1;
  });
}

function makeCollectionRef(path: string) {
  return {
    doc: (id: string) => makeDocRef(`${path}/${id}`),
    get: async () => ({ docs: directChildren(path).map(([key, data]) => ({ id: key.split("/").pop()!, data: () => data })) }),
    orderBy: (field: string, dir: "asc" | "desc" = "asc") => ({
      get: async () => {
        const entries = directChildren(path).sort((a, b) => {
          const av = (a[1][field] as number) ?? 0;
          const bv = (b[1][field] as number) ?? 0;
          return dir === "desc" ? bv - av : av - bv;
        });
        return { docs: entries.map(([key, data]) => ({ id: key.split("/").pop()!, data: () => data })) };
      }
    })
  };
}

const db = { collection: (name: string) => makeCollectionRef(name) };

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

describe("GET /users/me/tasteMatches", () => {
  it("401s without a token", async () => {
    const app = createApp();
    const res = await request(app).get("/users/me/tasteMatches");
    expect(res.status).toBe(401);
  });

  it("returns matches sorted by score desc, with each match's displayName + relationship joined in", async () => {
    store.set("users/uid-2", { displayName: "Rohan" });
    store.set("users/uid-3", { displayName: "Meera" });
    store.set("users/uid-1/tasteMatches/uid-2", { score: 84, computedAt: new Date() });
    store.set("users/uid-1/tasteMatches/uid-3", { score: 91, computedAt: new Date() });
    store.set("users/uid-1/following/uid-2", { createdAt: new Date() }); // already following Rohan
    store.set("users/uid-3/followRequests/uid-1", { createdAt: new Date() }); // pending request to Meera

    const app = createApp();
    const res = await request(app).get("/users/me/tasteMatches").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([
      { uid: "uid-3", displayName: "Meera", score: 91, relationship: "pending" },
      { uid: "uid-2", displayName: "Rohan", score: 84, relationship: "following" }
    ]);
  });

  it("returns an empty list when there are no matches yet", async () => {
    const app = createApp();
    const res = await request(app).get("/users/me/tasteMatches").set("Authorization", "Bearer good");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

describe("Followed celebrities", () => {
  it("PUT 404s for a nonexistent person", async () => {
    const app = createApp();
    const res = await request(app).put("/users/me/followedCelebrities/6193").set("Authorization", "Bearer good");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PERSON_NOT_FOUND");
  });

  it("PUT follows a real person", async () => {
    store.set("people/6193", { name: "Leonardo DiCaprio", photo: null });
    const app = createApp();
    const res = await request(app).put("/users/me/followedCelebrities/6193").set("Authorization", "Bearer good");
    expect(res.status).toBe(204);
    expect(store.has("users/uid-1/followedCelebrities/6193")).toBe(true);
  });

  it("DELETE unfollows", async () => {
    store.set("users/uid-1/followedCelebrities/6193", { followedAt: new Date() });
    const app = createApp();
    const res = await request(app).delete("/users/me/followedCelebrities/6193").set("Authorization", "Bearer good");
    expect(res.status).toBe(204);
    expect(store.has("users/uid-1/followedCelebrities/6193")).toBe(false);
  });

  it("GET joins each followed id against the people collection", async () => {
    store.set("people/6193", { name: "Leonardo DiCaprio", photo: "/dicaprio.jpg" });
    store.set("users/uid-1/followedCelebrities/6193", { followedAt: new Date() });
    const app = createApp();
    const res = await request(app).get("/users/me/followedCelebrities").set("Authorization", "Bearer good");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([{ personId: "6193", name: "Leonardo DiCaprio", photo: "/dicaprio.jpg" }]);
  });
});

describe("GET /onboarding/celebrity-suggestions", () => {
  it("returns an empty list when there's no watch history yet (no fallback)", async () => {
    const app = createApp();
    const res = await request(app).get("/onboarding/celebrity-suggestions").set("Authorization", "Bearer good");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("ranks people by how many watched movies they appear in", async () => {
    store.set("users/uid-1/watched/movie-1", { watchedAt: new Date(), visibility: "public" });
    store.set("users/uid-1/watched/movie-2", { watchedAt: new Date(), visibility: "public" });
    store.set("movies/movie-1", {
      cast: [{ personId: "p1", name: "Actor One", photo: null }],
      crew: [{ personId: "p2", name: "Director One", photo: null }]
    });
    store.set("movies/movie-2", {
      cast: [{ personId: "p1", name: "Actor One", photo: null }],
      crew: []
    });

    const app = createApp();
    const res = await request(app).get("/onboarding/celebrity-suggestions").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.data.items[0]).toEqual({ personId: "p1", name: "Actor One", photo: null, appearsIn: 2 });
    expect(res.body.data.items[1]).toEqual({ personId: "p2", name: "Director One", photo: null, appearsIn: 1 });
  });
});

describe("GET /movies/:movieId/watchedBy", () => {
  it("401s without a token", async () => {
    const app = createApp();
    const res = await request(app).get("/movies/movie-1/watchedBy");
    expect(res.status).toBe(401);
  });

  it("returns an empty list when the caller follows no one", async () => {
    const app = createApp();
    const res = await request(app).get("/movies/movie-1/watchedBy").set("Authorization", "Bearer good");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("only includes followed users who watched the movie, with displayName and watchedAt", async () => {
    const watchedAt = new Date("2026-01-05T10:00:00.000Z");
    store.set("users/uid-1/following/uid-2", { createdAt: new Date() });
    store.set("users/uid-2", { displayName: "Rohan", listVisible: true });
    store.set("users/uid-2/watched/movie-1", { watchedAt, visibility: "public" });

    const app = createApp();
    const res = await request(app).get("/movies/movie-1/watchedBy").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([{ uid: "uid-2", displayName: "Rohan", watchedAt: watchedAt.toISOString() }]);
  });

  it("excludes a followed user who hasn't watched this movie", async () => {
    store.set("users/uid-1/following/uid-2", { createdAt: new Date() });
    store.set("users/uid-2", { displayName: "Rohan", listVisible: true });
    // no watched/movie-1 doc for uid-2

    const app = createApp();
    const res = await request(app).get("/movies/movie-1/watchedBy").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("excludes a user who watched it but isn't followed by the caller", async () => {
    store.set("users/uid-3", { displayName: "Stranger", listVisible: true });
    store.set("users/uid-3/watched/movie-1", { watchedAt: new Date(), visibility: "public" });
    // uid-1 does not follow uid-3

    const app = createApp();
    const res = await request(app).get("/movies/movie-1/watchedBy").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("excludes a followed user whose list-level watched-list visibility is off", async () => {
    store.set("users/uid-1/following/uid-2", { createdAt: new Date() });
    store.set("users/uid-2", { displayName: "Rohan", listVisible: false });
    store.set("users/uid-2/watched/movie-1", { watchedAt: new Date(), visibility: "public" });

    const app = createApp();
    const res = await request(app).get("/movies/movie-1/watchedBy").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("excludes a followed user's entry marked private, even though their list is otherwise public", async () => {
    store.set("users/uid-1/following/uid-2", { createdAt: new Date() });
    store.set("users/uid-2", { displayName: "Rohan", listVisible: true });
    store.set("users/uid-2/watched/movie-1", { watchedAt: new Date(), visibility: "private" });

    const app = createApp();
    const res = await request(app).get("/movies/movie-1/watchedBy").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});
