"use client";

import {
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

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

interface UiCatalogHeaderProps {
  /** 应用的品牌链接，放在左侧。 */
  brand: ReactNode;
  /** 整个应用共用的操作，比如切换语言，放在主题选择之前。 */
  actions: ReactNode;
}

/** 目录的 header：调用方给的品牌和操作，以及系统、浅色、深色主题选择。 */
export function UiCatalogHeader({ brand, actions }: UiCatalogHeaderProps) {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  // 服务端无法读取 localStorage；hydration 完成前不显示已选主题。
  const hydrated = useHydrated();
  return (
    <header className="border-b border-border bg-card text-card-foreground">
      <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        {brand}
        <div className="flex items-center gap-3 sm:gap-6">
          <span className="hidden font-mono text-[11px] tracking-widest text-muted-foreground sm:block">
            {t("ui-catalog.header.tagline")}
          </span>
          <span className="hidden h-5 w-px bg-border sm:block" />
          {actions}
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
              <SelectPositioner sideOffset={6} alignItemWithTrigger={false}>
                <SelectPopup>
                  {themes.map(({ value, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <Icon className="size-4" aria-hidden />
                      <SelectItemText className="flex-1">
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
          <a
            href="https://base-ui.com/react/overview/quick-start"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex"
          >
            {t("ui-catalog.header.baseUiDocs")}
            <IconArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}
