import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

type DocData = Record<string, unknown>;
const store = new Map<string, DocData>();

function makeDocRef(path: string) {
  return {
    id: path.split("/").pop()!,
    get: vi.fn(async () => ({
      exists: store.has(path),
      id: path.split("/").pop()!,
      data: () => store.get(path)
    })),
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
  function query(state: {
    whereField?: string;
    whereValues?: string[];
    orderField?: string;
    dir?: "asc" | "desc";
    lim?: number;
  }) {
    return {
      where: (field: string, _op: string, values: string[]) => query({ ...state, whereField: field, whereValues: values }),
      orderBy: (field: string, dir: "asc" | "desc" = "asc") => query({ ...state, orderField: field, dir }),
      limit: (n: number) => query({ ...state, lim: n }),
      get: async () => {
        let entries = directChildren(path);
        if (state.whereField && state.whereValues) {
          entries = entries.filter(([, data]) => {
            const arr = (data[state.whereField!] as string[] | undefined) ?? [];
            return arr.some((v) => state.whereValues!.includes(v));
          });
        }
        if (state.orderField) {
          const field = state.orderField;
          entries = entries.sort((a, b) => {
            const av = (a[1][field] as number) ?? 0;
            const bv = (b[1][field] as number) ?? 0;
            return state.dir === "desc" ? bv - av : av - bv;
          });
        }
        if (state.lim) entries = entries.slice(0, state.lim);
        return { docs: entries.map(([key, data]) => ({ id: key.split("/").pop()!, data: () => data })) };
      }
    };
  }

  return {
    doc: (id: string) => makeDocRef(`${path}/${id}`),
    ...query({})
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
  store.set("movies/dune", { title: "Dune: Part Two", genres: ["Sci-Fi", "Adventure"], voteAverage: 8.4 });
  store.set("movies/interstellar", { title: "Interstellar", genres: ["Sci-Fi", "Drama"], voteAverage: 8.6 });
  store.set("movies/inception", { title: "Inception", genres: ["Sci-Fi", "Thriller"], voteAverage: 8.3 });
  store.set("movies/notebook", { title: "The Notebook", genres: ["Romance", "Drama"], voteAverage: 7.8 });
  store.set("movies/whiplash", { title: "Whiplash", genres: ["Drama", "Music"], voteAverage: 8.5 });
});

function req(app: ReturnType<typeof createApp>) {
  return request(app).get("/recommendations").set("Authorization", "Bearer good");
}

describe("GET /recommendations", () => {
  it("401s without a token", async () => {
    const app = createApp();
    const res = await request(app).get("/recommendations");
    expect(res.status).toBe(401);
  });

  it("cold start (no watch history, no favoriteGenres): falls back to trending, sorted by voteAverage desc", async () => {
    store.set("users/uid-1", { favoriteGenres: null });
    const app = createApp();
    const res = await req(app);

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((m: { movieId: string }) => m.movieId)).toEqual([
      "interstellar",
      "whiplash",
      "dune",
      "inception",
      "notebook"
    ]);
  });

  it("uses favoriteGenres when there's no watch history yet", async () => {
    store.set("users/uid-1", { favoriteGenres: ["Romance"] });
    const app = createApp();
    const res = await req(app);

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((m: { movieId: string }) => m.movieId)).toEqual(["notebook"]);
  });

  it("derives preferred genres from watched-movie frequency when history exists", async () => {
    store.set("users/uid-1", { favoriteGenres: ["Romance"] }); // should be ignored — watch history takes priority
    store.set("users/uid-1/watched/inception", { watchedAt: new Date(), visibility: "public" });
    const app = createApp();
    const res = await req(app);

    expect(res.status).toBe(200);
    const ids = res.body.data.items.map((m: { movieId: string }) => m.movieId);
    // Inception is Sci-Fi/Thriller — sci-fi titles should surface, romance should not
    expect(ids).toContain("dune");
    expect(ids).toContain("interstellar");
    expect(ids).not.toContain("notebook");
  });

  it("computes matchScore against the preference signal, null for the trending fallback", async () => {
    store.set("users/uid-1", { favoriteGenres: null });
    const trendingRes = await req(createApp());
    expect(trendingRes.body.data.items.every((m: { matchScore: unknown }) => m.matchScore === null)).toBe(true);

    store.set("users/uid-1", { favoriteGenres: ["Romance"] });
    const preferredRes = await req(createApp());
    const notebook = preferredRes.body.data.items.find((m: { movieId: string }) => m.movieId === "notebook");
    expect(notebook.matchScore).toBeGreaterThan(0);
    expect(notebook.matchScore).toBeLessThanOrEqual(100);
  });

  it("excludes movies already watched or watchlisted", async () => {
    store.set("users/uid-1", { favoriteGenres: null });
    store.set("users/uid-1/watched/interstellar", { watchedAt: new Date(), visibility: "public" });
    store.set("users/uid-1/watchlist/whiplash", { addedAt: new Date() });
    const app = createApp();
    const res = await req(app);

    const ids = res.body.data.items.map((m: { movieId: string }) => m.movieId);
    expect(ids).not.toContain("interstellar");
    expect(ids).not.toContain("whiplash");
  });
});

describe("GET /movies/:movieId/similar", () => {
  it("is reachable without a token — movie detail's right rail is public like the movie page itself", async () => {
    const res = await request(createApp()).get("/movies/dune/similar");
    expect(res.status).toBe(200);
  });

  it("404s for a nonexistent movie", async () => {
    const res = await request(createApp()).get("/movies/nope/similar");
    expect(res.status).toBe(404);
  });

  it("returns other movies sharing at least one genre, sorted by rating, excluding itself", async () => {
    const res = await request(createApp()).get("/movies/dune/similar"); // Sci-Fi, Adventure
    expect(res.status).toBe(200);
    const ids = res.body.data.items.map((m: { movieId: string }) => m.movieId);
    expect(ids).not.toContain("dune");
    expect(ids).toEqual(["interstellar", "inception"]); // both Sci-Fi, sorted by voteAverage desc; notebook/whiplash share no genre with dune
  });

  it("returns an empty list for a movie with no genres on record", async () => {
    store.set("movies/no-genres", { title: "Mystery Movie", genres: [], voteAverage: 5 });
    const res = await request(createApp()).get("/movies/no-genres/similar");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});
