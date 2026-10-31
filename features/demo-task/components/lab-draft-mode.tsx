"use client";

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
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);
  return (
    <LabSection
      title="跳过服务端缓存"
      description="开启 Draft Mode 后，这个浏览器的每次请求都重新执行 use cache 函数，生产构建里也能立即看到后端的最新数据。结果不写入缓存，关掉后读到的仍是开启前缓存的数据。只影响当前浏览器，关闭浏览器后也会恢复。"
    >
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
                toast.error("切换失败，请稍后重试");
              }
            });
          }}
        >
          <SwitchThumb />
        </SwitchRoot>
        Draft Mode
      </label>
    </LabSection>
  );
}
