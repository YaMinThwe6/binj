import { describe, it, expect } from "vitest";
import { jaccard } from "../scripts/computeTasteMatches.js";

describe("jaccard", () => {
  it("is 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });

  it("is 0 for disjoint sets", () => {
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("is 0 for two empty sets (no signal, not a match)", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("computes intersection-over-union for partial overlap", () => {
    // {a,b,c} vs {b,c,d} — intersection {b,c}=2, union {a,b,c,d}=4 → 0.5
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]))).toBe(0.5);
  });

  it("is symmetric", () => {
    const a = new Set(["a", "b", "c"]);
    const b = new Set(["b", "c", "d", "e"]);
    expect(jaccard(a, b)).toBe(jaccard(b, a));
  });
});
