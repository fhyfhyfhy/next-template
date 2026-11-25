"use client";

import { createContext } from "react";

import type { TabsSize } from "./variants";

export const TabsSizeContext = createContext<TabsSize>("md");
