"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/app/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  OUTREACH_IMAGE_MAX_BYTES, OUTREACH_IMAGE_TYPES,
  type OutreachImage, type OutreachImageListResponse, type OutreachImageType, type OutreachImageUploadResponse
} from "@/lib/addons/outreach/types";
import { useOutreachManage, useResource } from "./manageContext";
import { ErrorNote, LoadingNote, outreachRootClass, useOutreachFormat } from "./ui";

const TYPE_BY_EXTENSION: Record<string, OutreachImageType> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

/**
 * Why a file is not offered for upload, checked before any request: only the raster types the
 * server accepts (by the browser's type, or by the name when the browser reports none) and at
 * most `OUTREACH_IMAGE_MAX_BYTES`. The server checks the bytes again.
 */
export function imageFileRefusal(file: Pick<File, "name" | "type" | "size">): "type" | "size" | null {
  const type = file.type || TYPE_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] || "";
  if (!(OUTREACH_IMAGE_TYPES as readonly string[]).includes(type)) return "type";
  if (file.size > OUTREACH_IMAGE_MAX_BYTES) return "size";
  return null;
}

/** Common content width of a mail; Outlook for Windows shows an image at its `width` attribute and ignores `max-width`. */
export const MAIL_IMAGE_MAX_WIDTH = 600;

/** The `<img>` tag the editors insert; `src` is the server's root-relative URL as given. */
export function imageTag(image: Pick<OutreachImage, "url" | "width">) {
  const src = image.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const head = `<img src="${src}" alt="`;
  const tail = `"${image.width ? ` width="${Math.min(image.width, MAIL_IMAGE_MAX_WIDTH)}"` : ""} style="max-width:100%;height:auto">`;
  /** `altAt`: offset of the empty alt value inside the tag, where the cursor goes after inserting. */
  return { tag: head + tail, altAt: head.length };
}

/**
 * „Bild einfügen“: upload a file from the device or pick one of the mailbox's images. Choosing
 * hands the image to `onChoose`; the dialog stays open and cannot be closed while an upload runs.
 */
export function ImageInsertDialog({ onCancel, onChoose, onCloseAutoFocus }: {
  onCancel: () => void; onChoose: (image: OutreachImage) => void; onCloseAutoFocus: (event: Event) => void;
}) {
  const t = useTranslations("outreach");
  const format = useOutreachFormat();
  const { api } = useOutreachManage();
  const images = useResource(() => api.get<OutreachImageListResponse>("images").then(body => body.images), [api]);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<"type" | "size" | null>(null);
  const [error, setError] = useState<unknown>(null);
  const newestFirst = [...(images.data ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  const maxSize = t("images.maxSize", { size: format.number(OUTREACH_IMAGE_MAX_BYTES / (1024 * 1024)) });

  const upload = async (file: File) => {
    if (uploading.current) return;
    setError(null);
    const refused = imageFileRefusal(file);
    setRefusal(refused);
    if (refused) return;
    uploading.current = true; setBusy(true);
    try {
      const { image } = await api.upload<OutreachImageUploadResponse>("images", { filename: file.name || "image" }, file);
      onChoose(image);
    } catch (caught) {
      setError(caught);
    } finally {
      uploading.current = false; setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !uploading.current) onCancel(); }}>
      <DialogContent showCloseButton={!busy} onCloseAutoFocus={onCloseAutoFocus}
        className={cn(outreachRootClass, "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg")}>
        <DialogTitle>{t("images.title")}</DialogTitle>
        <DialogDescription>{t("images.description")}</DialogDescription>
        <section aria-label={t("images.uploadSection")} className="flex flex-col gap-2">
          <input ref={fileInput} type="file" hidden aria-label={t("images.fileInput")} accept={OUTREACH_IMAGE_TYPES.join(",")}
            onChange={event => {
              const file = event.target.files?.[0];
              // A cleared value lets the same file be chosen again after a refusal.
              event.target.value = "";
              if (file) void upload(file);
            }} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button disabled={busy} onClick={() => fileInput.current?.click()} className="max-md:min-h-11">
              <Upload />{busy ? t("images.uploading") : t("images.upload")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("images.allowed", { maxSize })}</span>
          </div>
          {busy ? <p role="status" className="sr-only">{t("images.uploading")}</p> : null}
          {refusal ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {refusal === "type" ? t("images.refusedType") : t("images.refusedSize", { maxSize })}
            </p>
          ) : null}
          <ErrorNote error={error} />
        </section>
        <section aria-label={t("images.librarySection")} className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-medium">{t("images.librarySection")}</h3>
          <ErrorNote error={images.error} onRetry={() => void images.reload()} />
          {!images.data && images.loading ? <LoadingNote /> : null}
          {images.data && newestFirst.length === 0 ? <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t("images.empty")}</p> : null}
          {newestFirst.length > 0 ? (
            <ul className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto p-0.5 sm:grid-cols-3">
              {newestFirst.map(image => (
                <li key={image.id} className="min-w-0">
                  <button type="button" disabled={busy} onClick={() => onChoose(image)}
                    className="flex w-full min-w-0 flex-col gap-1 rounded-md border p-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- addon image served as stored by /t/m, no optimizer in between */}
                    <img src={image.url} alt="" loading="lazy" className="aspect-[4/3] w-full rounded bg-muted object-contain" />
                    <span className="truncate text-xs font-medium">{image.filename}</span>
                    {image.width && image.height
                      ? <span className="text-xs text-muted-foreground tabular-nums">{t("images.dimensions", { width: format.number(image.width), height: format.number(image.height) })}</span>
                      : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">{t("images.permanentHint")}</p>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>{t("actions.cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
