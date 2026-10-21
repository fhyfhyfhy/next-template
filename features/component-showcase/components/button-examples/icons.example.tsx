import { IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "图标尺寸",
  description: "图标默认 16px；通过 size-8 单独设置为 32px。",
  order: 30,
};

/** 图标显式指定 size-* 时保留调用方尺寸。 */
export function Example() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg">
        <IconPlus aria-hidden />
        默认 16px
      </Button>
      <Button size="lg" variant="outline">
        <IconPlus className="size-8" aria-hidden />
        自定义 32px
      </Button>
    </div>
  );
}
