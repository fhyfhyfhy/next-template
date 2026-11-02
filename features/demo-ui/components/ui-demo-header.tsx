"use client";

import {
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconDeviceDesktop,
  IconMoon,
  IconStack2,
  IconSun,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { LocaleSwitcher } from "@/components/locale-switcher";
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
import { Link } from "@/lib/i18n/navigation";

const themes = [
  { value: "system", icon: IconDeviceDesktop },
  { value: "light", icon: IconSun },
  { value: "dark", icon: IconMoon },
] as const;

/** Brand navigation and the system, light and dark theme picker. */
export function UiDemoHeader() {
  const t = useTranslations("demo-ui.header");
  const { theme, setTheme } = useTheme();
  // The server cannot read localStorage, so the selected theme shows only
  // after hydration.
  const hydrated = useHydrated();
  return (
    <header className="border-b border-border bg-card text-card-foreground">
      <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Link
          href="/demos"
          className="flex items-center gap-3 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-9 items-center justify-center rounded-control bg-primary text-primary-foreground">
            <IconStack2 className="size-6" aria-hidden />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            {t("brand")}
            <span className="ml-1 text-primary">.</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-6">
          <span className="hidden font-mono text-[11px] tracking-widest text-muted-foreground sm:block">
            {t("tagline")}
          </span>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <LocaleSwitcher />
          <SelectRoot
            size="sm"
            items={themes.map(({ value }) => ({
              value,
              label: t(`theme.${value}`),
            }))}
            value={hydrated ? (theme ?? null) : null}
            disabled={!hydrated}
            onValueChange={(value) => {
              if (value) setTheme(value);
            }}
          >
            <SelectTrigger aria-label={t("theme.label")} className="w-30">
              <SelectValue placeholder={t("theme.label")} />
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
                        {t(`theme.${value}`)}
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
            {t("baseUiDocs")}
            <IconArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}
