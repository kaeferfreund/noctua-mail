import { forwardRef, type ComponentPropsWithoutRef, type FocusEvent, type ReactNode } from "react";
import { Button, Tooltip } from "@radix-ui/themes";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { suppressTooltipOnProgrammaticFocus } from "./TooltipIconButton";
import styles from "./ToolbarMenuTrigger.module.css";

type ToolbarMenuTriggerProps = Omit<
  ComponentPropsWithoutRef<typeof Button>,
  "title" | "children"
> & {
  /** Names the menu and its current state, e.g. "View: Threads". Used as the
   * accessible name and the tooltip, so it must contain the visible `label`. */
  tooltip: string;
  tooltipSide?: ComponentPropsWithoutRef<typeof Tooltip>["side"];
  icon: ReactNode;
  /** Short visible state next to the icon, e.g. the current sort. Omit it for
   * an icon-only trigger. */
  label?: string;
};

/**
 * Quiet 24px ghost trigger for toolbar dropdown menus: icon, optional state
 * label and a chevron that marks it as a menu. Render it inside a
 * `DropdownMenuTrigger asChild`; the menu's `data-state="open"` keeps the
 * hover tint while the menu is open.
 */
const ToolbarMenuTrigger = forwardRef<HTMLButtonElement, ToolbarMenuTriggerProps>(
  function ToolbarMenuTrigger(
    { tooltip, tooltipSide, icon, label, className, onFocus, ...props },
    ref
  ) {
    const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
      onFocus?.(event);
      suppressTooltipOnProgrammaticFocus(event);
    };

    return (
      <Tooltip content={tooltip} side={tooltipSide}>
        <Button
          size="1"
          variant="ghost"
          color="gray"
          aria-label={tooltip}
          {...props}
          ref={ref}
          className={cn(styles.trigger, className)}
          onFocus={handleFocus}
        >
          {icon}
          {label ? <span className={styles.label}>{label}</span> : null}
          <ChevronDown size={12} className={styles.chevron} />
        </Button>
      </Tooltip>
    );
  }
);

export default ToolbarMenuTrigger;
