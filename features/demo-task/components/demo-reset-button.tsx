"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/lib/react-query";

import { resetDemoMutationOptions } from "../api/reset-demo";

export function DemoResetButton() {
  const t = useTranslations("demo-task.demoReset");
  const reset = useMutation(resetDemoMutationOptions());
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        disabled={reset.isPending}
        onClick={() => reset.mutate()}
      >
        {t("button")}
      </Button>
      {reset.isSuccess && (
        <span role="status" className="text-sm text-muted-foreground">
          {t("done")}
        </span>
      )}
    </div>
  );
}
