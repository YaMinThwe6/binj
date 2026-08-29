import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { emailStart, emailVerify } from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.post("/auth/email/start", asyncHandler(emailStart));
authRouter.post("/auth/email/verify", asyncHandler(emailVerify));
