import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import { getWatchedCandidates, getCelebritySuggestions } from "../services/onboarding.service.js";

export async function watchedCandidates(req: Request, res: Response): Promise<void> {
  const result = await getWatchedCandidates(req.query.genres, req.query.languages, req.query.cursor);
  Responder.success(res, result);
}

export async function celebritySuggestions(req: Request, res: Response): Promise<void> {
  const result = await getCelebritySuggestions(req.uid!, req.query.genres, req.query.languages, req.query.cursor);
  Responder.success(res, result);
}
