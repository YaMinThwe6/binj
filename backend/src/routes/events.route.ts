import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  postEvent,
  getUpcomingEvents,
  putJoinEvent,
  deleteJoinEvent,
  getJoinRequests,
  postApproveJoinRequest,
  postDenyJoinRequest
} from "../controllers/events.controller.js";

export const eventsRouter = Router();

eventsRouter.post("/events", requireAuth, asyncHandler(postEvent));
eventsRouter.get("/events/upcoming", requireAuth, asyncHandler(getUpcomingEvents));
eventsRouter.put("/events/:eventId/join", requireAuth, asyncHandler(putJoinEvent));
eventsRouter.delete("/events/:eventId/join", requireAuth, asyncHandler(deleteJoinEvent));
eventsRouter.get("/events/:eventId/joinRequests", requireAuth, asyncHandler(getJoinRequests));
eventsRouter.post("/events/:eventId/joinRequests/:requesterUid/approve", requireAuth, asyncHandler(postApproveJoinRequest));
eventsRouter.post("/events/:eventId/joinRequests/:requesterUid/deny", requireAuth, asyncHandler(postDenyJoinRequest));
