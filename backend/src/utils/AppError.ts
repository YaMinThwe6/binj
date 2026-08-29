// Thrown by services for any expected/business-rule failure (not found, bad
// input, forbidden, conflict, upstream failure) — carries everything
// globalErrorHandler needs to build the error envelope, so a controller never
// has to catch anything itself; it just calls the service and lets errors
// bubble. See docs/backend-conventions.md §3.
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
