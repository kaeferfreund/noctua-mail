import { useTranslations } from "next-intl";
import { AUTO_MARK_READ_MODES } from "@/lib/autoMarkRead";
import type { AutoMarkReadMode } from "@/lib/data";
import { nativeControlClass } from "./Field";

export default function AutoMarkReadControl({ label, value, onChange, inherit = false, describedBy }: {
  label: string; value: AutoMarkReadMode | "inherit"; onChange: (value: AutoMarkReadMode | "inherit") => void;
  inherit?: boolean; describedBy?: string;
}) {
  const t = useTranslations("Settings");
  return <label className="grid min-w-0 gap-1 text-sm">{label}
    <select className={nativeControlClass} value={value} aria-describedby={describedBy}
      onChange={event => onChange(event.target.value as AutoMarkReadMode | "inherit")}>
      {inherit && <option value="inherit">{t("preferences.inherit")}</option>}
      {AUTO_MARK_READ_MODES.map(mode => <option key={mode} value={mode}>{t(`preferences.options.${mode}`)}</option>)}
    </select>
  </label>;
}
