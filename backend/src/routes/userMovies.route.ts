import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  putWatchlist,
  deleteWatchlist,
  getWatchlist,
  putWatched,
  deleteWatched,
  patchWatched,
  getWatched,
  putLike,
  deleteLike,
  getMovieStatus
} from "../controllers/userMovies.controller.js";

export const userMoviesRouter = Router();

userMoviesRouter.put("/users/me/watchlist/:movieId", requireAuth, asyncHandler(putWatchlist));
userMoviesRouter.delete("/users/me/watchlist/:movieId", requireAuth, asyncHandler(deleteWatchlist));
userMoviesRouter.get("/users/me/watchlist", requireAuth, asyncHandler(getWatchlist));

userMoviesRouter.put("/users/me/watched/:movieId", requireAuth, asyncHandler(putWatched));
userMoviesRouter.delete("/users/me/watched/:movieId", requireAuth, asyncHandler(deleteWatched));
userMoviesRouter.patch("/users/me/watched/:movieId", requireAuth, asyncHandler(patchWatched));
userMoviesRouter.get("/users/me/watched", requireAuth, asyncHandler(getWatched));

userMoviesRouter.put("/users/me/likes/:movieId", requireAuth, asyncHandler(putLike));
userMoviesRouter.delete("/users/me/likes/:movieId", requireAuth, asyncHandler(deleteLike));

userMoviesRouter.get("/users/me/movies/:movieId", requireAuth, asyncHandler(getMovieStatus));
