import { createContext } from "react";

export type MessageMenuControl = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Lets a row wrapper open the row's ⋮ message menu (the phone swipe action
 * "Mehr"). Without a provider the menu manages its own open state.
 */
export const MessageMenuControlContext = createContext<MessageMenuControl | null>(null);
