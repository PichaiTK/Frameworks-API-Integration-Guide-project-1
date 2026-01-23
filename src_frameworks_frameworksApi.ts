/**
 * Frameworks API generator helpers
 * - Writes files under .netlify/v1/*
 * - Provides helpers to create config.json, skew-protection.json, blobs, edge-functions, functions
 *
 * Usage (CLI / build step):
 *   import { FrameworksApi } from './frameworks/frameworksApi'
 *   const api = new FrameworksApi(process.cwd())
 *   await api.writeConfig({...})
 *   await api.writeEdgeFunction('my-route.ts', code, { path: '/*' })
 */

import fs from "fs";
import path from "path";

export type NetlifyConfig = {
  edge_functions?: Array<any>;
  functions?: Record<string, any>;
  headers?: any[];
  images?: any;
  redirects?: any[];
  // supports `redirects!` to override user rules
  "redirects!"?: any[];
};

export type SkewProtection = {
  patterns: string[];
  sources: Array<{ type: "cookie" | "header" | "query"; name: string }>;
};

export class FrameworksApi {
  base: string;
  v1: string;

  constructor(root = process.cwd()) {
    this.base = path.resolve(root, ".netlify");
    this.v1 = path.join(this.base, "v1");
  }

  ensureDir(rel: string) {
    const full = path.join(this.v1, rel);
    fs.mkdirSync(full, { recursive: true });
    return full;
  }

  writeJSON(relPath: string, obj: any) {
    const fullPath = path.join(this.v1, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(obj, null, 2), "utf-8");
    return fullPath;
  }

  /**
   * Write .netlify/v1/config.json
   */
  async writeConfig(config: NetlifyConfig) {
    return this.writeJSON("config.json", config);
  }

  /**
   * Write .netlify/v1/skew-protection.json
   */
  async writeSkewProtection(cfg: SkewProtection) {
    return this.writeJSON("skew-protection.json", cfg);
  }

  /**
   * Create a blob under .netlify/v1/blobs/deploy/<key>/blob
   * Optionally write blob.meta.json
   */
  async writeBlob(key: string, content: Buffer | string, meta?: any) {
    const base = this.ensureDir(path.join("blobs", "deploy", key));
    const blobPath = path.join(base, "blob");
    fs.writeFileSync(blobPath, content);
    if (meta) {
      fs.writeFileSync(path.join(base, "blob.meta.json"), JSON.stringify(meta, null, 2));
    }
    return blobPath;
  }

  /**
   * Write an edge function file to .netlify/v1/edge-functions/<filename>
   * `code` should be ESM / Deno compatible. `config` is optional and will be appended as export const config = {...}
   */
  async writeEdgeFunction(filename: string, code: string, config?: Record<string, any>) {
    const dir = this.ensureDir("edge-functions");
    const file = path.join(dir, filename);
    let out = code;
    if (config) {
      out += `\n\nexport const config = ${JSON.stringify(config, null, 2)};`;
    }
    fs.writeFileSync(file, out, "utf-8");
    return file;
  }

  /**
   * Write a serverless function to .netlify/v1/functions/<filename>
   * `code` should be ESM compatible (or TypeScript if you invoke a bundler)
   * `config` will be appended as `export const config = {...}`
   */
  async writeFunction(filename: string, code: string, config?: Record<string, any>) {
    const dir = this.ensureDir("functions");
    const file = path.join(dir, filename);
    let out = code;
    if (config) {
      out += `\n\nexport const config = ${JSON.stringify(config, null, 2)};`;
    }
    fs.writeFileSync(file, out, "utf-8");
    return file;
  }

  /**
   * Convenience: create typical SSR function that proxies to framework render
   */
  async writeExampleSSR() {
    const code = `import type { Config, Context } from "@netlify/functions";
import { renderPage } from "./your-framework-render.ts";

export default async (req: Request, context: Context) => {
  const html = await renderPage(req);
  return new Response(html, {
    headers: { "content-type": "text/html" }
  });
};`;
    return this.writeFunction("my-framework-ssr.ts", code, { path: "/*", excludedPath: ["/api/*"] });
  }

  /**
   * Write import_map.json for edge functions
   */
  async writeImportMap(map: Record<string, string>) {
    return this.writeJSON(path.join("edge-functions", "import_map.json"), { imports: map });
  }
}