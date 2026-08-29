import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import { getRecommendations } from "../services/recommendations.service.js";

export async function getRecommendationsController(req: Request, res: Response): Promise<void> {
  const result = await getRecommendations(req.uid!);
  Responder.success(res, result);
}
