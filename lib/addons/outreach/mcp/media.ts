import { z } from "zod";
import { getOutreachDb } from "../db";
import { base64ImageLimit, decodeImageBase64, imageFilenameLimit, listOutreachImages, OutreachImageError,
  prepareImage, saveOutreachImage } from "../media";
import type { OutreachMcpHost } from "./index";

const mailbox = z.object({ accountId: z.string().trim().min(1).max(256).optional() });

export function registerOutreachMediaTools({ server, outreachAccount, result }: OutreachMcpHost) {
  server.registerTool("list_email_images", {
    description: "List the mailbox's hosted images and their paths for use in email HTML.",
    inputSchema: mailbox, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    return result("Email images", { ok: true, images: listOutreachImages(await getOutreachDb(), accountId) });
  });
  server.registerTool("upload_email_image", {
    description: "Upload a PNG, JPEG, GIF or WebP (up to 5 MiB). Use the returned image.url in <img src>.",
    inputSchema: mailbox.extend({
      filename: z.string().min(1).max(imageFilenameLimit),
      data: z.string().min(1).max(base64ImageLimit).describe("Base64 file bytes, without a data URL prefix")
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async args => {
    const { accountId, userId } = await outreachAccount(args.accountId, "editor");
    try {
      const image = prepareImage(decodeImageBase64(args.data), args.filename);
      return result("Email image uploaded", await saveOutreachImage(await getOutreachDb(), accountId, image, userId));
    } catch (error) {
      if (error instanceof OutreachImageError) throw error;
      throw new Error("Could not store the email image.");
    }
  });
}
