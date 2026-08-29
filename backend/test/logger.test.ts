import { describe, it, expect } from "vitest";
import { logger } from "../src/lib/logger.js";

describe("logger", () => {
  it("exposes the standard log-level methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("is silent in the test environment (doesn't throw, doesn't spam test output)", () => {
    expect(() => logger.info("test message")).not.toThrow();
    expect(() => logger.error("test error", { detail: "x" })).not.toThrow();
  });
});
