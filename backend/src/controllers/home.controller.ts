import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import * as homeService from "../services/home.service.js";

export async function getGreeting(req: Request, res: Response): Promise<void> {
  const result = await homeService.getGreeting(req.uid!);
  Responder.success(res, result);
}

export async function getActivity(req: Request, res: Response): Promise<void> {
  const result = await homeService.getActivity(req.uid!);
  Responder.success(res, result);
}

export async function getFriendsRecommendations(req: Request, res: Response): Promise<void> {
  const result = await homeService.getFriendsRecommendations(req.uid!);
  Responder.success(res, result);
}
