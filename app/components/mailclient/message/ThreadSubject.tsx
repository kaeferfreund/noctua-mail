"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import styles from "./MessageViewPane.module.css";

export default function ThreadSubject({ subject }: { subject: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <div className={styles.subjectGroup}>
    <span id={id} className={styles.subjectText} data-expanded={expanded} title={subject}>
      {subject || "(no subject)"}
    </span>
    <button type="button" className={styles.subjectToggle} aria-controls={id} aria-expanded={expanded}
      aria-label={expanded ? "Collapse subject" : "Expand subject"} onClick={() => setExpanded(value => !value)}>
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
  </div>;
}
