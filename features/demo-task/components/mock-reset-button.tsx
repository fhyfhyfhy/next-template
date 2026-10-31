"use client";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/lib/react-query";

import { resetMockMutationOptions } from "../api/reset-mock";

export function MockResetButton() {
  const reset = useMutation(resetMockMutationOptions());
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        disabled={reset.isPending}
        onClick={() => reset.mutate()}
      >
        重置 Mock 数据
      </Button>
      {reset.isSuccess && (
        <span role="status" className="text-sm text-muted-foreground">
          已重置
        </span>
      )}
    </div>
  );
}
