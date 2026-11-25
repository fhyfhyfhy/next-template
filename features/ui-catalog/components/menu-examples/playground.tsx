"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MenuGroupLabel,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";

export interface MenuConfig {
  side: "top" | "bottom" | "left" | "right";
  align: "start" | "center" | "end";
  closeOnClick: boolean;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: MenuConfig = (/* @example-config */ {
  "side": "bottom",
  "align": "start",
  "closeOnClick": false
} /* @end-example-config */);

const sorts = [
  { value: "newest", label: "最新创建" },
  { value: "oldest", label: "最早创建" },
  { value: "name", label: "名称" },
];

/**
 * 不传参数时使用初始配置；UI catalog 页面传入面板里的配置。选中的排序方式由这里持有。MenuRadioItem 和
 * MenuCheckboxItem 默认点选后不关菜单，closeOnClick 让它关上；MenuItem 默认关上。
 */
export function MenuPlayground({
  config = initialConfig,
}: { config?: MenuConfig } = {}) {
  const [sort, setSort] = useState("newest");
  return (
    <div className="flex justify-center py-6">
      <MenuRoot>
        <MenuTrigger render={<Button variant="outline" />}>
          排序
          <IconChevronDown aria-hidden />
        </MenuTrigger>
        <MenuPortal>
          <MenuPositioner side={config.side} align={config.align}>
            <MenuPopup>
              <MenuRadioGroup value={sort} onValueChange={setSort}>
                <MenuGroupLabel>排序方式</MenuGroupLabel>
                {sorts.map(({ value, label }) => (
                  <MenuRadioItem
                    key={value}
                    value={value}
                    closeOnClick={config.closeOnClick}
                  >
                    {label}
                    <span className="ml-auto flex size-4 items-center justify-center">
                      <MenuRadioItemIndicator>
                        <IconCheck className="size-3.5" aria-hidden />
                      </MenuRadioItemIndicator>
                    </span>
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuPopup>
          </MenuPositioner>
        </MenuPortal>
      </MenuRoot>
    </div>
  );
}
