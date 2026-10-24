"use client";
import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Archive, ArrowLeft, ArrowRightLeft, CheckCheck, ChevronLeft, ChevronRight, Maximize2, Minimize2, Printer, Shield, ShieldOff, SquareArrowOutUpRight, Tags, Trash2, X } from "lucide-react";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import type { ReaderLayout } from "@/lib/ui/readerFocus";
import styles from "./ReaderToolbar.module.css";

type Props = {
  layout: ReaderLayout; toggleLayout: () => void; back: () => void;
  archive: () => void; spam: () => void; inSpam: boolean; remove: () => void; move: () => void; topics: () => void;
  done: () => void; isDone: boolean; busy: boolean; renderMenu: () => ReactNode; openWindow: () => void;
  position: number; total: number; hasMore: boolean; previous: () => void; next: () => void;
  canPrevious: boolean; canNext: boolean; navigating: boolean;
  /** Prints the reader; defaults to window.print(). */
  print?: () => void;
};
export default function ReaderToolbar(props: Props) {
  const t = useTranslations("Reader");
  const positionId = useId();
  const focus = props.layout === "focus";
  const action = (label: string, icon: ReactNode, onClick: () => void, disabled = props.busy, shortcut?: string) =>
    <TooltipIconButton size="2" variant="ghost" color="gray" tooltip={shortcut ? `${label} (${shortcut})` : label} aria-label={label} aria-keyshortcuts={shortcut} onClick={onClick} disabled={disabled}>{icon}</TooltipIconButton>;
  // The split reader has no actions of its own: MessageViewOrchestrator places this
  // group (Expand only) in the thread header's subject row instead of a row of its own.
  return <div className={focus ? styles.root : styles.inline} role="group" aria-label={t("focus.toolbarLabel")} data-reader-toolbar="" data-focus={focus}>
    <div className={styles.row}>
      {focus ? <>
        {action(t("backMessages"), <ArrowLeft size={18} />, props.back, false, "Escape")}
        <div className={styles.actions}>
          {action(t("archive"), <Archive size={17} />, props.archive)}
          {action(t(props.inSpam ? "notSpam" : "markSpam"), props.inSpam ? <ShieldOff size={17} /> : <Shield size={17} />, props.spam)}
          {action(t("delete"), <Trash2 size={17} />, props.remove)}
          {action(t("moveTo"), <ArrowRightLeft size={17} />, props.move)}
          {action(t("topics"), <Tags size={17} />, props.topics)}
          {action(t(props.isDone ? "focus.markUndone" : "markDone"), <CheckCheck size={17} />, props.done)}
          {props.renderMenu()}
        </div>
        <div className={styles.navigation}>
          {action(t("openWindow"), <SquareArrowOutUpRight size={16} />, props.openWindow, false)}
          {action(t("focus.print"), <Printer size={16} />, props.print ?? (() => window.print()), false)}
          <span className={styles.counter} data-reader-position="" aria-live="polite" aria-describedby={positionId} title={t(props.hasMore ? "focus.loadedPosition" : "focus.position", { position: props.position, total: props.total })}>{t(props.hasMore ? "focus.counterMore" : "focus.counter", { position: props.position, total: props.total })}</span>
          <span id={positionId} className="sr-only">{t(props.hasMore ? "focus.loadedPosition" : "focus.position", { position: props.position, total: props.total })}</span>
          {action(t("focus.previous"), <ChevronLeft size={18} />, props.previous, !props.canPrevious || props.navigating, "k")}
          {action(t("focus.next"), <ChevronRight size={18} />, props.next, !props.canNext || props.navigating, "j")}
        </div>
      </> : null}
      <TooltipIconButton size="2" variant="ghost" color="gray" aria-label={t(focus ? "focus.showList" : "focus.expand")} tooltip={`${t(focus ? "focus.showList" : "focus.expand")} (Shift+Enter)`} aria-keyshortcuts="Shift+Enter" onClick={props.toggleLayout}>
        {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </TooltipIconButton>
    </div>
  </div>;
}

/** One-time split-layout tip, shown under the thread subject. */
export function ReaderFocusHint({ dismiss }: { dismiss: () => void }) {
  const t = useTranslations("Reader");
  return <div className={styles.hint} data-reader-hint="">
    <span title={t("focus.hint")}>{t("focus.hint")}</span>
    <TooltipIconButton size="2" variant="ghost" color="gray" tooltip={t("focus.dismissHint")} aria-label={t("focus.dismissHint")} onClick={dismiss}><X size={12} /></TooltipIconButton>
  </div>;
}
