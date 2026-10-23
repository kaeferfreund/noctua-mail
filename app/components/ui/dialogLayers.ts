"use client";

import { createContext } from "react";

// Stay above the floating calendar (9990) and below poppers (9998).
// Radix Themes Settings/Admin owns 9995; its children start at 9996.
export const DIALOG_LAYERS = { base: 9994, settings: 9995, step: 1 } as const;
export const DialogLayerContext = createContext<number>(DIALOG_LAYERS.base - DIALOG_LAYERS.step);
