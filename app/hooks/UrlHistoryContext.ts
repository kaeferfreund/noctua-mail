"use client";
import { createContext } from "react";
/** A place tracked by the URL owns its history entry; transient Sheets still own theirs. */
export const UrlHistoryContext = createContext(false);
