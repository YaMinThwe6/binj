import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMovie, searchMovies, getRecentMovies } from "../controllers/movies.controller.js";

export const moviesRouter = Router();

// Registered before "/movies/:movieId" — a param route registered first
// would shadow this by matching "recent" as :movieId.
moviesRouter.get("/movies/recent", asyncHandler(getRecentMovies));
moviesRouter.get("/movies/:movieId", asyncHandler(getMovie));
moviesRouter.get("/search/movies", asyncHandler(searchMovies));
