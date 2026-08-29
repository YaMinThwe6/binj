import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMovie, searchMovies } from "../controllers/movies.controller.js";

export const moviesRouter = Router();

moviesRouter.get("/movies/:movieId", asyncHandler(getMovie));
moviesRouter.get("/search/movies", asyncHandler(searchMovies));
