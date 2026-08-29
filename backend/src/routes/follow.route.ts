import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  putFollow,
  deleteFollow,
  getFollowRequests,
  postApproveFollowRequest,
  postDenyFollowRequest
} from "../controllers/follow.controller.js";

export const followRouter = Router();

followRouter.put("/users/:uid/follow", requireAuth, asyncHandler(putFollow));
followRouter.delete("/users/:uid/follow", requireAuth, asyncHandler(deleteFollow));
followRouter.get("/users/me/followRequests", requireAuth, asyncHandler(getFollowRequests));
followRouter.post("/users/me/followRequests/:requesterUid/approve", requireAuth, asyncHandler(postApproveFollowRequest));
followRouter.post("/users/me/followRequests/:requesterUid/deny", requireAuth, asyncHandler(postDenyFollowRequest));
