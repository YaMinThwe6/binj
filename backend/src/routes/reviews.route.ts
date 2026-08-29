import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { putReview, deleteReview, getReviews } from "../controllers/reviews.controller.js";

export const reviewsRouter = Router();

reviewsRouter.put("/movies/:movieId/reviews/me", requireAuth, asyncHandler(putReview));
reviewsRouter.delete("/movies/:movieId/reviews/me", requireAuth, asyncHandler(deleteReview));
reviewsRouter.get("/movies/:movieId/reviews", asyncHandler(getReviews));
