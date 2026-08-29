import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import * as followService from "../services/follow.service.js";

export async function putFollow(req: Request, res: Response): Promise<void> {
  const result = await followService.followUser(req.uid!, req.params.uid);
  Responder.success(res, result);
}

export async function deleteFollow(req: Request, res: Response): Promise<void> {
  await followService.unfollowUser(req.uid!, req.params.uid);
  Responder.noContent(res);
}

export async function getFollowRequests(req: Request, res: Response): Promise<void> {
  const result = await followService.listFollowRequests(req.uid!);
  Responder.success(res, result);
}

export async function postApproveFollowRequest(req: Request, res: Response): Promise<void> {
  await followService.approveFollowRequest(req.uid!, req.params.requesterUid);
  Responder.noContent(res);
}

export async function postDenyFollowRequest(req: Request, res: Response): Promise<void> {
  await followService.denyFollowRequest(req.uid!, req.params.requesterUid);
  Responder.noContent(res);
}
