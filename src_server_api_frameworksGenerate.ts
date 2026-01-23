/**
 * Example Express / Next.js API route (server-side) to receive a payload from FrameworksPanel
 * and invoke the FrameworksApi to write files to disk (inside the repository).
 *
 * This file is intended to run in node (server). In Next.js, place under pages/api or app/api.
 *
 * Minimal express example:
 *   app.post('/api/frameworks/generate', async (req, res) => require('./frameworksGenerate').handler(req, res))
 */

import { FrameworksApi } from "../../frameworks/frameworksApi";
import type { IncomingMessage, ServerResponse } from "http";

export async function handler(req: any, res: any) {
  // Simple body parsing guard (in production use JSON body parser)
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }
  try {
    const payload = req.body;
    const api = new FrameworksApi(process.cwd());

    if (payload.config) {
      await api.writeConfig(payload.config);
    }
    if (payload.skew) {
      await api.writeSkewProtection(payload.skew);
    }
    if (payload.import_map) {
      await api.writeImportMap(payload.import_map);
    }
    // Optionally write example edge/function
    await api.writeEdgeFunction("my-framework-api-route.ts", `export default () => new Response("ok");`, {
      path: "/*",
      excludedPath: ["/api/*"],
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(String(err.stack || err));
  }
}

export default handler;