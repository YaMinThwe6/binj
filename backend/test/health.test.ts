import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("GET /health", () => {
  it("returns 200 and reports whether Firebase is configured", async () => {
    const app = createApp();
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "OK",
      data: { status: "ok", firebaseConfigured: false },
      statusCode: 200
    });
  });
});

describe("unknown route", () => {
  it("returns a 404 in the standard error envelope", async () => {
    const app = createApp();
    const res = await request(app).get("/nope");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "No such route", code: "NOT_FOUND", statusCode: 404 });
  });
});
