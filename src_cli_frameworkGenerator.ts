#!/usr/bin/env node
/**
 * Small CLI to generate Frameworks API files
 * - Interactive prompts to create config.json, skew protection, and an example edge/function
 *
 * Run: node dist/cli/frameworkGenerator.js
 */

import readline from "readline";
import { FrameworksApi } from "../frameworks/frameworksApi";
import fs from "fs";
import path from "path";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(q: string) {
  return new Promise<string>((resolve) => rl.question(q, resolve));
}

async function main() {
  console.clear();
  console.log("Frameworks API Generator\n");

  const root = process.cwd();
  const api = new FrameworksApi(root);

  const createConfig = (await question("Create .netlify/v1/config.json? (Y/n) ")) || "y";
  if (createConfig.toLowerCase() !== "n") {
    const exampleConfig = {
      edge_functions: [
        { function: "auth", path: "/admin" },
        { function: "injector", path: "/admin" },
      ],
      functions: { directory: "netlify-functions/", included_files: ["**/*.ts"] },
      headers: [{ for: "/*", values: { "X-Frame-Options": "DENY" } }],
    };
    await api.writeConfig(exampleConfig);
    console.log("Wrote .netlify/v1/config.json");
  }

  const createSkew = (await question("Create skew-protection.json? (y/N) ")) || "n";
  if (createSkew.toLowerCase() === "y") {
    const skew = {
      patterns: ["/api/.*", ".*\\.(png|jpg|jpeg|gif|webp|svg|js|css)$"],
      sources: [{ type: "cookie", name: "netlify-skew-token" }, { type: "header", name: "x-skew-token" }],
    };
    await api.writeSkewProtection(skew);
    console.log("Wrote .netlify/v1/skew-protection.json");
  }

  const createEdge = (await question("Write example edge function (my-framework-api-route.ts)? (Y/n) ")) || "y";
  if (createEdge.toLowerCase() !== "n") {
    const code = `import type { Config, Context } from "@netlify/edge-functions";

export default async (req: Request, context: Context) => {
  if (req.headers.get("accept") === "application/json") {
    const { pathname } = new URL(req.url);
    return new URL(\`/api\${pathname}\`, req.url);
  }
};

export const config = { path: "/*", excludedPath: ["/api/*"] };`;
    await api.writeEdgeFunction("my-framework-api-route.ts", code);
    console.log("Wrote .netlify/v1/edge-functions/my-framework-api-route.ts");
  }

  const createBlob = (await question("Create sample blob entry? (y/N) ")) || "n";
  if (createBlob.toLowerCase() === "y") {
    const key = "example.com";
    const content = "<html><body>cached response</body></html>";
    await api.writeBlob(key, content, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
    console.log(`Wrote blob for key: ${key}`);
  }

  rl.close();
  console.log("\nDone.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}