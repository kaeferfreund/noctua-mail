import { useTranslations } from "next-intl";

export default function SendWarnings({ warnings }: { warnings: string[] }) {
  const t = useTranslations("Compose");
  if (!warnings.length) return null;
  return (
    <div
      role="status"
      className="min-w-0 break-words rounded-md p-3 text-sm"
      style={{ background: "var(--amber-3)", color: "var(--amber-11)" }}
    >
      <strong>{t("notices.emailSent")}</strong>
      {warnings.map((warning, i) => (
        <p key={i}>{warning}</p>
      ))}
      <p>{t("warnings.deliverySucceeded")}</p>
    </div>
  );
}
