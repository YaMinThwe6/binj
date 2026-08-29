import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import { startEmailAuth, verifyEmailAuth } from "../services/auth.service.js";

export async function emailStart(req: Request, res: Response): Promise<void> {
  await startEmailAuth(req.body?.email);
  Responder.noContent(res);
}

export async function emailVerify(req: Request, res: Response): Promise<void> {
  const result = await verifyEmailAuth(req.body?.email, req.body?.code);
  Responder.success(res, result);
}
