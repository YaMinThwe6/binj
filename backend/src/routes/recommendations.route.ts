import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getRecommendationsController } from "../controllers/recommendations.controller.js";

export const recommendationsRouter = Router();

recommendationsRouter.get("/recommendations", requireAuth, asyncHandler(getRecommendationsController));
