import { describe, it, expect } from "vitest";
import { encodeGeohash, geohashPrecisionForRadiusKm, geohashPrefixRange, haversineDistanceKm } from "../src/lib/geohash.js";

describe("encodeGeohash", () => {
  it("matches the canonical geohash.org reference vector", () => {
    expect(encodeGeohash(42.6, -5.6, 5)).toBe("ezs42");
  });

  it("is deterministic and stable across calls", () => {
    expect(encodeGeohash(12.34, 56.78, 9)).toBe(encodeGeohash(12.34, 56.78, 9));
  });

  it("nearby points share a longer common prefix than distant points", () => {
    const base = encodeGeohash(37.7749, -122.4194, 9); // San Francisco
    const nearby = encodeGeohash(37.775, -122.4195, 9); // ~10m away
    const farAway = encodeGeohash(28.6139, 77.209, 9); // New Delhi

    function commonPrefixLength(a: string, b: string): number {
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      return i;
    }

    expect(commonPrefixLength(base, nearby)).toBeGreaterThan(commonPrefixLength(base, farAway));
  });

  it("respects the requested precision (output length)", () => {
    expect(encodeGeohash(0, 0, 3)).toHaveLength(3);
    expect(encodeGeohash(0, 0, 9)).toHaveLength(9);
  });
});

describe("geohashPrecisionForRadiusKm", () => {
  it("picks a coarser (shorter) precision for a larger radius", () => {
    const p1 = geohashPrecisionForRadiusKm(1);
    const p100 = geohashPrecisionForRadiusKm(100);
    expect(p100).toBeLessThan(p1);
  });

  it("stays within the valid 1-9 precision range for extreme inputs", () => {
    expect(geohashPrecisionForRadiusKm(0.001)).toBeGreaterThanOrEqual(1);
    expect(geohashPrecisionForRadiusKm(0.001)).toBeLessThanOrEqual(9);
    expect(geohashPrecisionForRadiusKm(10000)).toBeGreaterThanOrEqual(1);
    expect(geohashPrecisionForRadiusKm(10000)).toBeLessThanOrEqual(9);
  });
});

describe("geohashPrefixRange", () => {
  it("returns a [start, end) range where every string starting with the prefix falls inside", () => {
    const { start, end } = geohashPrefixRange("u4pr");
    expect("u4pr" >= start).toBe(true);
    expect("u4pruydqqvj" >= start).toBe(true);
    expect("u4pruydqqvj" < end).toBe(true);
  });

  it("excludes a sibling prefix that sorts after it", () => {
    const { end } = geohashPrefixRange("u4pr");
    expect("u4ps" < end).toBe(false);
  });
});

describe("haversineDistanceKm", () => {
  it("returns ~0 for the same point", () => {
    expect(haversineDistanceKm(12.9716, 77.5946, 12.9716, 77.5946)).toBeCloseTo(0, 5);
  });

  it("matches the well-known Bangalore-to-Chennai distance within a reasonable tolerance", () => {
    // Bangalore (12.9716, 77.5946) -> Chennai (13.0827, 80.2707), real distance ~290km
    const km = haversineDistanceKm(12.9716, 77.5946, 13.0827, 80.2707);
    expect(km).toBeGreaterThan(280);
    expect(km).toBeLessThan(300);
  });

  it("is symmetric", () => {
    const a = haversineDistanceKm(10, 20, 30, 40);
    const b = haversineDistanceKm(30, 40, 10, 20);
    expect(a).toBeCloseTo(b, 9);
  });
});
