import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildSearchTerms } from "../src/lib/searchIndex.js";

type DocData = Record<string, unknown>;
const store = new Map<string, DocData>();
const batchOps: { path: string; data: DocData; opts?: { merge?: boolean } }[] = [];

function makeDocRef(path: string) {
  return {
    get: vi.fn(async () => ({ exists: store.has(path), data: () => store.get(path) })),
    set: vi.fn(async (value: DocData) => {
      store.set(path, value);
    })
  };
}

function directChildren(path: string) {
  return [...store.entries()].filter(([key]) => {
    if (!key.startsWith(`${path}/`)) return false;
    return key.slice(path.length + 1).split("/").length === 1;
  });
}

type Where = { field: string; op: string; value: unknown };

function matchWhere(data: DocData, w: Where): boolean {
  if (w.op === "array-contains-any") {
    const arr = (data[w.field] as unknown[] | undefined) ?? [];
    return (w.value as unknown[]).some((v) => arr.includes(v));
  }
  return true;
}

function collectionRef(path: string) {
  function query(state: { wheres?: Where[]; lim?: number }) {
    return {
      where: (field: string, op: string, value: unknown) => query({ ...state, wheres: [...(state.wheres ?? []), { field, op, value }] }),
      limit: (n: number) => query({ ...state, lim: n }),
      get: async () => {
        let entries = directChildren(path);
        for (const w of state.wheres ?? []) entries = entries.filter(([, data]) => matchWhere(data, w));
        if (state.lim) entries = entries.slice(0, state.lim);
        return {
          empty: entries.length === 0,
          docs: entries.map(([key, data]) => ({ id: key.split("/").pop()!, data: () => data }))
        };
      }
    };
  }
  return {
    doc: (id: string) => ({ ...makeDocRef(`${path}/${id}`), __path: `${path}/${id}` }),
    ...query({})
  };
}

const db = {
  collection: (name: string) => collectionRef(name),
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
  auth: { verifyIdToken: vi.fn() },
  db,
  requireDb: () => db,
  isFirebaseConfigured: () => true
}));

const fetchMovieDetails = vi.fn();
const searchMovies = vi.fn();
const getRecentMovies = vi.fn();

vi.mock("../src/lib/tmdb.js", () => ({ fetchMovieDetails, searchMovies, getRecentMovies }));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.clear();
  batchOps.length = 0;
  fetchMovieDetails.mockReset();
  searchMovies.mockReset();
  getRecentMovies.mockReset();
});

describe("GET /movies/:movieId", () => {
  it("returns the cached Firestore doc without hitting TMDB when it already exists", async () => {
    store.set("movies/27205", { title: "Inception (cached)" });
    const app = createApp();
    const res = await request(app).get("/movies/27205");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: "Inception (cached)" });
    expect(fetchMovieDetails).not.toHaveBeenCalled();
  });

  it("always includes binjRating and likeCount, defaulting to zero when absent from storage", async () => {
    store.set("movies/27205", { title: "Inception (cached), never rated or liked" });
    const app = createApp();
    const res = await request(app).get("/movies/27205");
    expect(res.body.data.binjRating).toEqual({ sum: 0, count: 0 });
    expect(res.body.data.likeCount).toBe(0);
  });

  it("preserves real binjRating and likeCount when they're already stored", async () => {
    store.set("movies/27205", { title: "Inception (rated)", binjRating: { sum: 12, count: 3 }, likeCount: 7 });
    const app = createApp();
    const res = await request(app).get("/movies/27205");
    expect(res.body.data.binjRating).toEqual({ sum: 12, count: 3 });
    expect(res.body.data.likeCount).toBe(7);
  });

  it("on a cache miss: fetches TMDB, stores the movie doc without the credits field, and upserts people docs", async () => {
    fetchMovieDetails.mockResolvedValueOnce({
      movieId: "27205",
      title: "Inception",
      originalLanguage: "en",
      genres: ["Sci-Fi"],
      cast: [{ personId: "6193", name: "Leonardo DiCaprio", character: "Cobb", photo: null }],
      crew: [],
      credits: [
        { personId: "6193", name: "Leonardo DiCaprio", photo: null, knownForDepartment: "Acting", popularity: 9.7 }
      ]
    });

    const app = createApp();
    const res = await request(app).get("/movies/27205");

    expect(res.status).toBe(200);
    expect(res.body.data.credits).toBeUndefined();
    expect(res.body.data.title).toBe("Inception");
    expect(res.body.data.binjRating).toEqual({ sum: 0, count: 0 });
    expect(res.body.data.likeCount).toBe(0);

    const movieDoc = store.get("movies/27205") as { credits?: unknown; title: string; titleSearchTerms?: string[] };
    expect(movieDoc.credits).toBeUndefined();
    expect(movieDoc.title).toBe("Inception");
    // A movie discovered via detail view (not search) becomes searchable too.
    expect(movieDoc.titleSearchTerms).toEqual(expect.arrayContaining(["i", "in", "inception"]));

    const personDoc = store.get("people/6193") as { name: string; popularity: number };
    expect(personDoc).toEqual({
      name: "Leonardo DiCaprio",
      photo: null,
      knownForDepartment: "Acting",
      popularity: 9.7,
      lastFetched: expect.any(Date)
    });
  });

  it("502s when TMDB fetch fails", async () => {
    fetchMovieDetails.mockRejectedValueOnce(new Error("boom"));
    const app = createApp();
    const res = await request(app).get("/movies/9999");
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("TMDB_UPSTREAM_ERROR");
  });
});

describe("GET /movies/recent", () => {
  it("is unauthenticated — no token required", async () => {
    getRecentMovies.mockResolvedValueOnce([])
    const app = createApp();
    const res = await request(app).get("/movies/recent");
    expect(res.status).toBe(200);
  });

  it("returns TMDB's now-playing list, not routed to GET /movies/:movieId", async () => {
    getRecentMovies.mockResolvedValueOnce([{ movieId: "27205", title: "Inception", poster: null, year: 2010 }]);
    const app = createApp();
    const res = await request(app).get("/movies/recent");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([{ movieId: "27205", title: "Inception", poster: null, year: 2010 }]);
    expect(fetchMovieDetails).not.toHaveBeenCalled(); // would fire if "recent" fell through to :movieId
  });

  it("reads the discover/recentMovies cache instead of hitting TMDB, once refreshRecentMovies.ts has populated it", async () => {
    store.set("discover/recentMovies", {
      items: [{ movieId: "cached-1", title: "Cached Movie", poster: null, year: 2026 }],
      updatedAt: new Date()
    });
    const app = createApp();
    const res = await request(app).get("/movies/recent");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([{ movieId: "cached-1", title: "Cached Movie", poster: null, year: 2026 }]);
    expect(getRecentMovies).not.toHaveBeenCalled();
  });

  it("502s when TMDB fails", async () => {
    getRecentMovies.mockRejectedValueOnce(new Error("boom"));
    const app = createApp();
    const res = await request(app).get("/movies/recent");
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("TMDB_UPSTREAM_ERROR");
  });
});

describe("GET /search/movies", () => {
  it("400s with no query", async () => {
    const app = createApp();
    const res = await request(app).get("/search/movies");
    expect(res.status).toBe(400);
  });

  it("matches via exact prefix, from Firestore, without calling TMDB", async () => {
    store.set("movies/157336", { title: "Interstellar", poster: null, year: 2014, titleSearchTerms: buildSearchTerms("Interstellar") });
    const app = createApp();
    const res = await request(app).get("/search/movies?q=inter");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([{ movieId: "157336", title: "Interstellar", poster: null, year: 2014 }]);
    expect(searchMovies).not.toHaveBeenCalled();
  });

  it("matches via a precomputed single-typo variant, from Firestore, without calling TMDB", async () => {
    store.set("movies/157336", { title: "Interstellar", poster: null, year: 2014, titleSearchTerms: buildSearchTerms("Interstellar") });
    const app = createApp();
    const res = await request(app).get("/search/movies?q=intersteller"); // the exact motivating example

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([{ movieId: "157336", title: "Interstellar", poster: null, year: 2014 }]);
    expect(searchMovies).not.toHaveBeenCalled();
  });

  it("ranks an exact-prefix match above a typo-variant-only match", async () => {
    // "cot" is a real prefix of nothing here, but is a substitution-typo variant of "cat" —
    // and separately a real prefix of "Cotton Club". Exact should outrank typo.
    store.set("movies/1", { title: "Cotton Club", poster: null, year: 1984, titleSearchTerms: buildSearchTerms("Cotton Club") });
    store.set("movies/2", { title: "Cat People", poster: null, year: 1982, titleSearchTerms: buildSearchTerms("Cat People") });
    const app = createApp();
    const res = await request(app).get("/search/movies?q=cot");

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].title).toBe("Cotton Club"); // exact prefix match, ranked first
  });

  it("falls back to real-time Levenshtein over the local catalog when the indexed lookup finds nothing", async () => {
    // Two substitutions away from "interstellar" (i->e at the start, a->o near
    // the end) -- edit distance 2, outside what the precomputed single-typo
    // variants (edit distance 1 only) cover.
    store.set("movies/157336", { title: "Interstellar", poster: null, year: 2014, titleSearchTerms: buildSearchTerms("Interstellar") });
    const app = createApp();
    const res = await request(app).get("/search/movies?q=enterstellor");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([{ movieId: "157336", title: "Interstellar", poster: null, year: 2014 }]);
    expect(searchMovies).not.toHaveBeenCalled();
  });

  it("falls back to live TMDB when nothing matches locally at all, and upserts the result for next time", async () => {
    searchMovies.mockResolvedValueOnce([{ movieId: "27205", title: "Inception", poster: null, year: 2010 }]);
    const app = createApp();
    const res = await request(app).get("/search/movies?q=zzzznotarealtitle");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([{ movieId: "27205", title: "Inception", poster: null, year: 2010 }]);
    expect(searchMovies).toHaveBeenCalledWith("zzzznotarealtitle");

    const upserted = store.get("movies/27205") as { title: string; titleSearchTerms: string[] };
    expect(upserted.title).toBe("Inception");
    expect(upserted.titleSearchTerms).toEqual(expect.arrayContaining(["i", "in", "inception"]));
  });

  it("502s when TMDB fails on the live fallback", async () => {
    searchMovies.mockRejectedValueOnce(new Error("boom"));
    const app = createApp();
    const res = await request(app).get("/search/movies?q=zzzznotarealtitle");
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("TMDB_UPSTREAM_ERROR");
  });

  it("ranks 'The Dark Knight' first for query 'dark knight' even when a weaker match is far more popular", async () => {
    store.set("movies/155", { title: "The Dark Knight", poster: null, year: 2008, voteCount: 100, titleSearchTerms: buildSearchTerms("The Dark Knight") });
    store.set("movies/49026", { title: "The Dark Knight Rises", poster: null, year: 2012, voteCount: 50, titleSearchTerms: buildSearchTerms("The Dark Knight Rises") });
    // Batman has no textual relation to "dark knight" beyond nothing at all here — given
    // a huge popularity edge, to prove it still can't out-rank an actual textual match.
    store.set("movies/268", { title: "Batman", poster: null, year: 1989, voteCount: 1_000_000, titleSearchTerms: buildSearchTerms("Batman") });

    const app = createApp();
    const res = await request(app).get("/search/movies?q=dark%20knight");

    expect(res.status).toBe(200);
    const titles = res.body.data.items.map((m: { title: string }) => m.title);
    expect(titles[0]).toBe("The Dark Knight");
    expect(titles[1]).toBe("The Dark Knight Rises");
    expect(titles).not.toContain("Batman"); // no textual match at all -> excluded, popularity doesn't buy it a spot
  });
});
