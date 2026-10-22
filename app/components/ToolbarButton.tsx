import type { ComponentProps, FocusEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { suppressTooltipOnProgrammaticFocus } from "./TooltipIconButton";

type ToolbarButtonProps = Omit<
  ComponentProps<typeof Button>,
  "title" | "children" | "size" | "variant"
> & {
  /** Names the control and its current state, e.g. "View: Threads". Used as
   * the accessible name and the tooltip, so it must contain the visible `label`. */
  tooltip: string;
  icon: ReactNode;
  /** Short visible state next to the icon, e.g. the current sort. */
  label?: string;
  /** Extra classes for the label, e.g. to hide it in a narrow header. */
  labelClassName?: string;
  /** Adds a chevron that marks the button as a menu trigger. Render it inside
   * a `DropdownMenuTrigger asChild`. */
  menu?: boolean;
};

/**
 * Quiet ghost button for the shell header: 28px like the header's other
 * controls, 32px on phones to match the mobile header buttons. Menu chevrons
 * show only in a header of at least 48rem (`@container/header`). Needs the
 * shell's `TooltipProvider`.
 */
export default function ToolbarButton({
  tooltip,
  icon,
  label,
  labelClassName,
  menu = false,
  className,
  onFocus,
  ...props
}: ToolbarButtonProps) {
  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event);
    // Closing a menu returns focus to its trigger; only keyboard focus should
    // reopen the tooltip.
    suppressTooltipOnProgrammaticFocus(event);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={menu || label ? "sm" : "icon-sm"}
          aria-label={tooltip}
          {...props}
          className={cn(
            "text-muted-foreground hover:text-foreground aria-expanded:text-foreground",
            menu || label ? "gap-0.5 px-1.5 max-md:h-8 max-md:min-w-8" : "max-md:size-8",
            className
          )}
          onFocus={handleFocus}
        >
          {icon}
          {label ? <span className={cn("ml-0.5 inline-block max-w-28 truncate", labelClassName)}>{label}</span> : null}
          {menu ? <ChevronDown className="hidden size-3 opacity-60 @3xl/header:block" /> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
