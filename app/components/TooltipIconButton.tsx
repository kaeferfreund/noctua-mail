import { forwardRef, type ComponentPropsWithoutRef, type FocusEvent } from "react";
import { IconButton, Tooltip } from "@radix-ui/themes";
import { markTooltipEscape } from "@/lib/ui/tooltipEscape";

type TooltipIconButtonProps = Omit<ComponentPropsWithoutRef<typeof IconButton>, "title"> & {
  tooltip: string;
  tooltipSide?: ComponentPropsWithoutRef<typeof Tooltip>["side"];
};

/**
 * Menus and dialogs return focus to their trigger on close; preventing
 * default keeps Radix from reopening the tooltip for that programmatic focus.
 */
export function suppressTooltipOnProgrammaticFocus(event: FocusEvent<HTMLElement>) {
  if (!event.currentTarget.matches(":focus-visible")) {
    event.preventDefault();
  }
}

const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
  function TooltipIconButton({ tooltip, tooltipSide, onFocus, ...props }, ref) {
    const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
      onFocus?.(event);
      suppressTooltipOnProgrammaticFocus(event);
    };

    return (
      <Tooltip content={tooltip} side={tooltipSide} onEscapeKeyDown={markTooltipEscape}>
        <IconButton aria-label={tooltip} {...props} ref={ref} onFocus={handleFocus} />
      </Tooltip>
    );
  }
);

export default TooltipIconButton;
