import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

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

const db = {
  collection: (name: string) => ({
    doc: (id: string) => ({ ...makeDocRef(`${name}/${id}`), __path: `${name}/${id}` })
  }),
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
  isFirebaseConfigured: () => true
}));

const fetchMovieDetails = vi.fn();
const searchMovies = vi.fn();

vi.mock("../src/lib/tmdb.js", () => ({ fetchMovieDetails, searchMovies }));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.clear();
  batchOps.length = 0;
  fetchMovieDetails.mockReset();
  searchMovies.mockReset();
});

describe("GET /movies/:movieId", () => {
  it("returns the cached Firestore doc without hitting TMDB when it already exists", async () => {
    store.set("movies/27205", { title: "Inception (cached)" });
    const app = createApp();
    const res = await request(app).get("/movies/27205");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Inception (cached)" });
    expect(fetchMovieDetails).not.toHaveBeenCalled();
  });

  it("always includes binjRating and likeCount, defaulting to zero when absent from storage", async () => {
    store.set("movies/27205", { title: "Inception (cached), never rated or liked" });
    const app = createApp();
    const res = await request(app).get("/movies/27205");
    expect(res.body.binjRating).toEqual({ sum: 0, count: 0 });
    expect(res.body.likeCount).toBe(0);
  });

  it("preserves real binjRating and likeCount when they're already stored", async () => {
    store.set("movies/27205", { title: "Inception (rated)", binjRating: { sum: 12, count: 3 }, likeCount: 7 });
    const app = createApp();
    const res = await request(app).get("/movies/27205");
    expect(res.body.binjRating).toEqual({ sum: 12, count: 3 });
    expect(res.body.likeCount).toBe(7);
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
    expect(res.body.credits).toBeUndefined();
    expect(res.body.title).toBe("Inception");
    expect(res.body.binjRating).toEqual({ sum: 0, count: 0 });
    expect(res.body.likeCount).toBe(0);

    const movieDoc = store.get("movies/27205") as { credits?: unknown; title: string };
    expect(movieDoc.credits).toBeUndefined();
    expect(movieDoc.title).toBe("Inception");

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
    expect(res.body.error.code).toBe("TMDB_UPSTREAM_ERROR");
  });
});

describe("GET /search/movies", () => {
  it("400s with no query", async () => {
    const app = createApp();
    const res = await request(app).get("/search/movies");
    expect(res.status).toBe(400);
  });

  it("returns TMDB search results", async () => {
    searchMovies.mockResolvedValueOnce([{ movieId: "27205", title: "Inception", poster: null, year: 2010 }]);
    const app = createApp();
    const res = await request(app).get("/search/movies?q=inception");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });
});
