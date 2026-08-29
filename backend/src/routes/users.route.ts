import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMe, checkUsernameAvailable, patchMe, getUserProfile } from "../controllers/users.controller.js";

export const usersRouter = Router();

usersRouter.get("/users/me", requireAuth, asyncHandler(getMe));
usersRouter.get("/users/username-available", asyncHandler(checkUsernameAvailable));
usersRouter.patch("/users/me", requireAuth, asyncHandler(patchMe));
// Kept last: a param route registered before the static ones above would
// shadow "/users/me" and "/users/username-available" by matching "me"/
// "username-available" as :uid first.
usersRouter.get("/users/:uid", requireAuth, asyncHandler(getUserProfile));
