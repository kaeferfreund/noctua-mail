"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Archive, ArrowLeft, ArrowRightLeft, CheckCheck, ChevronLeft, ChevronRight, Maximize2, Minimize2, Printer, Shield, ShieldOff, SquareArrowOutUpRight, Tags, Trash2, X } from "lucide-react";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import type { ReaderLayout } from "@/lib/ui/readerFocus";
import styles from "./ReaderToolbar.module.css";

type Props = {
  layout: ReaderLayout; showHint: boolean; dismissHint: () => void; toggleLayout: () => void; back: () => void;
  archive: () => void; spam: () => void; inSpam: boolean; remove: () => void; move: () => void; topics: () => void;
  done: () => void; isDone: boolean; busy: boolean; menu: ReactNode; openWindow: () => void;
  position: number; total: number; hasMore: boolean; previous: () => void; next: () => void;
  canPrevious: boolean; canNext: boolean; navigating: boolean;
};
export default function ReaderToolbar(props: Props) {
  const t = useTranslations("Reader");
  const focus = props.layout === "focus";
  const action = (label: string, icon: ReactNode, onClick: () => void, disabled = props.busy) =>
    <TooltipIconButton size="2" variant="ghost" color="gray" tooltip={label} onClick={onClick} disabled={disabled}>{icon}</TooltipIconButton>;
  return <div className={styles.root} data-reader-toolbar="" data-focus={focus}>
    <div className={styles.row}>
      {focus ? <>
        {action(t("backMessages"), <ArrowLeft size={18} />, props.back, false)}
        <div className={styles.actions}>
          {action(t("archive"), <Archive size={17} />, props.archive)}
          {action(t(props.inSpam ? "notSpam" : "markSpam"), props.inSpam ? <ShieldOff size={17} /> : <Shield size={17} />, props.spam)}
          {action(t("delete"), <Trash2 size={17} />, props.remove)}
          {action(t("moveTo"), <ArrowRightLeft size={17} />, props.move)}
          {action(t("topics"), <Tags size={17} />, props.topics)}
          {action(t(props.isDone ? "focus.markUndone" : "markDone"), <CheckCheck size={17} />, props.done)}
          {props.menu}
        </div>
        <div className={styles.navigation}>
          {action(t("openWindow"), <SquareArrowOutUpRight size={16} />, props.openWindow, false)}
          {action(t("focus.print"), <Printer size={16} />, () => window.print(), false)}
          <span className={styles.counter} data-reader-position="" aria-live="polite" title={t(props.hasMore ? "focus.loadedPosition" : "focus.position", { position: props.position, total: props.total })}>{t(props.hasMore ? "focus.counterMore" : "focus.counter", { position: props.position, total: props.total })}</span>
          {action(t("focus.previous"), <ChevronLeft size={18} />, props.previous, !props.canPrevious || props.navigating)}
          {action(t("focus.next"), <ChevronRight size={18} />, props.next, !props.canNext || props.navigating)}
        </div>
      </> : null}
      <TooltipIconButton size="2" variant="ghost" color="gray" className={styles.expand} tooltip={t(focus ? "focus.showList" : "focus.expand")} aria-keyshortcuts="Shift+Enter" onClick={props.toggleLayout}>
        {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{t(focus ? "focus.showList" : "focus.expand")}</span>
      </TooltipIconButton>
    </div>
    {!focus && props.showHint ? <div className={styles.hint}>
      <span title={t("focus.hint")}>{t("focus.hint")}</span>
      {action(t("focus.dismissHint"), <X size={12} />, props.dismissHint, false)}
    </div> : null}
    <div className={styles.shortcuts}>{t("focus.shortcuts")}</div>
  </div>;
}
