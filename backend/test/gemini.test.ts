import { describe, it, expect, vi, beforeEach } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  Type: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    INTEGER: "INTEGER",
    BOOLEAN: "BOOLEAN"
  }
}));

vi.mock("../src/lib/env.js", () => ({
  env: { GEMINI_API_KEY: "fake-key" },
  geminiConfigured: true
}));

const { moderateContent } = await import("../src/lib/gemini.js");

beforeEach(() => {
  generateContent.mockReset();
});

const validDecision = {
  violates: true,
  category: "harassment",
  contentAction: "remove",
  accountAction: "warn",
  suspensionDays: null,
  confidence: 0.8,
  rationale: "Direct harassment."
};

describe("moderateContent", () => {
  it("calls Gemini with the reported content and reason, and returns the parsed decision", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(validDecision) });

    const result = await moderateContent({ targetType: "message", content: "get lost", reportReason: "harassing me" });

    expect(result).toEqual(validDecision);
    expect(generateContent).toHaveBeenCalledTimes(1);
    const call = generateContent.mock.calls[0][0];
    expect(call.contents).toContain("get lost");
    expect(call.contents).toContain("harassing me");
    expect(call.config.responseMimeType).toBe("application/json");
  });

  it("throws when Gemini returns an empty response", async () => {
    generateContent.mockResolvedValue({ text: undefined });

    await expect(moderateContent({ targetType: "message", content: "x", reportReason: "y" })).rejects.toThrow();
  });

  it("throws when Gemini returns malformed JSON", async () => {
    generateContent.mockResolvedValue({ text: "not json" });

    await expect(moderateContent({ targetType: "message", content: "x", reportReason: "y" })).rejects.toThrow();
  });
});
