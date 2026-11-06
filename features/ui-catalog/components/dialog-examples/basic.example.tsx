"use client";

import { Button } from "@/components/ui/button";
import {
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** 每个 Base UI 部件都在调用方显式组合。 */
export function Example() {
  return (
    <DialogRoot>
      <DialogTrigger render={<Button variant="outline" />}>
        查看详情
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          <DialogTitle>属于你的组件系统</DialogTitle>
          <DialogDescription>
            保留各部件的独立 API，组合出适合当前页面的交互。
          </DialogDescription>
          <div className="mt-6 flex justify-end">
            <DialogClose render={<Button />}>关闭</DialogClose>
          </div>
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}
