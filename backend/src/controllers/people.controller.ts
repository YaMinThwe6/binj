import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import * as peopleService from "../services/people.service.js";

export async function getTasteMatches(req: Request, res: Response): Promise<void> {
  const result = await peopleService.getTasteMatches(req.uid!);
  Responder.success(res, result);
}

export async function putFollowedCelebrity(req: Request, res: Response): Promise<void> {
  await peopleService.followCelebrity(req.uid!, req.params.personId);
  Responder.noContent(res);
}

export async function deleteFollowedCelebrity(req: Request, res: Response): Promise<void> {
  await peopleService.unfollowCelebrity(req.uid!, req.params.personId);
  Responder.noContent(res);
}

export async function getFollowedCelebrities(req: Request, res: Response): Promise<void> {
  const result = await peopleService.listFollowedCelebrities(req.uid!);
  Responder.success(res, result);
}

export async function getMovieWatchedBy(req: Request, res: Response): Promise<void> {
  const result = await peopleService.getMovieWatchedBy(req.uid!, req.params.movieId);
  Responder.success(res, result);
}

export async function getPeopleSearch(req: Request, res: Response): Promise<void> {
  const result = await peopleService.searchPeopleService(req.query.q);
  Responder.success(res, result);
}
