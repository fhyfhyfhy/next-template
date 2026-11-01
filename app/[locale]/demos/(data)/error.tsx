"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface DataDemoErrorProps {
  error: unknown;
  /** Refetches and re-renders the route segment that failed. */
  retry: () => void;
}

/**
 * An unexpected error while rendering a Data demo page, such as a 5xx from the
 * backend during a server read.
 */
export default function DataDemoError({ retry }: DataDemoErrorProps) {
  const t = useTranslations("app.demos.dataError");
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{t("description")}</p>
      <Button className="mt-6" onClick={retry}>
        {t("retry")}
      </Button>
    </div>
  );
}
