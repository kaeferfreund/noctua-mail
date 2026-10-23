import { useTranslations } from "next-intl";
import { Badge } from "@radix-ui/themes";
import { getFlagBadgeColor } from "@/lib/ui/badgeColors";
import badgeStyles from "./message/MessageBadge.module.css";

type EmailCategory = "newsletter" | "notification" | "transactional";

type CategoryBadgeProps = {
  category: EmailCategory;
  showText?: boolean;
  size?: "1" | "2" | "3";
};

const CATEGORY_CONFIG: Record<EmailCategory, { icon: string }> = {
  newsletter: { icon: "📰" },
  notification: { icon: "🔔" },
  transactional: { icon: "🧾" }
};

export default function CategoryBadge({ category, showText = false, size = "1" }: CategoryBadgeProps) {
  const t = useTranslations("Reader.categories");
  const config = CATEGORY_CONFIG[category];
  if (!config) return null;

  const label = t(category);
  const displayText = showText ? `${config.icon} ${label}` : config.icon;

  return (
    <Badge
      size={size}
      variant="soft"
      color={getFlagBadgeColor(`category-${category}`)}
      className={badgeStyles.badge}
      title={label}
      aria-label={label}
    >
      {displayText}
    </Badge>
  );
}
