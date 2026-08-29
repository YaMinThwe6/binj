import winston from "winston";

// Structured logging (docs/backend-conventions.md "Logging"). Every backend
// route logs through this instead of console.* directly, so log level/format
// is controlled in one place rather than per call site.
//
// - test        → silent (keeps `pnpm test` output readable; the logger still
//                  exists and is callable, just doesn't emit)
// - development  → colorized, human-readable single line
// - production   → structured JSON (timestamp + level + message + metadata),
//                  suitable for a log aggregator to parse
const env = process.env.NODE_ENV ?? "development";

const format =
  env === "production"
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.simple());

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format,
  transports: [new winston.transports.Console({ silent: env === "test" })]
});
