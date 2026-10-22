import type { NextConfig } from "next";
import { workerRuntimeTraceFiles } from "./build-scripts/workerRuntimeTraceFiles";

const nextConfig: NextConfig = {
  output: 'standalone',
  typedRoutes: false,
  // Worker subprocesses execute TS entrypoints from ./scripts at runtime.
  // Standalone builds only ship traced files, so include the worker source tree
  // and its local TS dependencies explicitly for the routes that launch them.
  outputFileTracingIncludes: {
    "/api/accounts/*/sync": [
      ...workerRuntimeTraceFiles,
      // Worker subprocess loads lib/html.ts as TS source. Packages imported
      // by lib/html.ts aren't traced into the sync-route standalone output
      // automatically, so copy them explicitly.
      "./node_modules/sanitize-html/**",
      "./node_modules/is-plain-object/**",
      "./node_modules/parse-srcset/**",
      "./node_modules/escape-string-regexp/**",
      "./node_modules/entities/**",
      // parse5 8.0.1 depends on entities ^8 and resolves the hoisted copy above.
      // parse5 8.0.0 nested entities ^6, so package.json starts the range at 8.0.1.
      "./node_modules/parse5/**",
      // sanitize-html 2.17 and html-to-text 10 use htmlparser2 10, which still
      // depends on entities ^7. That copy lives at
      // node_modules/htmlparser2/node_modules/entities. The hoisted entities 8
      // package is ESM-only, so the worker must keep this nested CJS copy.
      "./node_modules/htmlparser2/**"
    ],
    "/api/accounts/*/threads/recompute": workerRuntimeTraceFiles,
    "/api/accounts/*/categories/recompute": workerRuntimeTraceFiles
  },
  images: {
    qualities: [75, 85]
  },
  // Ensure these packages are kept as separate node_modules (not bundled inline)
  // so the sync worker subprocess can import them at runtime.
  // sanitize-html must stay external so Next.js's standalone tracer copies it
  // into /app/node_modules — the sync worker subprocess loads lib/html.ts as
  // TS source at runtime and resolves sanitize-html via normal module lookup.
  serverExternalPackages: ['rrule', 'imapflow', 'mailparser', 'nodemailer', 'html-to-text', 'sanitize-html']
};

export default nextConfig;
