import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildSearchTerms } from "../src/lib/searchIndex.js";

type DocData = Record<string, unknown>;
const store = new Map<string, DocData>();
const batchOps: { path: string; data: DocData; opts?: { merge?: boolean } }[] = [];

function makeDocRef(path: string) {
  return {
    __path: path,
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
    }),
    // Only "array-contains-any" is implemented — the one operator
    // people.service.ts's searchPeopleService actually issues.
    where: (field: string, op: string, value: unknown[]) => ({
      get: async () => {
        const entries = directChildren(path).filter(([, data]) => {
          if (op !== "array-contains-any") return false;
          const fieldValue = data[field];
          return Array.isArray(fieldValue) && value.some((v) => fieldValue.includes(v));
        });
        return { docs: entries.map(([key, data]) => ({ id: key.split("/").pop()!, data: () => data })) };
      }
    })
  };
}

const db = {
  collection: (name: string) => makeCollectionRef(name),
  // Needed for getMovieDetail's people-credits upsert, reached whenever
  // celebrity-suggestions falls through to a genre/language discover page.
  batch: () => ({
    set: (ref: { __path: string }, data: DocData, opts?: { merge?: boolean }) => {
      batchOps.push({ path: ref.__path, data, opts });
    },
    commit: vi.fn(async () => {
      for (const op of batchOps) {
        const existing = store.get(op.path) ?? {};
        store.set(op.path, op.opts?.merge ? { ...existing, ...op.data } : op.data);
      }
      batchOps.length = 0;
    })
  })
};

vi.mock("../src/lib/firebaseAdmin.js", () => ({
  auth: { verifyIdToken: vi.fn(async () => ({ uid: "uid-1" })) },
  db,
  requireDb: () => db,
  isFirebaseConfigured: () => true
}));

const discoverMovies = vi.fn();
const fetchMovieDetails = vi.fn();
vi.mock("../src/lib/tmdb.js", () => ({ discoverMovies, fetchMovieDetails, searchMovies: vi.fn(), getRecentMovies: vi.fn() }));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.clear();
  batchOps.length = 0;
  discoverMovies.mockReset();
  fetchMovieDetails.mockReset();
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
  it("page 1: still an empty list when there's no watch history yet, but offers a next (genre/language) page", async () => {
    const app = createApp();
    const res = await request(app).get("/onboarding/celebrity-suggestions").set("Authorization", "Bearer good");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    // No longer a dead end: page 2 falls through to genre/language discovery
    // below, so watch history being empty doesn't leave this step with
    // nothing to suggest at all.
    expect(res.body.data.nextCursor).toBe("1");
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

  it("a cursor page ranks people from genre/language-filtered movies that are already locally cached", async () => {
    discoverMovies.mockResolvedValueOnce({
      items: [
        { movieId: "1", title: "Movie One", poster: null, year: 2020, genres: ["Drama"], originalLanguage: "en", voteAverage: 7 },
        { movieId: "2", title: "Movie Two", poster: null, year: 2020, genres: ["Drama"], originalLanguage: "en", voteAverage: 7 }
      ],
      totalPages: 3
    });
    // Both already fully detail-fetched locally (genres present) — this is
    // the fast path: no TMDB detail call needed to read their cast/crew.
    store.set("movies/1", { genres: ["Drama"], cast: [{ personId: "p1", name: "Shared Actor", photo: null }], crew: [{ personId: "p2", name: "Director One", photo: null }] });
    store.set("movies/2", { genres: ["Drama"], cast: [{ personId: "p1", name: "Shared Actor", photo: null }], crew: [] });

    const app = createApp();
    const res = await request(app)
      .get("/onboarding/celebrity-suggestions?genres=Drama&cursor=1")
      .set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(discoverMovies).toHaveBeenCalledWith(["Drama"], [], 1);
    expect(fetchMovieDetails).not.toHaveBeenCalled();
    expect(res.body.data.items[0]).toEqual({ personId: "p1", name: "Shared Actor", photo: null, appearsIn: 2 });
    expect(res.body.data.items[1]).toEqual({ personId: "p2", name: "Director One", photo: null, appearsIn: 1 });
    expect(res.body.data.nextCursor).toBe("2");
  });

  it("a cursor page skips a not-yet-cached movie for this response, but backfills it in the background", async () => {
    discoverMovies.mockResolvedValueOnce({
      items: [{ movieId: "9", title: "Unseen Movie", poster: null, year: 2020, genres: ["Drama"], originalLanguage: "en", voteAverage: 7 }],
      totalPages: 1
    });
    fetchMovieDetails.mockResolvedValueOnce({
      movieId: "9",
      title: "Unseen Movie",
      poster: null,
      year: 2020,
      originalLanguage: "en",
      genres: ["Drama"],
      voteAverage: 7,
      cast: [{ personId: "p9", name: "New Actor", photo: null }],
      crew: [],
      credits: []
    });

    const app = createApp();
    const res = await request(app)
      .get("/onboarding/celebrity-suggestions?genres=Drama&cursor=1")
      .set("Authorization", "Bearer good");

    expect(res.body.data.items).toEqual([]); // nothing to rank from yet — not cached at request time
    await new Promise((resolve) => setTimeout(resolve, 20)); // fire-and-forget backfill's microtask chain
    expect(fetchMovieDetails).toHaveBeenCalledWith("9");
    expect((store.get("movies/9") as { genres?: string[] })?.genres).toEqual(["Drama"]);
  });

  it("a cursor page returns nextCursor: null once TMDB's own totalPages is exhausted", async () => {
    discoverMovies.mockResolvedValueOnce({ items: [], totalPages: 2 });

    const app = createApp();
    const res = await request(app).get("/onboarding/celebrity-suggestions?cursor=2").set("Authorization", "Bearer good");

    expect(res.body.data.nextCursor).toBeNull();
  });
});

describe("GET /people/search", () => {
  it("401s without a token", async () => {
    const app = createApp();
    const res = await request(app).get("/people/search?q=leo");
    expect(res.status).toBe(401);
  });

  it("400s when q is missing", async () => {
    const app = createApp();
    const res = await request(app).get("/people/search").set("Authorization", "Bearer good");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_QUERY");
  });

  it("finds a person by name and returns personId/name/photo only", async () => {
    store.set("people/p1", { name: "Leonardo DiCaprio", photo: "/leo.jpg", popularity: 40, nameSearchTerms: buildSearchTerms("Leonardo DiCaprio") });

    const app = createApp();
    const res = await request(app).get("/people/search?q=leo").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([{ personId: "p1", name: "Leonardo DiCaprio", photo: "/leo.jpg" }]);
  });

  it("excludes people whose name doesn't match at all", async () => {
    store.set("people/p1", { name: "Leonardo DiCaprio", photo: null, popularity: 40, nameSearchTerms: buildSearchTerms("Leonardo DiCaprio") });
    store.set("people/p2", { name: "Meryl Streep", photo: null, popularity: 30, nameSearchTerms: buildSearchTerms("Meryl Streep") });

    const app = createApp();
    const res = await request(app).get("/people/search?q=leo").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((p: { personId: string }) => p.personId)).toEqual(["p1"]);
  });

  it("ranks an exact/prefix match above a token-only match", async () => {
    store.set("people/exact", { name: "Chris Evans", photo: null, popularity: 10, nameSearchTerms: buildSearchTerms("Chris Evans") });
    store.set("people/token", { name: "Bradley Chris Cooper", photo: null, popularity: 90, nameSearchTerms: buildSearchTerms("Bradley Chris Cooper") });

    const app = createApp();
    const res = await request(app).get("/people/search?q=chris").set("Authorization", "Bearer good");

    expect(res.status).toBe(200);
    // "Chris Evans" starts with the query (prefix match) — outranks
    // "Bradley Chris Cooper" (token-only match) regardless of popularity.
    expect(res.body.data.items[0].personId).toBe("exact");
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
