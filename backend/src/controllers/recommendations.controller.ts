import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import { getRecommendations, getSimilarMovies } from "../services/recommendations.service.js";

export async function getRecommendationsController(req: Request, res: Response): Promise<void> {
  const result = await getRecommendations(req.uid!);
  Responder.success(res, result);
}

export async function getSimilarMoviesController(req: Request, res: Response): Promise<void> {
  const result = await getSimilarMovies(req.params.movieId);
  Responder.success(res, result);
}
