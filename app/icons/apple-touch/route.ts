import { renderEnvIcon } from "@/lib/ui/envIcon";

// Read APP_ENV_LABEL at request time so the badge reflects the deployment.
export const dynamic = "force-dynamic";

// iOS masks home-screen icons itself and fills transparency with black, so the
// touch icon uses opaque full-bleed art instead of the rounded, padded base.
export function GET() {
  return renderEnvIcon({ size: 180, baseFile: "apple-touch-180.png" });
}
