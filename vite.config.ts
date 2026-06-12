import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Dev-only middleware that serves /api/extract-label from the same core logic
 * the Vercel serverless function uses — so `npm run dev` works end-to-end
 * without any extra tooling. In production, Vercel serves api/extract-label.ts.
 */
function devApiPlugin(): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api/extract-label", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let payload: unknown;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
          return;
        }
        const { extractLabel } = await server.ssrLoadModule("/src/server/extract.ts");
        const result = await extractLabel(payload);
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make API keys from .env.local available to the dev API middleware
  // (server-side only — never exposed to the client bundle).
  const env = loadEnv(mode, process.cwd(), "");
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (env.EXTRACTION_MODEL) process.env.EXTRACTION_MODEL = env.EXTRACTION_MODEL;

  return {
    plugins: [react(), tailwindcss(), devApiPlugin()],
  };
});
