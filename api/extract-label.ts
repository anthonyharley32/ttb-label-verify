import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractLabel } from "../src/server/extract.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const result = await extractLabel(req.body);
  res.status(result.status).json(result.body);
}
