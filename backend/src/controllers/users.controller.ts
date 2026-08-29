import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import { getOrCreateUser, isUsernameAvailable, updateUser } from "../services/users.service.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  const uid = req.uid!;
  const claims = req.authClaims!;
  const profile = await getOrCreateUser(uid, claims);
  Responder.success(res, profile);
}

export async function checkUsernameAvailable(req: Request, res: Response): Promise<void> {
  const username = String(req.query.username ?? "");
  const available = await isUsernameAvailable(username);
  Responder.success(res, { available });
}

export async function patchMe(req: Request, res: Response): Promise<void> {
  const uid = req.uid!;
  const claims = req.authClaims!;
  const profile = await updateUser(uid, claims, req.body ?? {});
  Responder.success(res, profile);
}
