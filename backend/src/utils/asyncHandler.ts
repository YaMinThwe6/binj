import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 (unlike 5) doesn't auto-forward a rejected async handler's error
// to error-handling middleware — every route wraps its controller in this so
// a thrown AppError (or anything else) reaches globalErrorHandler instead of
// becoming an unhandled rejection.
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
