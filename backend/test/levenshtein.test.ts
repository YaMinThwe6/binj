import { describe, it, expect } from "vitest";
import { levenshteinDistance } from "../src/lib/levenshtein.js";

describe("levenshteinDistance", () => {
  it("is 0 for identical strings", () => {
    expect(levenshteinDistance("interstellar", "interstellar")).toBe(0);
  });

  it("counts a single substitution as distance 1", () => {
    expect(levenshteinDistance("interstellar", "intersteller")).toBe(1);
  });

  it("counts a single deletion as distance 1", () => {
    expect(levenshteinDistance("cat", "ct")).toBe(1);
  });

  it("counts a single insertion as distance 1", () => {
    expect(levenshteinDistance("cat", "cats")).toBe(1);
  });

  it("handles two separate edits", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3); // the textbook example
  });

  it("handles an empty string against a non-empty one", () => {
    expect(levenshteinDistance("", "cat")).toBe(3);
    expect(levenshteinDistance("cat", "")).toBe(3);
  });
});
