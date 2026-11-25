"use client";

import { IconCopy, IconDots, IconPencil, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** 只有图标的触发器用 aria-label 命名。点 MenuItem 执行操作并关上菜单；MenuSeparator 把危险操作隔开。 */
export function Example() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3 text-sm">
      <MenuRoot>
        <MenuTrigger
          render={
            <Button variant="outline" size="icon-sm" aria-label="更多操作" />
          }
        >
          <IconDots aria-hidden />
        </MenuTrigger>
        <MenuPortal>
          <MenuPositioner align="start">
            <MenuPopup>
              <MenuItem onClick={() => setLast("重命名")}>
                <IconPencil aria-hidden />
                重命名
              </MenuItem>
              <MenuItem onClick={() => setLast("复制链接")}>
                <IconCopy aria-hidden />
                复制链接
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                className="text-destructive data-highlighted:text-destructive"
                onClick={() => setLast("删除")}
              >
                <IconTrash aria-hidden />
                删除
              </MenuItem>
            </MenuPopup>
          </MenuPositioner>
        </MenuPortal>
      </MenuRoot>
      <p role="status" className="text-muted-foreground">
        {last && `上次操作：${last}`}
      </p>
    </div>
  );
}
