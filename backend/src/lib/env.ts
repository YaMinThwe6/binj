import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("6501"),
  TMDB_READ_ACCESS_TOKEN: z.string().min(1, "TMDB_READ_ACCESS_TOKEN is required"),
  TMDB_API_KEY: z.string().min(1).optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional()
});

export const env = envSchema.parse(process.env);

export const firebaseConfigured = Boolean(
  env.FIREBASE_PROJECT_ID && env.GOOGLE_APPLICATION_CREDENTIALS
);
