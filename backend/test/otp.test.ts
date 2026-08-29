import { describe, it, expect } from "vitest";
import { generateCode, hashCode } from "../src/lib/otp.js";

describe("generateCode", () => {
  it("always returns a zero-padded 6-digit numeric string", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashCode", () => {
  it("is deterministic for the same input", () => {
    expect(hashCode("123456")).toBe(hashCode("123456"));
  });

  it("produces different hashes for different codes", () => {
    expect(hashCode("123456")).not.toBe(hashCode("654321"));
  });

  it("never returns the raw code", () => {
    expect(hashCode("123456")).not.toBe("123456");
  });
});
