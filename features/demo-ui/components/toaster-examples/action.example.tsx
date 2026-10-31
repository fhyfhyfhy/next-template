"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export const metadata = {
  title: "撤销操作",
  description: "提示中带一个操作按钮，用户可以在提示消失前撤回刚才的操作。",
  order: 20,
};

/** 归档立即生效，撤销恢复到归档前的状态。 */
export function Example() {
  const [archived, setArchived] = useState(false);
  return (
    <div className="space-y-3 text-center">
      <Button
        variant="outline"
        disabled={archived}
        onClick={() => {
          setArchived(true);
          toast("项目已归档", {
            action: { label: "撤销", onClick: () => setArchived(false) },
          });
        }}
      >
        归档项目
      </Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {archived ? "项目在归档列表中" : "项目在进行中列表中"}
      </p>
    </div>
  );
}
