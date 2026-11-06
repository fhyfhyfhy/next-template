"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/lib/react-query";

import { resetDemoMutationOptions } from "../api/reset-demo";

export function DemoResetButton() {
  const t = useTranslations();
  const reset = useMutation(resetDemoMutationOptions(t));
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        disabled={reset.isPending}
        onClick={() => reset.mutate()}
      >
        {t("demo-lab.demoReset.button")}
      </Button>
      {reset.isSuccess && (
        <span role="status" className="text-sm text-muted-foreground">
          {t("demo-lab.demoReset.done")}
        </span>
      )}
    </div>
  );
}
