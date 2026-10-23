import { Maximize2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useComposeContext } from "./ComposeContext";
import styles from "./Compose.module.css";

type ComposeMinimizedProps = {
  open: boolean;
};

export default function ComposeMinimized({ open }: ComposeMinimizedProps) {
  const { composeSubject, setComposeView, setComposeOpen } = useComposeContext();
  const t = useTranslations("Compose");

  if (!open) return null;

  return (
    <div
      className={styles.composeMinimized}
      role="button"
      tabIndex={0}
      onClick={() => setComposeView("modal")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setComposeView("modal");
        }
      }}
    >
      <span className={styles.composeMinimizedTitle}>
        {composeSubject.trim() || t("modes.new")}
      </span>
      <div className={styles.composeMinimizedActions}>
        <button
          className="icon-button small"
          title={t("window.restore")}
          aria-label={t("window.restore")}
          onClick={(event) => {
            event.stopPropagation();
            setComposeView("modal");
          }}
        >
          <Maximize2 size={12} />
        </button>
        <button
          className="icon-button small"
          title={t("closeComposer")}
          aria-label={t("closeComposer")}
          onClick={(event) => {
            event.stopPropagation();
            setComposeOpen(false);
            setComposeView("inline");
          }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
