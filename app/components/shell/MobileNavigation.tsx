"use client";

import { createContext, useContext } from "react";

export const MobileNavigationContext = createContext<(() => void) | null>(null);
export const useMobileBack = () => useContext(MobileNavigationContext);
