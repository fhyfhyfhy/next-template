"use client";

import { createContext } from "react";

import type { SelectSize } from "./variants";

export const SelectSizeContext = createContext<SelectSize>("md");
