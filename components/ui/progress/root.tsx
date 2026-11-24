"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import {
  type NumberFormatOptions,
  useFormatter,
  useTranslations,
} from "next-intl";

import { cn } from "@/lib/cn";

import { ProgressFormattedValueContext } from "./context";

interface ProgressNumbers {
  value: number | null;
  min: number;
  max: number;
  format: NumberFormatOptions | undefined;
}

/**
 * 和 Base UI 算 aria-valuenow、指示条宽度时一样，先把 value 夹在 min 到 max 之间，文字才和进度条对得上。
 * 进度未知（null 或非有限数）时返回 null。
 */
function formatProgress(
  formatter: ReturnType<typeof useFormatter>,
  { value, min, max, format }: ProgressNumbers,
) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  if (format) {
    return formatter.number(Math.min(Math.max(value, min), max), format);
  }
  const ratio = Math.min(Math.max((value - min) / (max - min), 0), 1);
  return formatter.number(Number.isNaN(ratio) ? 0 : ratio, {
    style: "percent",
  });
}

interface ProgressRootProps extends Omit<
  ProgressPrimitive.Root.Props,
  "locale" | "format"
> {
  /** 交给 next-intl 的 `useFormatter().number`；传了时格式化 value 本身，不传时格式化百分比。 */
  format?: NumberFormatOptions;
}

/**
 * 耗时操作的进度；`value` 为 null 时表示进度未知。调用方组合 Label、Value 和 Track。
 * 数值用 next-intl 的 `useFormatter` 按页面语言格式化，所以不开放 Base UI 的 `locale`；
 * `getAriaValueText` 收到的是这个结果。进度未知时读屏读出 `ui.progress.indeterminate`，
 * 所以要放在下发 `ui` namespace 的 next-intl provider 内。
 */
export function ProgressRoot({
  value,
  min = 0,
  max = 100,
  format,
  getAriaValueText,
  className,
  ...props
}: ProgressRootProps) {
  const t = useTranslations();
  const formatter = useFormatter();
  const formattedValue = formatProgress(formatter, { value, min, max, format });
  return (
    <ProgressFormattedValueContext value={formattedValue}>
      <ProgressPrimitive.Root
        data-slot="progress"
        value={value}
        min={min}
        max={max}
        getAriaValueText={(_, rawValue) =>
          getAriaValueText
            ? getAriaValueText(formattedValue ?? "", rawValue)
            : (formattedValue ?? t("ui.progress.indeterminate"))
        }
        className={cn(
          "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2",
          className,
        )}
        {...props}
      />
    </ProgressFormattedValueContext>
  );
}
