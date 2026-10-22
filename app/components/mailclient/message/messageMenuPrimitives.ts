import { DropdownMenu as ThemesDropdownMenu } from "@radix-ui/themes";
import * as MobileMenu from "@/app/components/ui/dropdown-menu";
import { useIsMobile } from "@/app/hooks/use-mobile";

// Mobile swaps in the shadcn primitives (touch-sized rows); both sets wrap the
// same Radix menu, so a menu tree can use either part family interchangeably.
const mobileMenu = {
  Root: MobileMenu.DropdownMenu,
  Trigger: MobileMenu.DropdownMenuTrigger,
  Content: MobileMenu.DropdownMenuContent,
  Item: MobileMenu.DropdownMenuItem,
  Group: MobileMenu.DropdownMenuGroup,
  RadioGroup: MobileMenu.DropdownMenuRadioGroup,
  RadioItem: MobileMenu.DropdownMenuRadioItem,
  Sub: MobileMenu.DropdownMenuSub,
  SubTrigger: MobileMenu.DropdownMenuSubTrigger,
  SubContent: MobileMenu.DropdownMenuSubContent,
  Label: MobileMenu.DropdownMenuLabel,
  Separator: MobileMenu.DropdownMenuSeparator
};

/**
 * Dropdown parts for per-message menus (the ⋮ message menu and the display
 * options menu): Radix Themes on desktop, shadcn primitives on mobile.
 */
export function useMessageMenuPrimitives() {
  const isMobile = useIsMobile();
  return { isMobile, DropdownMenu: isMobile ? mobileMenu : ThemesDropdownMenu };
}
