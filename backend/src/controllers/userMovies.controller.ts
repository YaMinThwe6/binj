import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import * as userMoviesService from "../services/userMovies.service.js";

function cursor(req: Request): string | null {
  return typeof req.query.cursor === "string" ? req.query.cursor : null;
}

export async function putWatchlist(req: Request, res: Response): Promise<void> {
  await userMoviesService.addToWatchlist(req.uid!, req.params.movieId);
  Responder.noContent(res);
}

export async function deleteWatchlist(req: Request, res: Response): Promise<void> {
  await userMoviesService.removeFromWatchlist(req.uid!, req.params.movieId);
  Responder.noContent(res);
}

export async function getWatchlist(req: Request, res: Response): Promise<void> {
  const result = await userMoviesService.listWatchlist(req.uid!, req.query.limit, cursor(req));
  Responder.success(res, result);
}

export async function putWatched(req: Request, res: Response): Promise<void> {
  await userMoviesService.markWatched(req.uid!, req.params.movieId, req.body?.visibility, req.body?.watchedAt);
  Responder.noContent(res);
}

export async function deleteWatched(req: Request, res: Response): Promise<void> {
  await userMoviesService.unmarkWatched(req.uid!, req.params.movieId);
  Responder.noContent(res);
}

export async function patchWatched(req: Request, res: Response): Promise<void> {
  await userMoviesService.updateWatchedVisibility(req.uid!, req.params.movieId, req.body?.visibility);
  Responder.noContent(res);
}

export async function getWatched(req: Request, res: Response): Promise<void> {
  const result = await userMoviesService.listWatched(req.uid!, req.query.limit, cursor(req));
  Responder.success(res, result);
}

export async function putLike(req: Request, res: Response): Promise<void> {
  await userMoviesService.likeMovie(req.uid!, req.params.movieId);
  Responder.noContent(res);
}

export async function deleteLike(req: Request, res: Response): Promise<void> {
  await userMoviesService.unlikeMovie(req.uid!, req.params.movieId);
  Responder.noContent(res);
}

export async function getMovieStatuses(req: Request, res: Response): Promise<void> {
  const result = await userMoviesService.getMovieStatuses(req.uid!, req.query.ids);
  Responder.success(res, result);
}

export async function getMovieStatus(req: Request, res: Response): Promise<void> {
  const status = await userMoviesService.getMovieStatus(req.uid!, req.params.movieId);
  Responder.success(res, status);
}
