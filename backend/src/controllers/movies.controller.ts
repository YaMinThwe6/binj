import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import { getMovieDetail, searchMoviesService } from "../services/movies.service.js";

export async function getMovie(req: Request, res: Response): Promise<void> {
  const movie = await getMovieDetail(req.params.movieId);
  Responder.success(res, movie);
}

export async function searchMovies(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  const result = await searchMoviesService(q);
  Responder.success(res, result);
}
