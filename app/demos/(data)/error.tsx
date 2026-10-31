"use client";

import { Button } from "@/components/ui/button";

interface DataDemoErrorProps {
  error: unknown;
  /** 重新请求并渲染出错的路由段。 */
  retry: () => void;
}

/** Data demo 页面渲染时遇到的意外错误，比如服务端读取时后端返回 5xx。 */
export default function DataDemoError({ retry }: DataDemoErrorProps) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-medium tracking-tight">页面加载失败</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        渲染这个页面时请求出错了。可以稍后重试，或去故障实验室清除注入的故障。
      </p>
      <Button className="mt-6" onClick={retry}>
        重试
      </Button>
    </div>
  );
}
