import { describe, it, expect } from "vitest";
import { normalizeWord, significantWords, wordPrefixes, typoVariants, buildSearchTerms } from "../src/lib/searchIndex.js";

describe("normalizeWord", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeWord("Dune:")).toBe("dune");
    expect(normalizeWord("Spider-Man")).toBe("spiderman");
  });
});

describe("significantWords", () => {
  it("splits a title into normalized, non-empty words", () => {
    expect(significantWords("The Dark Knight")).toEqual(["the", "dark", "knight"]);
  });

  it("drops empty tokens from punctuation-only fragments", () => {
    expect(significantWords("Dune: Part Two")).toEqual(["dune", "part", "two"]);
  });
});

describe("wordPrefixes", () => {
  it("returns every prefix from length 1 to the full word", () => {
    expect(wordPrefixes("cat")).toEqual(["c", "ca", "cat"]);
  });
});

describe("typoVariants", () => {
  it("includes a deletion (missing letter)", () => {
    expect(typoVariants("cat")).toContain("at"); // missing 'c'
    expect(typoVariants("cat")).toContain("ct"); // missing 'a'
  });

  it("includes a substitution (wrong letter)", () => {
    expect(typoVariants("cat")).toContain("bat"); // 'c' -> 'b'
    expect(typoVariants("cat")).toContain("cot"); // 'a' -> 'o'
  });

  it("includes an adjacent transposition (swapped letters)", () => {
    expect(typoVariants("cat")).toContain("act"); // swap 'c' and 'a'
  });

  it("never includes the correct spelling itself", () => {
    expect(typoVariants("cat")).not.toContain("cat");
  });

  it("returns nothing for words shorter than 2 characters", () => {
    expect(typoVariants("a")).toEqual([]);
    expect(typoVariants("")).toEqual([]);
  });

  it("reproduces the exact real-world case this was built for: interstellar -> intersteller", () => {
    expect(typoVariants("interstellar")).toContain("intersteller");
  });
});

describe("buildSearchTerms", () => {
  it("unions every word's prefixes and typo variants into one deduped array", () => {
    const terms = buildSearchTerms("Cat");
    expect(terms).toEqual(expect.arrayContaining(["c", "ca", "cat", "bat", "act"]));
    expect(new Set(terms).size).toBe(terms.length); // no duplicates
  });

  it("covers every word in a multi-word title", () => {
    const terms = buildSearchTerms("Dune Two");
    expect(terms).toEqual(expect.arrayContaining(["dune", "two", "tune", "dun"]));
  });
});
