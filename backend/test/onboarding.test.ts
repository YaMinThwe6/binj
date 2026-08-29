import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

type DocData = Record<string, unknown>;
const store = new Map<string, DocData>();

function directChildren(path: string) {
  return [...store.entries()].filter(([key]) => {
    if (!key.startsWith(`${path}/`)) return false;
    return key.slice(path.length + 1).split("/").length === 1;
  });
}

function makeCollectionRef(path: string) {
  function query(state: {
    whereField?: string;
    whereOp?: string;
    whereValues?: string[];
    orderField?: string;
    dir?: "asc" | "desc";
    lim?: number;
  }) {
    return {
      where: (field: string, op: string, values: string | string[]) =>
        query({ ...state, whereField: field, whereOp: op, whereValues: Array.isArray(values) ? values : [values] }),
      orderBy: (field: string, dir: "asc" | "desc" = "asc") => query({ ...state, orderField: field, dir }),
      limit: (n: number) => query({ ...state, lim: n }),
      get: async () => {
        let entries = directChildren(path);
        if (state.whereField && state.whereValues) {
          entries = entries.filter(([, data]) => {
            const value = data[state.whereField!];
            if (state.whereOp === "array-contains-any") {
              const arr = (value as string[] | undefined) ?? [];
              return arr.some((v) => state.whereValues!.includes(v));
            }
            if (state.whereOp === "in") {
              return state.whereValues!.includes(value as string);
            }
            return true;
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
  return { ...query({}) };
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
  store.set("movies/dune", { title: "Dune: Part Two", genres: ["Sci-Fi"], originalLanguage: "en", voteAverage: 8.4 });
  store.set("movies/interstellar", { title: "Interstellar", genres: ["Sci-Fi", "Drama"], originalLanguage: "en", voteAverage: 8.6 });
  store.set("movies/parasite", { title: "Parasite", genres: ["Thriller", "Drama"], originalLanguage: "ko", voteAverage: 8.5 });
  store.set("movies/oldboy", { title: "Oldboy", genres: ["Thriller"], originalLanguage: "ko", voteAverage: 8.1 });
  store.set("movies/notebook", { title: "The Notebook", genres: ["Romance"], originalLanguage: "en", voteAverage: 7.8 });
});

function req(app: ReturnType<typeof createApp>, qs = "") {
  return request(app).get(`/onboarding/watched-candidates${qs}`).set("Authorization", "Bearer good");
}

describe("GET /onboarding/watched-candidates", () => {
  it("401s without a token", async () => {
    const app = createApp();
    const res = await request(app).get("/onboarding/watched-candidates");
    expect(res.status).toBe(401);
  });

  it("with neither genres nor languages: trending fallback, sorted by voteAverage desc", async () => {
    const app = createApp();
    const res = await req(app);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((m: { movieId: string }) => m.movieId)).toEqual([
      "interstellar",
      "parasite",
      "dune",
      "oldboy",
      "notebook"
    ]);
  });

  it("filters by genres only", async () => {
    const app = createApp();
    const res = await req(app, "?genres=Thriller");
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((m: { movieId: string }) => m.movieId)).toEqual(["parasite", "oldboy"]);
  });

  it("filters by languages only", async () => {
    const app = createApp();
    const res = await req(app, "?languages=ko");
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((m: { movieId: string }) => m.movieId)).toEqual(["parasite", "oldboy"]);
  });

  it("combines genres and languages (genre query, language filtered in-app)", async () => {
    const app = createApp();
    const res = await req(app, "?genres=Drama&languages=ko");
    expect(res.status).toBe(200);
    // Drama movies are interstellar(en) and parasite(ko) — only parasite matches both
    expect(res.body.data.items.map((m: { movieId: string }) => m.movieId)).toEqual(["parasite"]);
  });
});
