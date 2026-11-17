"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

/**
 * 耗时操作的进度；`value` 为 null 时表示进度未知。调用方组合 Label、Value 和 Track。
 * 百分比按页面语言格式化（不传 `locale` 时），进度未知时读屏读出 `ui.progress.indeterminate`，
 * 所以要放在下发 `ui` namespace 的 next-intl provider 内。
 */
export function ProgressRoot({
  locale,
  getAriaValueText,
  className,
  ...props
}: ProgressPrimitive.Root.Props) {
  const appLocale = useLocale();
  const t = useTranslations();
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      locale={locale ?? appLocale}
      getAriaValueText={
        getAriaValueText ??
        ((formattedValue) => formattedValue || t("ui.progress.indeterminate"))
      }
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2",
        className,
      )}
      {...props}
    />
  );
}
