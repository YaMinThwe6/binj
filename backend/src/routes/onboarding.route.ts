import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { watchedCandidates, celebritySuggestions } from "../controllers/onboarding.controller.js";

export const onboardingRouter = Router();

onboardingRouter.get("/onboarding/watched-candidates", requireAuth, asyncHandler(watchedCandidates));
onboardingRouter.get("/onboarding/celebrity-suggestions", requireAuth, asyncHandler(celebritySuggestions));
