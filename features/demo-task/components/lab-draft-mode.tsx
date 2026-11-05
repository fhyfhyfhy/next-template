"use client";

import { useTranslations } from "next-intl";
import { startTransition, useOptimistic } from "react";

import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";
import { useMutation } from "@/lib/react-query";

import { setDraftModeMutationOptions } from "../api/set-draft-mode";
import { LabSection } from "./lab-section";

interface LabDraftModeProps {
  /** 服务端读到的 `draftMode().isEnabled`。 */
  enabled: boolean;
}

/** 状态存在 cookie 里，由服务端读出后传进来；切换时先显示新状态，失败时 transition 结束，回到服务端给的值。 */
export function LabDraftMode({ enabled }: LabDraftModeProps) {
  const t = useTranslations("demo-task");
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);
  const setDraftMode = useMutation(setDraftModeMutationOptions(t));
  return (
    <LabSection
      title={t("labDraftMode.title")}
      description={t("labDraftMode.description")}
    >
      <label className="flex items-center gap-3 text-sm">
        <SwitchRoot
          checked={optimisticEnabled}
          onCheckedChange={(checked) => {
            startTransition(async () => {
              setOptimisticEnabled(checked);
              try {
                await setDraftMode.mutateAsync(checked);
              } catch {
                // 失败由工厂 meta.errorMessage 的 toast 提示；这里只接住 rejection，免得它冒到错误边界。
              }
            });
          }}
        >
          <SwitchThumb />
        </SwitchRoot>
        {t("labDraftMode.switchLabel")}
      </label>
    </LabSection>
  );
}
