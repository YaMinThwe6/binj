import { describe, it, expect } from "vitest";
import { rankCandidate } from "../src/lib/searchRanking.js";

describe("rankCandidate — match type classification", () => {
  it("classifies a whole-string match as exact", () => {
    expect(rankCandidate("bat", { title: "Bat" }).matchType).toBe("exact");
  });

  it("classifies a whole-title prefix as prefix", () => {
    expect(rankCandidate("inter", { title: "Interstellar" }).matchType).toBe("prefix");
    expect(rankCandidate("bat", { title: "Batman" }).matchType).toBe("prefix");
  });

  it("classifies matching individual words (not a leading title prefix) as token", () => {
    expect(rankCandidate("dark knight", { title: "The Dark Knight" }).matchType).toBe("token");
  });

  it("classifies a single-typo query word as fuzzy1", () => {
    expect(rankCandidate("intersteller", { title: "Interstellar" }).matchType).toBe("fuzzy1");
  });

  it("classifies an unrelated title as none", () => {
    expect(rankCandidate("intersteller", { title: "The Godfather" }).matchType).toBe("none");
  });

  it("classifies an exact alias/alternate-title match as alias", () => {
    const result = rankCandidate("sen to chihiro", { title: "Spirited Away", aliases: ["Sen to Chihiro no Kamikakushi"] });
    expect(result.matchType).toBe("alias");
  });

  it("still returns none for a title with no aliases and no textual relation to the query", () => {
    expect(rankCandidate("sen to chihiro", { title: "The Godfather" }).matchType).toBe("none");
  });
});

describe("rankCandidate — tier dominance (textual relevance over popularity)", () => {
  it("ranks 'The Dark Knight' above 'The Dark Knight Rises' above 'Batman' for query 'dark knight', regardless of popularity", () => {
    const darkKnight = rankCandidate("dark knight", { title: "The Dark Knight", popularitySignal: 10 });
    const darkKnightRises = rankCandidate("dark knight", { title: "The Dark Knight Rises", popularitySignal: 10 });
    // Batman is given a huge popularity advantage on purpose -- it must not matter.
    const batman = rankCandidate("dark knight", { title: "Batman", popularitySignal: 1_000_000 });

    expect(darkKnight.score).toBeGreaterThan(darkKnightRises.score);
    expect(darkKnightRises.score).toBeGreaterThan(batman.score);
    expect(batman.matchType).not.toBe("token");
  });

  it("never lets a fuzzy match outrank an exact or prefix match, no matter the popularity gap", () => {
    const batman = rankCandidate("bat", { title: "Batman", popularitySignal: 1 }); // prefix
    const bat = rankCandidate("bat", { title: "Bat", popularitySignal: 1 }); // exact
    const fuzzyUnrelated = rankCandidate("bat", { title: "Cat", popularitySignal: 1_000_000 }); // fuzzy1, huge popularity

    expect(bat.score).toBeGreaterThan(batman.score); // exact still beats prefix
    expect(batman.score).toBeGreaterThan(fuzzyUnrelated.score);
    expect(bat.score).toBeGreaterThan(fuzzyUnrelated.score);
  });

  it("scores a query with one exact word + one fuzzy-typo word as a strong token match, not demoted to the fuzzy tier", () => {
    const result = rankCandidate("dark knigt", { title: "The Dark Knight" });
    expect(result.matchType).toBe("token"); // "dark" resolves exactly, "knigt" resolves fuzzily to "knight"
    expect(result.score).toBeGreaterThan(rankCandidate("knigt", { title: "Interstellar" }).score); // sanity: still beats an unrelated fuzzy-only match
  });

  it("uses popularity only as a tie-break among equally strong prefix matches", () => {
    const unpopular = rankCandidate("inter", { title: "Interstellar", popularitySignal: 1 });
    const popular = rankCandidate("inter", { title: "International", popularitySignal: 1000 });
    expect(unpopular.matchType).toBe("prefix");
    expect(popular.matchType).toBe("prefix");
    expect(popular.score).toBeGreaterThan(unpopular.score); // same tier -> popularity breaks the tie
  });
});

describe("rankCandidate — determinism", () => {
  it("returns the exact same score for the same query and candidate on repeated calls", () => {
    const a = rankCandidate("dark knight", { title: "The Dark Knight", popularitySignal: 42 });
    const b = rankCandidate("dark knight", { title: "The Dark Knight", popularitySignal: 42 });
    expect(a).toEqual(b);
  });
});
