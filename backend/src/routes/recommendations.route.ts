import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getRecommendationsController, getSimilarMoviesController } from "../controllers/recommendations.controller.js";

export const recommendationsRouter = Router();

recommendationsRouter.get("/recommendations", requireAuth, asyncHandler(getRecommendationsController));
// Public, unauthenticated — same as GET /movies/:movieId itself (movies.route.ts).
// Lives here rather than there purely to avoid touching movies.route.ts/.controller.ts/
// .service.ts while another concurrent session has them mid-edit (see git history/PR
// discussion around 2026-09-04) — grouped by feature (movie-to-movie recommendations),
// not by URL prefix, same reasoning §5's watchedBy/tasteMatches endpoints already use.
recommendationsRouter.get("/movies/:movieId/similar", asyncHandler(getSimilarMoviesController));
