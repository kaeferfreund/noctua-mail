import { useTranslations } from "next-intl";
import { useId } from "react";
import { ALargeSmall, Minus, Plus } from "lucide-react";
import { Theme } from "@radix-ui/themes";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import mobileStyles from "@/app/components/shell/MobileFrames.module.css";
import menuStyles from "./MessageMenu.module.css";
import headerStyles from "./MessageHeaderControls.module.css";
import styles from "./MessageDisplayOptionsMenu.module.css";
import { useMessageMenuPrimitives } from "./messageMenuPrimitives";
import type { MessageTab } from "./types";

const SCALE_STEP = 0.1;

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

type StepperLabels = {
  title: string;
  decrease: string;
  reset: string;
  increase: string;
};

type MessageDisplayOptionsMenuProps = {
  /** Body formats this message offers, in menu order. */
  formats: readonly MessageTab[];
  format: MessageTab;
  /** The format the message opens in; any other choice is flagged on the trigger. */
  defaultFormat: MessageTab;
  onFormatChange: (format: MessageTab) => void;
  textScale: number;
  onAdjustTextScale: (delta: number) => void;
  onResetTextScale: () => void;
  zoom: number;
  onAdjustZoom: (delta: number) => void;
  onResetZoom: () => void;
};

/**
 * Per-message "Display options" menu in the thread card header: body format
 * (HTML / Plain text / Markdown / Source), text size and HTML zoom. When the
 * message is not shown in its default presentation the trigger turns accent
 * and a short chip names the deviation, so a changed rendering stays explicable.
 */
export default function MessageDisplayOptionsMenu({
  formats,
  format,
  defaultFormat,
  onFormatChange,
  textScale,
  onAdjustTextScale,
  onResetTextScale,
  zoom,
  onAdjustZoom,
  onResetZoom
}: MessageDisplayOptionsMenuProps) {
  const t = useTranslations("Reader");
  const FORMAT_LABELS: Record<MessageTab, string> = {
    html: "HTML",
    text: t("plainText"),
    markdown: t("markdown"),
    source: t("source")
  };

  const TEXT_SIZE_LABELS: StepperLabels = {
    title: t("textSize"),
    decrease: t("decreaseText"),
    reset: t("resetText"),
    increase: t("increaseText")
  };

  const ZOOM_LABELS: StepperLabels = {
    title: t("zoom"),
    decrease: t("zoomOut"),
    reset: t("resetZoom"),
    increase: t("zoomIn")
  };

  const { isMobile, DropdownMenu } = useMessageMenuPrimitives();
  const formatLabelId = useId();
  const textSizeLabelId = useId();
  const zoomLabelId = useId();
  // Same visibility rules as the panels: Source ignores text size, and only
  // the HTML renderer applies zoom.
  const showTextSize = format !== "source";
  const showZoom = format === "html";
  const showFormats = formats.length > 1;
  const summary = [
    format !== defaultFormat ? FORMAT_LABELS[format] : null,
    showTextSize && textScale !== 1 ? t("textScale", { percent: formatPercent(textScale) }) : null,
    showZoom && zoom !== 1 ? t("zoomScale", { percent: formatPercent(zoom) }) : null
  ]
    .filter(Boolean)
    .join(" · ");
  const triggerLabel = summary ? t("displayOptionsSummary", { summary }) : t("displayOptions");

  // The steppers are menu items (not plain buttons) so arrow keys reach them;
  // preventDefault keeps the menu open while the user steps the value. Focus
  // stays on the pressed item, so its name carries the current value.
  const renderStepper = (
    labelId: string,
    labels: StepperLabels,
    value: number,
    onAdjust: (delta: number) => void,
    onReset: () => void
  ) => (
    <DropdownMenu.Group aria-labelledby={labelId} className={styles.stepper}>
      <DropdownMenu.Label id={labelId} className={`${styles.menuLabel} ${styles.stepperLabel}`}>
        {labels.title}
      </DropdownMenu.Label>
      <DropdownMenu.Item
        className={styles.stepperItem}
        aria-label={t("stepperCurrent", { action: labels.decrease, percent: formatPercent(value) })}
        onSelect={(event) => {
          event.preventDefault();
          onAdjust(-SCALE_STEP);
        }}
      >
        <Minus size={14} aria-hidden />
      </DropdownMenu.Item>
      <DropdownMenu.Item
        className={`${styles.stepperItem} ${styles.stepperValue}`}
        aria-label={t("stepperReset", { action: labels.reset, percent: formatPercent(value) })}
        onSelect={(event) => {
          event.preventDefault();
          onReset();
        }}
      >
        {formatPercent(value)}
      </DropdownMenu.Item>
      <DropdownMenu.Item
        className={styles.stepperItem}
        aria-label={t("stepperCurrent", { action: labels.increase, percent: formatPercent(value) })}
        onSelect={(event) => {
          event.preventDefault();
          onAdjust(SCALE_STEP);
        }}
      >
        <Plus size={14} aria-hidden />
      </DropdownMenu.Item>
    </DropdownMenu.Group>
  );

  return (
    <span className={styles.displayOptions}>
      {summary ? (
        // The trigger's label already carries the summary for assistive tech.
        <span className={styles.displayChip} aria-hidden="true">
          {summary}
        </span>
      ) : null}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <TooltipIconButton
            size="2"
            variant="ghost"
            color={summary ? undefined : "gray"}
            className={
              [summary ? headerStyles.toggleActive : null, isMobile ? mobileStyles.messageMore : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            tooltip={triggerLabel}
          >
            <ALargeSmall size={14} />
          </TooltipIconButton>
        </DropdownMenu.Trigger>
        <Theme asChild>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className={`${menuStyles.menuContent} ${isMobile ? mobileStyles.messageMenu : ""}`}
          >
            {showFormats ? (
              <>
                <DropdownMenu.Label id={formatLabelId} className={styles.menuLabel}>{t("showAs")}</DropdownMenu.Label>
                <DropdownMenu.RadioGroup
                  value={format}
                  aria-labelledby={formatLabelId}
                  // Radix also reports the already-checked item; re-picking
                  // Source must not download the raw message again.
                  onValueChange={(value) => {
                    const next = formats.find((option) => option === value);
                    if (next && next !== format) onFormatChange(next);
                  }}
                >
                  {formats.map((option) => (
                    <DropdownMenu.RadioItem key={option} value={option} className={styles.formatItem}>
                      {FORMAT_LABELS[option]}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </>
            ) : null}
            {showFormats && showTextSize ? <DropdownMenu.Separator /> : null}
            {showTextSize
              ? renderStepper(
                  textSizeLabelId,
                  TEXT_SIZE_LABELS,
                  textScale,
                  onAdjustTextScale,
                  onResetTextScale
                )
              : null}
            {showZoom
              ? renderStepper(zoomLabelId, ZOOM_LABELS, zoom, onAdjustZoom, onResetZoom)
              : null}
          </DropdownMenu.Content>
        </Theme>
      </DropdownMenu.Root>
    </span>
  );
}
