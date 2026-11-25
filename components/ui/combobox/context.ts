"use client";

import { createContext } from "react";

import type { ComboboxSize } from "./variants";

export const ComboboxSizeContext = createContext<ComboboxSize>("md");
