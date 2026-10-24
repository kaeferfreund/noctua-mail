import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveRunningBuild, type BuildVersionPayload, type RunningBuild } from "./buildVersion";

export const BUILD_VERSION_FILE_NAME = "build-version.json";

export const getBuildVersionFilePath = (cwd: string = process.cwd()) =>
  resolve(cwd, "public", BUILD_VERSION_FILE_NAME);

export const readBuildVersionFile = (filePath: string = getBuildVersionFilePath()): Partial<BuildVersionPayload> | null => {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Partial<BuildVersionPayload> : null;
  } catch {
    return null;
  }
};

let runningBuild: RunningBuild | null = null;

/**
 * The running build, read once per process. The file is written at build
 * time and a deploy always restarts the process, so the first read after a
 * restart sees the new build; a file changed without a restart is not picked up.
 */
export function getRunningBuild(read: () => Partial<BuildVersionPayload> | null = readBuildVersionFile): RunningBuild {
  runningBuild ??= resolveRunningBuild(read());
  return runningBuild;
}

export function resetRunningBuildForTests() {
  runningBuild = null;
}
