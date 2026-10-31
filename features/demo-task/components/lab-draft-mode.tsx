"use client";

import { useTranslations } from "next-intl";
import { startTransition, useOptimistic } from "react";

import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";

import { setDraftModeAction } from "../api/set-draft-mode-action";
import { LabSection } from "./lab-section";

interface LabDraftModeProps {
  /** 服务端读到的 `draftMode().isEnabled`。 */
  enabled: boolean;
}

/** 状态存在 cookie 里，由服务端读出后传进来；切换时先显示新状态，失败时 transition 结束，回到服务端给的值。 */
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
                // 不是 React Query 的请求，不经过全局错误处理；用 feature 自己的提示，不占用全局请求错误的 toast ID。
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
