"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/i18n-navigation";

export const metadata = {
  title: "操作层级与链接",
  description: "按钮使用 variant；链接通过 buttonVariants 复用外观。",
  order: 20,
};

/** 链接直接使用 buttonVariants，保留原生链接语义。 */
export function Example() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary">主要操作</Button>
      <Button variant="outline">次要操作</Button>
      <Link
        href="/demos/ui?component=dialog"
        className={buttonVariants({ variant: "ghost" })}
      >
        查看 Dialog
      </Link>
    </div>
  );
}
