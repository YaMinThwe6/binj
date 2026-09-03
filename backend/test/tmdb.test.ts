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

describe("tmdb.discoverMovies", () => {
  it("translates genre names to TMDB's genre ids and passes the page through", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            id: 157336,
            title: "Interstellar",
            poster_path: "/poster.jpg",
            release_date: "2014-11-05",
            genre_ids: [878, 18],
            original_language: "en",
            vote_average: 8.4
          }
        ],
        total_pages: 12
      })
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { discoverMovies } = await import("../src/lib/tmdb.js");
    const result = await discoverMovies(["Science Fiction", "Drama"], [], 3);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/discover/movie?");
    expect(url).toContain("with_genres=878%2C18");
    expect(url).toContain("page=3");
    expect(result).toEqual({
      items: [
        {
          movieId: "157336",
          title: "Interstellar",
          poster: "/poster.jpg",
          year: 2014,
          genres: ["Science Fiction", "Drama"],
          originalLanguage: "en",
          voteAverage: 8.4
        }
      ],
      totalPages: 12
    });
  });

  it("passes with_original_language only when exactly one language is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [], total_pages: 1 }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { discoverMovies } = await import("../src/lib/tmdb.js");
    await discoverMovies([], ["ko"], 1);
    expect(fetchMock.mock.calls[0][0]).toContain("with_original_language=ko");

    fetchMock.mockClear();
    await discoverMovies([], ["ko", "ja"], 1);
    expect(fetchMock.mock.calls[0][0]).not.toContain("with_original_language");
  });

  it("defaults totalPages to 1 and drops unrecognized genre names", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [] }) }) as unknown as typeof fetch;

    const { discoverMovies } = await import("../src/lib/tmdb.js");
    const result = await discoverMovies(["Not A Real Genre"], [], 1);

    expect(result).toEqual({ items: [], totalPages: 1 });
  });
});
