import { describe, it, expect, vi, afterEach } from "vitest";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("tmdb.searchMovies", () => {
  it("maps TMDB's raw search results, including vote_count as voteCount — the local+TMDB merged search's popularity tie-break signal", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { id: 27205, title: "Inception", poster_path: "/poster.jpg", release_date: "2010-07-15", vote_count: 34000 }
        ]
      })
    }) as unknown as typeof fetch;

    const { searchMovies } = await import("../src/lib/tmdb.js");
    const items = await searchMovies("inception");

    expect(items).toEqual([{ movieId: "27205", title: "Inception", poster: "/poster.jpg", year: 2010, voteCount: 34000 }]);
  });

  it("defaults voteCount to 0 when TMDB omits it", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: 1, title: "Untitled", poster_path: null, release_date: null }] })
    }) as unknown as typeof fetch;

    const { searchMovies } = await import("../src/lib/tmdb.js");
    const items = await searchMovies("untitled");

    expect(items[0].voteCount).toBe(0);
  });
});
