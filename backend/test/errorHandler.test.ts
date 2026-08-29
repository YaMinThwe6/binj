import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { AppError } from "../src/utils/AppError.js";
import { globalErrorHandler, notFoundHandler } from "../src/middleware/errorHandler.js";

vi.mock("../src/lib/firebaseAdmin.js", () => ({
  auth: { verifyIdToken: vi.fn() },
  db: null,
  isFirebaseConfigured: () => true
}));

function buildApp() {
  const app = express();
  app.get("/boom-app-error", () => {
    throw new AppError("MOVIE_NOT_FOUND", "No such movie", 404);
  });
  app.get("/boom-unknown", () => {
    throw new Error("something broke");
  });
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
}

describe("globalErrorHandler", () => {
  it("maps an AppError to its own code/message/statusCode", async () => {
    const res = await request(buildApp()).get("/boom-app-error");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "No such movie", code: "MOVIE_NOT_FOUND", statusCode: 404 });
  });

  it("maps any other thrown error to a generic 500 INTERNAL_ERROR, never leaking the raw message", async () => {
    const res = await request(buildApp()).get("/boom-unknown");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: "An unexpected error occurred.", code: "INTERNAL_ERROR", statusCode: 500 });
  });
});

describe("notFoundHandler", () => {
  it("returns a 404 envelope for an unmatched route", async () => {
    const res = await request(buildApp()).get("/no-such-route");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "No such route", code: "NOT_FOUND", statusCode: 404 });
  });
});
