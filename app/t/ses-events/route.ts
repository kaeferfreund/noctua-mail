import { createSnsHandler } from "./sns";

export const runtime = "nodejs";
export const POST = createSnsHandler();
