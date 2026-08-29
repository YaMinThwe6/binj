import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { postReport } from "../controllers/reports.controller.js";

export const reportsRouter = Router();

reportsRouter.post("/reports", requireAuth, asyncHandler(postReport));
