// TEST-ONLY FIXTURE. The fixed inputs of the sanitize differential test: the
// synthetic corpus raw and after the reader's stripConditionalComments, every
// distinct payload the sanitize tests passed in at 0ac6cfa, and the empty
// string.
import { stripConditionalComments } from "../../html/strip";
import { generateSanitizeCorpus } from "./sanitizeCorpus";
import payloads from "./sanitizePayloads.json";

export type SanitizeDifferentialInput = { name: string; html: string };

export function sanitizeDifferentialInputs(): SanitizeDifferentialInput[] {
  const corpus = Object.entries(generateSanitizeCorpus());
  return [
    ...corpus.map(([name, html]) => ({ name: `corpus:${name}`, html })),
    ...corpus.map(([name, html]) => ({ name: `corpus:${name}:cleaned`, html: stripConditionalComments(html) })),
    ...(payloads as string[]).map((html, index) => ({ name: `payload:${index}`, html })),
    { name: "edge:empty", html: "" }
  ];
}
