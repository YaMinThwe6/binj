import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError.js";
import { Responder } from "../utils/responder.js";
import { logger } from "../lib/logger.js";

// The single place every thrown error lands — controllers never catch
// anything themselves; they call a service and let errors bubble here.
// docs/backend-conventions.md §3.
export function globalErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return Responder.error(res, err.code, err.message, err.statusCode);
  }

  logger.error(`[${req.method} ${req.originalUrl}] Unhandled error`, err);
  return Responder.error(res, "INTERNAL_ERROR", "An unexpected error occurred.", 500);
}

export function notFoundHandler(req: Request, res: Response) {
  return Responder.error(res, "NOT_FOUND", "No such route", 404);
}
