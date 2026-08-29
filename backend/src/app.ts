import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { moviesRouter } from "./routes/movies.route.js";
import { usersRouter } from "./routes/users.route.js";
import { authRouter } from "./routes/auth.route.js";
import { userMoviesRouter } from "./routes/userMovies.route.js";
import { recommendationsRouter } from "./routes/recommendations.route.js";
import { peopleRouter } from "./routes/people.route.js";
import { onboardingRouter } from "./routes/onboarding.route.js";
import { followRouter } from "./routes/follow.route.js";
import { eventsRouter } from "./routes/events.route.js";
import { homeRouter } from "./routes/home.route.js";
import { notificationsRouter } from "./routes/notifications.route.js";
import { reviewsRouter } from "./routes/reviews.route.js";
import { roomsRouter } from "./routes/rooms.route.js";
import { reportsRouter } from "./routes/reports.route.js";
import { isFirebaseConfigured } from "./lib/firebaseAdmin.js";
import { globalErrorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { Responder } from "./utils/responder.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    Responder.success(res, { status: "ok", firebaseConfigured: isFirebaseConfigured() });
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
  app.use(reviewsRouter);
  app.use(roomsRouter);
  app.use(reportsRouter);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
