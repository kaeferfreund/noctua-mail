"use client";

import { createContext } from "react";

// JS mirror of the globals.css layer tokens, needed for per-level arithmetic:
// base = --layer-dialog, settings = --layer-dialog-overlay (Radix Themes
// Settings/Admin); its children start at 9996, below --layer-popper.
export const DIALOG_LAYERS = { base: 9994, settings: 9995, step: 1 } as const;
export const DialogLayerContext = createContext<number>(DIALOG_LAYERS.base - DIALOG_LAYERS.step);
