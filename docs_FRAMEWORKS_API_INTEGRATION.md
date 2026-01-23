# Frameworks API — Integration Guide (project)

This document describes the small integration we added to the project to support generating Netlify Frameworks API files from your framework build or from a developer UI/CLI.

Files included
- src/frameworks/frameworksApi.ts — helpers to write .netlify/v1/* files
- src/cli/frameworkGenerator.ts — interactive CLI to scaffold example Frameworks API files
- src/frontend/components/FrameworksPanel.tsx — React UI to edit payloads and POST to a server route
- src/server/api/frameworksGenerate.ts — simple server handler that writes files using the frameworksApi
- src/settings/netlifyEnv.ts — helper to manage environment variables and export .netlify/env.json or dotenv files

How to use
1. CLI
   - Run the build/compiled CLI: node dist/cli/frameworkGenerator.js
   - It will interactively scaffold `/.netlify/v1/config.json`, `edge-functions`, `functions` and `blobs`.

2. From a build
   - Import `FrameworksApi` in your framework build script and call API helpers to write files during build.

3. From React UI
   - Add FrameworksPanel to your admin/site UI.
   - Provide a server API route `/api/frameworks/generate` that calls `FrameworksApi` (example included).
   - The server must run in Node and have write access to the repository working directory.

Notes
- Edge Functions must be ESM / Deno-compatible code if they run in Netlify's Deno-based runtime.
- Files generated under `.netlify/v1/` are consumed by Netlify during build/deploy when using the Frameworks API.
- The UI downloads payloads when running in a browser; writing to disk requires a server-side handler.

Security
- Do NOT persist secrets in repo files. Use Netlify UI / API for secrets. The `netlifyEnv` helper above is for local samples or non-secret config only.
- When exposing a server route to write files, restrict access (auth) so not everyone can modify repo files.

Further reading
- Netlify Frameworks API docs: https://docs.netlify.com/configure-builds/frameworks-api/
- Netlify Edge Functions: https://docs.netlify.com/edge-functions/overview/