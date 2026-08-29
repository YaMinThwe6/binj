import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getNotifications, patchNotification } from "../controllers/notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.get("/users/me/notifications", requireAuth, asyncHandler(getNotifications));
notificationsRouter.patch("/users/me/notifications/:notificationId", requireAuth, asyncHandler(patchNotification));
