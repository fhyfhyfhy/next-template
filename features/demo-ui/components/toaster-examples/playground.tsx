"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export interface ToasterConfig {
  type: "default" | "success" | "info" | "warning" | "error";
  title: string;
  description: string;
  closeButton: boolean;
}

// 括号将结束标记保留在表达式内；UI demo 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: ToasterConfig = (/* @example-config */ {
  "type": "success",
  "title": "草稿已保存",
  "description": "最近一次修改已同步到云端。",
  "closeButton": false
} /* @end-example-config */);

const showByType = {
  default: toast,
  success: toast.success,
  info: toast.info,
  warning: toast.warning,
  error: toast.error,
};

/** 根布局已渲染 Toaster，这里只调用 toast()。 */
export function ToasterPlayground({
  config = initialConfig,
}: {
  config?: ToasterConfig;
} = {}) {
  return (
    <Button
      variant="outline"
      onClick={() =>
        showByType[config.type](config.title, {
          description: config.description || undefined,
          closeButton: config.closeButton,
        })
      }
    >
      显示提示
    </Button>
  );
}
