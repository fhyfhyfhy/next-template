"use client";

import { IconAdjustmentsHorizontal, IconCheck } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MenuCheckboxItem,
  MenuCheckboxItemIndicator,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

export const metadata = {
  title: "单选与勾选",
  description:
    "MenuRadioGroup 里只能选一项，MenuCheckboxItem 各自勾选；值由调用方持有，点选后菜单不关，可以接着改。",
  order: 20,
};

const densities = [
  { value: "comfortable", label: "宽松" },
  { value: "compact", label: "紧凑" },
];

/** 两组各用 MenuGroupLabel 命名、MenuSeparator 隔开。指示器只在选中时显示，外面套一个定宽的位置，每行宽度不变。 */
export function Example() {
  const [density, setDensity] = useState("comfortable");
  const [showCover, setShowCover] = useState(true);
  const [showTime, setShowTime] = useState(false);
  return (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button variant="outline" size="icon-sm" aria-label="显示设置" />
        }
      >
        <IconAdjustmentsHorizontal aria-hidden />
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner align="start">
          <MenuPopup>
            <MenuRadioGroup value={density} onValueChange={setDensity}>
              <MenuGroupLabel>密度</MenuGroupLabel>
              {densities.map(({ value, label }) => (
                <MenuRadioItem key={value} value={value}>
                  {label}
                  <span className="ml-auto flex size-4 items-center justify-center">
                    <MenuRadioItemIndicator>
                      <IconCheck className="size-3.5" aria-hidden />
                    </MenuRadioItemIndicator>
                  </span>
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>显示</MenuGroupLabel>
              <MenuCheckboxItem
                checked={showCover}
                onCheckedChange={setShowCover}
              >
                封面
                <span className="ml-auto flex size-4 items-center justify-center">
                  <MenuCheckboxItemIndicator>
                    <IconCheck className="size-3.5" aria-hidden />
                  </MenuCheckboxItemIndicator>
                </span>
              </MenuCheckboxItem>
              <MenuCheckboxItem
                checked={showTime}
                onCheckedChange={setShowTime}
              >
                创建时间
                <span className="ml-auto flex size-4 items-center justify-center">
                  <MenuCheckboxItemIndicator>
                    <IconCheck className="size-3.5" aria-hidden />
                  </MenuCheckboxItemIndicator>
                </span>
              </MenuCheckboxItem>
            </MenuGroup>
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </MenuRoot>
  );
}
