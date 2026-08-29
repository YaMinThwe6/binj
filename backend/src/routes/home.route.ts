import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getGreeting, getActivity } from "../controllers/home.controller.js";

export const homeRouter = Router();

homeRouter.get("/home/greeting", requireAuth, asyncHandler(getGreeting));
homeRouter.get("/home/activity", requireAuth, asyncHandler(getActivity));
