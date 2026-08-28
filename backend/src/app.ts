import express, { type Express } from "express";
import cors from "cors";
import { moviesRouter } from "./routes/movies.js";
import { usersRouter } from "./routes/users.js";
import { authRouter } from "./routes/auth.js";
import { userMoviesRouter } from "./routes/userMovies.js";
import { recommendationsRouter } from "./routes/recommendations.js";
import { peopleRouter } from "./routes/people.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { followRouter } from "./routes/follow.js";
import { eventsRouter } from "./routes/events.js";
import { homeRouter } from "./routes/home.js";
import { notificationsRouter } from "./routes/notifications.js";
import { isFirebaseConfigured } from "./lib/firebaseAdmin.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", firebaseConfigured: isFirebaseConfigured() });
  });

  app.use(moviesRouter);
  app.use(usersRouter);
  app.use(authRouter);
  app.use(userMoviesRouter);
  app.use(recommendationsRouter);
  app.use(peopleRouter);
  app.use(onboardingRouter);
  app.use(followRouter);
  app.use(eventsRouter);
  app.use(homeRouter);
  app.use(notificationsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No such route" } });
  });

  return app;
}
