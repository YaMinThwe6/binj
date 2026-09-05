import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import { getMovieDetail, searchMoviesService, getRecentMoviesService, discoverMoviesService } from "../services/movies.service.js";

export async function getMovie(req: Request, res: Response): Promise<void> {
  const movie = await getMovieDetail(req.params.movieId);
  Responder.success(res, movie);
}

export async function getRecentMovies(req: Request, res: Response): Promise<void> {
  const result = await getRecentMoviesService();
  Responder.success(res, result);
}

export async function searchMovies(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  const result = await searchMoviesService(q);
  Responder.success(res, result);
}

export async function discoverMovies(req: Request, res: Response): Promise<void> {
  const result = await discoverMoviesService(req.query.genre, req.query.language, req.query.page);
  Responder.success(res, result);
}
