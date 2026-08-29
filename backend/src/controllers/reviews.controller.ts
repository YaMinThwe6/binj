import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import * as reviewsService from "../services/reviews.service.js";

export async function putReview(req: Request, res: Response): Promise<void> {
  const result = await reviewsService.upsertReview(req.uid!, req.params.movieId, req.body ?? {});
  Responder.success(res, result);
}

export async function deleteReview(req: Request, res: Response): Promise<void> {
  await reviewsService.deleteReview(req.uid!, req.params.movieId);
  Responder.noContent(res);
}

export async function getReviews(req: Request, res: Response): Promise<void> {
  const result = await reviewsService.listReviews(req.params.movieId, req.query.limit, req.query.cursor);
  Responder.success(res, result);
}
