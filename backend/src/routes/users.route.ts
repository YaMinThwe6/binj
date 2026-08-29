import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMe, checkUsernameAvailable, patchMe } from "../controllers/users.controller.js";

export const usersRouter = Router();

usersRouter.get("/users/me", requireAuth, asyncHandler(getMe));
usersRouter.get("/users/username-available", asyncHandler(checkUsernameAvailable));
usersRouter.patch("/users/me", requireAuth, asyncHandler(patchMe));
