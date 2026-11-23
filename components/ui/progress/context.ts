"use client";

import { createContext } from "react";

/** ProgressRoot 用 next-intl 格式化好的进度文字，进度未知时为 null；ProgressValue 显示它。 */
export const ProgressFormattedValueContext = createContext<string | null>(null);
