import express, { type Express } from "express";
import cors from "cors";
import { moviesRouter } from "./routes/movies.js";
import { isFirebaseConfigured } from "./lib/firebaseAdmin.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", firebaseConfigured: isFirebaseConfigured() });
  });

  app.use(moviesRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No such route" } });
  });

  return app;
}
