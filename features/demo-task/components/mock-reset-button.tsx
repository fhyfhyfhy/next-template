"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/lib/react-query";

import { resetMockMutationOptions } from "../api/reset-mock";

export function MockResetButton() {
  const t = useTranslations("demo-task.mockReset");
  const reset = useMutation(resetMockMutationOptions());
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
