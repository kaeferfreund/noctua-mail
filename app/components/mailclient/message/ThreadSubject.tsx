"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import styles from "./MessageViewPane.module.css";

export default function ThreadSubject({ subject }: { subject: string }) {
  const t = useTranslations("Reader");
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <div className={styles.subjectGroup}>
    <span id={id} className={styles.subjectText} data-expanded={expanded} title={subject}>
      {subject || t("noSubject")}
    </span>
    <button type="button" className={styles.subjectToggle} aria-controls={id} aria-expanded={expanded}
      aria-label={expanded ? t("collapseSubject") : t("expandSubject")} onClick={() => setExpanded(value => !value)}>
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
  </div>;
}
