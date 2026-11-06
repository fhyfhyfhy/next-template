"use client";

import { IconStar, IconStarFilled, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "只有图标",
  description:
    "icon-sm、icon-md、icon-lg 是和 sm、md、lg 等高的正方形按钮，用 aria-label 提供名称；切换状态用 aria-pressed。",
  order: 40,
};

/** 图标按钮没有可见文字，aria-label 就是读屏读出的名称。 */
export function Example() {
  const [starred, setStarred] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="收藏"
        aria-pressed={starred}
        className="text-muted-foreground not-data-disabled:hover:text-primary aria-pressed:text-primary"
        onClick={() => setStarred(!starred)}
      >
        {starred ? <IconStarFilled aria-hidden /> : <IconStar aria-hidden />}
      </Button>
      <Button variant="outline" size="icon-md" aria-label="删除">
        <IconTrash aria-hidden />
      </Button>
      <Button variant="outline" size="icon-lg" aria-label="删除">
        <IconTrash aria-hidden />
      </Button>
    </div>
  );
}
