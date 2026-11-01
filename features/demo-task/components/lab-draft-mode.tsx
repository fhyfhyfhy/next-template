"use client";

import { useTranslations } from "next-intl";
import { startTransition, useOptimistic } from "react";

import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";

import { setDraftModeAction } from "../api/set-draft-mode-action";
import { LabSection } from "./lab-section";

interface LabDraftModeProps {
  /** `draftMode().isEnabled` as the server read it. */
  enabled: boolean;
}

/**
 * The state lives in a cookie that the server reads and passes in. A toggle
 * shows the new state at once; on failure the transition ends and it returns to
 * the server's value.
 */
export function LabDraftMode({ enabled }: LabDraftModeProps) {
  const t = useTranslations("demo-task.labDraftMode");
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);
  return (
    <LabSection title={t("title")} description={t("description")}>
      <label className="flex items-center gap-3 text-sm">
        <SwitchRoot
          checked={optimisticEnabled}
          onCheckedChange={(checked) => {
            startTransition(async () => {
              setOptimisticEnabled(checked);
              try {
                await setDraftModeAction(checked);
              } catch {
                // Not a React Query request, so the global error handling
                // doesn't see it. Use the feature's own toast and leave the
                // toast ID of global request errors alone.
                toast.error(t("switchFailed"));
              }
            });
          }}
        >
          <SwitchThumb />
        </SwitchRoot>
        {t("switchLabel")}
      </label>
    </LabSection>
  );
}
