import type { Request, Response } from "express";
import { Responder } from "../utils/responder.js";
import { createReport } from "../services/reports.service.js";

export async function postReport(req: Request, res: Response): Promise<void> {
  const result = await createReport(req.uid!, req.body ?? {});
  Responder.success(res, result, "OK", 201);
}
