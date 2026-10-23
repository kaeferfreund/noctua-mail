import { readFile, writeFile } from "node:fs/promises";

// Next owns server.js's config serialization; replace only its HTTP lifecycle entrypoint.
const file = ".next/standalone/server.js";
const source = await readFile(file, "utf8");
const expected = "require('next/dist/server/lib/start-server')";
const replacement = "require('./noctua-server.mjs')";
const occurrences = (source.split(expected).length - 1) + (source.split(replacement).length - 1);
if (occurrences !== 1) throw new Error("Next standalone launcher changed; review shutdown integration before packaging");
const result = await Bun.build({ entrypoints: ["lib/server/standalone.ts"], outdir: ".next/standalone", naming: "noctua-server.mjs", target: "bun", external: ["next", "next/*"] });
if (!result.success) throw new AggregateError(result.logs, "Cannot package standalone shutdown lifecycle");
await writeFile(file, source.replace(expected, replacement));
