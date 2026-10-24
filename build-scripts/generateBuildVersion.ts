#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createBuildVersionPayload } from "../lib/buildVersion";
import { getBuildVersionFilePath } from "../lib/buildVersionFile";

// The build-time environment (NOCTUA_BUILD_* or the Dockerfile's build
// arguments) is recorded here; the server reads the identity back from this
// file at runtime (lib/buildVersionFile.ts getRunningBuild).
const filePath = getBuildVersionFilePath();
const payload = createBuildVersionPayload();

await mkdir(dirname(filePath), { recursive: true });
await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${filePath} (${payload.buildVersionLabel || "empty"})`);
