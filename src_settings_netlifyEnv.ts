/**
 * Simple Netlify environment variables manager
 * - Manage env variables across deploy contexts and scopes
 * - Export to a repo file (.netlify/env.json) for frameworks / build-time
 *
 * Note: Netlify does NOT consume .netlify/v1/env.json by default.
 * This helper is intended for framework authors who want to include
 * environment samples/config in the repo or produce a file to be used
 * by a build step or CI.
 */

import fs from "fs";
import path from "path";

export type DeployContext = "production" | "deploy-preview" | "branch-deploy" | "preview-server" | "local";

export type EnvScope = "builds" | "functions" | "runtime" | "post-processing" | "all";

export interface EnvValue {
  value: string;
  secret?: boolean;
}

export interface EnvEntry {
  key: string;
  scope?: EnvScope | EnvScope[];
  values?: Partial<Record<DeployContext | string, EnvValue>>;
}

export class NetlifyEnvStore {
  base: string;
  constructor(root = process.cwd()) {
    this.base = path.join(root, ".netlify");
    fs.mkdirSync(this.base, { recursive: true });
  }

  pathForFile(name = "env.json") {
    return path.join(this.base, name);
  }

  save(entries: EnvEntry[]) {
    const file = this.pathForFile();
    fs.writeFileSync(file, JSON.stringify({ entries }, null, 2), "utf-8");
    return file;
  }

  load(): EnvEntry[] {
    const file = this.pathForFile();
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw).entries || [];
  }

  exportDotEnv(ctx: DeployContext = "local") {
    const lines: string[] = [];
    for (const e of this.load()) {
      const v = e.values?.[ctx] || e.values?.production || null;
      if (v) {
        lines.push(`${e.key}=${v.value}`);
      }
    }
    const out = lines.join("\n");
    const outPath = this.pathForFile(`env.${ctx}.local`);
    fs.writeFileSync(outPath, out, "utf-8");
    return outPath;
  }
}