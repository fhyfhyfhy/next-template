"use client";

import {
  IconCheck,
  IconChevronDown,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import {
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHydrated } from "@/hooks/use-hydrated";

const themes = [
  { value: "system", icon: IconDeviceDesktop },
  { value: "light", icon: IconSun },
  { value: "dark", icon: IconMoon },
] as const;

/** 系统、浅色、深色主题选择。 */
export function ThemeSelect() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  // 服务端无法读取 localStorage；hydration 完成前不显示已选主题。
  const hydrated = useHydrated();
  return (
    <SelectRoot
      size="sm"
      items={themes.map(({ value }) => ({
        value,
        label: t(`ui-catalog.header.theme.${value}`),
      }))}
      value={hydrated ? (theme ?? null) : null}
      disabled={!hydrated}
      onValueChange={(value) => {
        if (value) setTheme(value);
      }}
    >
      <SelectTrigger
        aria-label={t("ui-catalog.header.theme.label")}
        className="w-30"
      >
        <SelectValue placeholder={t("ui-catalog.header.theme.label")} />
        <SelectIcon>
          <IconChevronDown className="size-4" aria-hidden />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectPositioner>
          <SelectPopup>
            {themes.map(({ value, icon: Icon }) => (
              <SelectItem key={value} value={value}>
                <Icon className="size-4" aria-hidden />
                <SelectItemText>
                  {t(`ui-catalog.header.theme.${value}`)}
                </SelectItemText>
                <SelectItemIndicator>
                  <IconCheck className="size-4" aria-hidden />
                </SelectItemIndicator>
              </SelectItem>
            ))}
          </SelectPopup>
        </SelectPositioner>
      </SelectPortal>
    </SelectRoot>
  );
}
